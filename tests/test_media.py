import base64
import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from fastapi.testclient import TestClient
from backend.main import create_app
from native_host.bridge import Bridge
from test_backend_v11 import FixtureGateway, TOKEN
from uuid import uuid4


def picture():
    buffer = io.BytesIO()
    Image.new('RGB', (16, 12), 'blue').save(buffer, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()


class MediaTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.gateway = FixtureGateway()
        self.app = create_app(Path(folder.name) / 'media.sqlite3', TOKEN, self.gateway)
        self.client = self.enterContext(TestClient(self.app, headers={'Authorization': f'Bearer {TOKEN}'}))
        self.project = self.client.post('/v1/projects', json={'title': 'Capturas'}).json()['id']

    def save(self, data_url):
        return self.client.post(f'/v1/projects/{self.project}/sources', json={
            'title': 'Tela', 'content': 'Descrição explícita', 'media': {'kind': 'screenshot', 'data_url': data_url}})

    def test_image_roundtrip_separate_from_text_and_summary(self):
        response = self.save(picture())
        self.assertEqual(response.status_code, 201, response.text)
        source = response.json()
        self.assertEqual(source['media']['width'], 16)
        self.assertEqual(source['media']['height'], 12)
        self.assertNotIn('base64', source['content'])
        listed = self.client.get(f'/v1/projects/{self.project}/sources?summary=true').json()['items'][0]
        self.assertNotIn('data_url', listed['media'])
        detail = self.client.get(f'/v1/projects/{self.project}/sources/{source["id"]}').json()
        self.assertEqual(detail['media']['data_url'], picture())
        other = self.client.post('/v1/projects', json={'title': 'Outro'}).json()['id']
        self.assertEqual(self.client.get(f'/v1/projects/{other}/sources/{source["id"]}').status_code, 404)

    def test_raster_limits_invalid_and_truncated_data(self):
        for data in ('https://example.com/image.png', 'data:image/svg+xml;base64,PHN2Zz4=',
                     picture()[:-8], 'data:image/jpeg;base64,' + picture().split(',')[1],
                     'data:image/png;base64,' + 'A' * 640001):
            with self.subTest(data=data[:35]):
                self.assertEqual(self.save(data).status_code, 422)
        self.assertEqual(self.client.get(f'/v1/projects/{self.project}/sources').json()['items'], [])

    def test_visual_material_never_sent_to_text_gateway(self):
        source = self.save(picture()).json()
        bridge = Bridge(self.client)
        response = bridge.handle({'protocol_version': '0', 'request_id': str(uuid4()), 'operation': 'tasks.plan',
            'params': {'project_id': self.project, 'task': {'instruction': 'Analise',
                'allowed_model_ids': ['test:writer'], 'source_ids': [source['id']], 'allow_unenforced_output_limit': True}}})
        self.assertFalse(response['ok'])
        self.assertEqual(response['error']['code'], 'visual_context_not_supported')
        self.assertEqual(self.gateway.calls, [])

    def test_old_inline_visual_cannot_silently_become_text_context(self):
        source = self.client.post(f'/v1/projects/{self.project}/sources', json={
            'title': 'Antiga', 'content': 'AnexoVisual: ' + picture()}).json()
        response = self.client.post(f'/v1/projects/{self.project}/tasks', json={
            'instruction': 'Analise', 'allowed_model_ids': ['test:writer'], 'source_ids': [source['id']],
            'allow_unenforced_output_limit': True})
        self.assertEqual(response.json()['detail'], 'visual_context_not_supported')

    def test_existing_plan_is_rechecked_before_dispatch(self):
        task = self.client.post(f'/v1/projects/{self.project}/tasks', json={
            'instruction': 'Analise', 'allowed_model_ids': ['test:writer'],
            'allow_unenforced_output_limit': True}).json()
        task['context'] = [{'id': 'old', 'title': 'Old capture', 'content': 'AnexoVisual: ' + picture()}]
        self.app.state.store.save_task(task)
        response = self.client.post(f'/v1/tasks/{task["id"]}/execute').json()
        self.assertEqual(response['error'], 'visual_context_not_supported')
        self.assertEqual(self.gateway.calls, [])
