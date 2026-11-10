"""Durable execution tests use fixtures only; no subscription or provider CLI."""
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient

from backend.gateway import GatewayUnavailable, HttpGateway
from backend.gateway_errors import ERROR_STATUS
from backend.main import create_app
from backend.worker import DurableWorker, WorkerLock
from native_host.bridge import Bridge
from test_backend_v11 import FixtureGateway, TOKEN


class GatewayErrorsTests(unittest.TestCase):
    def test_connections_strip_freeform_details_and_unknown_providers(self):
        gateway = HttpGateway('http://localhost:8010', 'fixture', '1.1')
        raw = {'connections': [{'provider': 'gemini-cli', 'version': 'Gemini 0.67.0 SECRET',
            'ready': True, 'installed': True, 'configured_models': ['gemini-cli:fixture'],
            'reason': 'SECRET', 'detail': 'SECRET', 'next_action': 'SECRET'}, {'provider': []}]}
        with patch.object(gateway, '_request', return_value=raw):
            result = gateway.connections()
        self.assertNotIn('SECRET', str(result))
        self.assertEqual(len(result['connections']), 1)
        self.assertEqual(result['connections'][0]['version'], '0.67.0')
        self.assertIsNone(result['connections'][0]['reason'])

    def test_allowlist_status_pairs_and_untrusted_text(self):
        gateway = HttpGateway('http://localhost:8010', 'fixture', '1.1')
        cases = [(status, {'error': {'code': code, 'message': 'SECRET', 'next_action': 'SECRET'}}, code)
                 for code, status in ERROR_STATUS.items()]
        cases += [(503, {'error': {'code': 'provider_timeout'}}, 'gateway_request_failed'),
                  (502, {'error': {'code': 'SECRET'}}, 'gateway_request_failed'),
                  (503, {'error': []}, 'gateway_request_failed'),
                  (503, ['SECRET'], 'gateway_request_failed'),
                  (503, {'error': {'code': 'provider_not_logged_in', 'message': 'x' * 20000}}, 'gateway_request_failed')]
        for status, body, expected in cases:
            with self.subTest(status=status, expected=expected), patch('backend.gateway.httpx.Client') as factory:
                factory.return_value.__enter__.return_value.request.return_value = httpx.Response(status, json=body)
                with self.assertRaises(GatewayUnavailable) as caught:
                    gateway._request('POST', '/v1.1/generate', {})
                self.assertEqual(caught.exception.code, expected)
                self.assertNotIn('SECRET', str(caught.exception))


class DurableTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.db = Path(directory.name) / 'tasks.sqlite3'
        self.gateway = FixtureGateway()
        # Manual worker stepping makes restart and response policy deterministic.
        self.app = create_app(self.db, TOKEN, self.gateway, durable_execution=True)
        self.store = self.app.state.store
        self.worker = self.app.state.worker
        self.worker.retry_delay = 0
        self.client = self.enterContext(TestClient(self.app, headers={'Authorization': f'Bearer {TOKEN}'}))
        self.worker.stop()
        self.worker.stop_event.clear()
        self.project = self.client.post('/v1/projects', json={'title': 'Fixture'}).json()['id']

    def plan(self, review=False):
        response = self.client.post(f'/v1/projects/{self.project}/tasks', json={
            'instruction': 'Fixture only', 'allowed_model_ids': ['test:writer', 'test:reviewer'],
            'mode': 'review' if review else 'single', 'allow_unenforced_output_limit': True})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def queue(self, task, resume=False):
        route = 'resume' if resume else 'enqueue'
        response = self.client.post(f'/v1/tasks/{task["id"]}/{route}', json={'confirmed': True})
        self.assertEqual(response.status_code, 202, response.text)

    def step(self):
        task = self.store.claim_job(time.time() + 60)
        self.assertIsNotNone(task)
        self.worker.process(task)
        return self.store.task(task['id'])

    def test_confirmation_auth_and_single_enqueue(self):
        task = self.plan()
        url = f'/v1/tasks/{task["id"]}/enqueue'
        for confirmed in (False, 'true', 1, None):
            self.assertEqual(self.client.post(url, json={'confirmed': confirmed}).status_code, 422)
        self.assertEqual(self.client.post(url, json={'confirmed': True}, headers={'Authorization': 'Bearer wrong'}).status_code, 401)
        self.queue(task)
        self.assertEqual(self.client.post(url, json={'confirmed': True}).status_code, 409)
        self.assertEqual(self.client.post(f'/v1/tasks/{task["id"]}/execute').status_code, 409)
        self.assertEqual(self.gateway.calls, [])
        self.assertEqual(self.step()['status'], 'completed')

    def test_wait_replays_identical_request_then_reviews_once(self):
        task = self.plan(review=True)
        self.queue(task)
        original = self.gateway.generate
        requests = []
        errors = iter(['gateway_busy', 'request_in_progress'])
        def generate(request):
            requests.append(request.model_dump())
            code = next(errors, None)
            if code:
                raise GatewayUnavailable(code, ERROR_STATUS[code])
            return original(request)
        self.gateway.generate = generate
        for _ in range(2):
            self.assertEqual(self.step()['status'], 'waiting')
            self.store.recover()
        self.assertEqual(self.step()['status'], 'queued')
        result = self.step()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(requests[0], requests[1])
        self.assertEqual(requests[0], requests[2])
        self.assertEqual([r.request_id for r in self.gateway.calls], [f'{task["id"]}:0', f'{task["id"]}:1'])
        self.assertEqual(self.gateway.calls[1].previous_output, result['results'][0]['output'])
        public = self.client.get(f'/v1/tasks/{task["id"]}').json()
        self.assertNotIn('request', public['execution']['steps'][0])
        listed = self.client.get(f'/v1/projects/{self.project}/tasks').json()['items'][0]
        self.assertNotIn('request', listed['execution']['steps'][0])

    def test_terminal_errors_never_retry_or_resume(self):
        for code, state in [('provider_timeout', 'uncertain'), ('request_outcome_uncertain', 'uncertain'),
                            ('gateway_request_failed', 'uncertain'), ('gateway_invalid_response', 'uncertain'),
                            ('provider_quota_exceeded', 'failed'), ('provider_not_authenticated', 'failed'),
                            ('unknown_model', 'failed'), ('output_limit_not_accepted', 'failed'),
                            ('provider_error', 'failed'), ('completion_unconfirmed', 'failed')]:
            with self.subTest(code=code):
                task = self.plan(review=True)
                self.queue(task)
                with patch.object(self.gateway, 'generate', side_effect=GatewayUnavailable(code, ERROR_STATUS.get(code))) as call:
                    result = self.step()
                self.assertEqual(call.call_count, 1)
                self.assertEqual((result['status'], result['error']), (state, code))
                self.assertEqual(result['execution']['steps'][0]['error_code'], code)
                self.store.recover()
                self.assertIsNone(self.store.claim_job(time.time() + 60))
                self.assertEqual(self.client.post(f'/v1/tasks/{task["id"]}/resume', json={'confirmed': True}).status_code, 409)

    def test_prestart_block_can_resume_with_same_id(self):
        task = self.plan()
        self.queue(task)
        with patch.object(self.gateway, 'generate', side_effect=GatewayUnavailable('provider_not_logged_in', 503)):
            self.assertEqual(self.step()['status'], 'blocked')
        self.assertIsNone(self.store.claim_job(time.time() + 60))
        self.queue(task, resume=True)
        result = self.step()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(self.gateway.calls[0].request_id, f'{task["id"]}:0')

    def test_catalogue_login_loss_blocks_without_call_then_can_resume(self):
        task = self.plan()
        self.queue(task)
        self.gateway.models[0].update(available=False, unavailable_reason='not_logged_in')
        result = self.step()
        self.assertEqual((result['status'], result['error']), ('blocked', 'provider_not_logged_in'))
        self.assertEqual(self.gateway.calls, [])
        self.gateway.models[0].update(available=True, unavailable_reason=None)
        self.queue(task, resume=True)
        self.assertEqual(self.step()['status'], 'completed')

    def test_unknown_and_length_preserve_output_without_review(self):
        for reason in ('unknown', 'length'):
            task = self.plan(review=True)
            self.gateway.finish_reason = reason
            self.queue(task)
            result = self.step()
            self.assertEqual(result['status'], 'incomplete')
            self.assertEqual(result['execution']['steps'][0]['state'], 'incomplete')
            self.assertEqual(len(result['results']), 1)
            self.assertEqual(result['output'], result['results'][0]['output'])
            self.assertIsNone(self.store.claim_job(time.time() + 60))

    def test_recovery_before_dispatch_and_after_dispatch(self):
        for in_flight in (False, True):
            task = self.plan()
            self.queue(task)
            claimed = self.store.claim_job(time.time())
            if in_flight:
                claimed['execution']['steps'][0]['state'] = 'in_flight'
                self.store.save_task(claimed)
            self.store.recover()
            result = self.store.task(task['id'])
            self.assertEqual(result['status'], 'uncertain' if in_flight else 'queued')
            if not in_flight:
                self.assertEqual(self.step()['status'], 'completed')
            else:
                self.assertIsNone(self.store.claim_job(time.time() + 60))

    def test_completed_writer_not_repeated_on_restart(self):
        task = self.plan(review=True)
        self.queue(task)
        self.assertEqual(self.step()['status'], 'queued')
        self.store.recover()
        self.assertEqual(self.step()['status'], 'completed')
        self.assertEqual([r.role for r in self.gateway.calls], ['answer', 'review'])

    def test_background_worker_and_bridge_polling(self):
        task = self.plan()
        started, release = threading.Event(), threading.Event()
        original = self.gateway.generate
        def generate(request):
            started.set()
            if not release.wait(5):
                raise RuntimeError('fixture timed out')
            return original(request)
        self.gateway.generate = generate
        worker = DurableWorker(self.store, self.gateway)
        worker.start()
        self.addCleanup(worker.stop)
        self.addCleanup(release.set)
        bridge = Bridge(self.client)
        reply = bridge.handle({'protocol_version': '0', 'request_id': str(uuid4()), 'operation': 'tasks.enqueue',
                               'params': {'task_id': task['id'], 'confirmed': True}})
        self.assertTrue(reply['ok'], reply)
        self.assertTrue(started.wait(3))
        self.assertEqual(self.client.get(f'/v1/tasks/{task["id"]}').json()['status'], 'running')
        release.set()
        worker.stop()
        self.assertEqual(self.store.task(task['id'])['status'], 'completed')

    def test_worker_lock_excludes_second_consumer(self):
        one, two = WorkerLock(self.db), WorkerLock(self.db)
        one.acquire()
        try:
            with self.assertRaises(RuntimeError):
                two.acquire()
        finally:
            one.release()
        two.acquire()
        two.release()

    def test_failed_result_write_does_not_dispatch_again(self):
        task = self.plan()
        self.queue(task)
        original = self.store.save_task
        def save(body):
            if body['status'] == 'completed':
                raise OSError('simulated result write failure')
            original(body)
        worker = DurableWorker(self.store, self.gateway)
        with patch.object(self.store, 'save_task', side_effect=save):
            worker.start()
            try:
                deadline = time.monotonic() + 3
                while time.monotonic() < deadline:
                    result = self.store.task(task['id'])
                    if result['status'] == 'uncertain':
                        break
                    time.sleep(.01)
                self.assertEqual(result['status'], 'uncertain')
                self.assertEqual(len(self.gateway.calls), 1)
            finally:
                worker.stop()
        self.store.recover()
        self.assertIsNone(self.store.claim_job(time.time() + 60))
