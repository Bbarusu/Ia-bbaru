"""Claude-only routing: fixtures, no account and no model calls."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.main import create_app as backend_app
from backend.contracts_v1_1 import ModelCatalogV11, GenerateResponseV11
from integrations.config import ClaudeCodeSettings, Settings
from integrations.diagnostics import report
from integrations.dedup import DedupStore, payload_hash
from backend.contracts_v1_1 import GenerateRequestV11
from integrations.adapters.claude_code import ClaudeCodeAdapter
from test_gateway import GatewayTestCase, request_body


class ClaudeProfilesTests(GatewayTestCase):
    models = ["sonnet", "haiku", "opus", "fable"]

    def test_catalog_has_only_explicitly_configured_claude_models(self):
        catalog = ModelCatalogV11.model_validate(self.client.get('/v1.1/models').json())
        self.assertEqual({m.provider for m in catalog.models}, {'claude-code'})
        tags = {m.id: m.task_kinds for m in catalog.models}
        self.assertEqual(tags['claude-code:sonnet'], ['study', 'coding'])
        self.assertEqual(tags['claude-code:haiku'], ['general', 'writing'])
        self.assertEqual(tags['claude-code:opus'], ['analysis'])
        self.assertEqual(tags['claude-code:fable'], ['analysis'])
        self.assertEqual(self.runner.generations, 0)
        self.make_client(models=['sonnet'])
        self.assertEqual([m['id'] for m in self.client.get('/v1.1/models').json()['models']], ['claude-code:sonnet'])
        diagnostic = report(self.settings.claude_code)
        self.assertEqual({k for k, v in diagnostic.items() if isinstance(v, dict)}, {'claude_code'})

    def test_removed_provider_and_unconfigured_model_cannot_execute(self):
        for mid in ('retired-provider:model', 'claude-code:unconfigured'):
            data = request_body(model_id=mid)
            data.update(protocol_version='1.1', allow_unenforced_output_limit=True)
            self.assertEqual(self.client.post('/v1.1/generate', json=data).json()['error']['code'], 'unknown_model')
        self.assertEqual(self.runner.generations, 0)

    def test_retired_provider_is_rejected_even_with_cached_result(self):
        data = request_body(model_id='retired-provider:model')
        data.update(protocol_version='1.1', allow_unenforced_output_limit=True)
        request = GenerateRequestV11.model_validate(data)
        store = DedupStore(self.settings.db_path)
        store.reserve(request.request_id, payload_hash(request.model_dump(mode='json')))
        store.complete(request.request_id, 200, GenerateResponseV11(
            request_id=request.request_id, model_id=request.model_id, output='Old result', finish_reason='stop').model_dump())
        self.assertEqual(self.client.post('/v1.1/generate', json=data).json()['error']['code'], 'unknown_model')
        self.assertEqual(self.runner.generations, 0)

    def test_windows_prefers_native_or_cmd_claude_launcher(self):
        found = {'claude.cmd': 'C:/npm/claude.cmd', 'claude': 'C:/npm/claude'}
        with patch('integrations.adapters.base.sys.platform', 'win32'), patch(
                'integrations.adapters.base.shutil.which', side_effect=found.get):
            self.assertEqual(ClaudeCodeAdapter(ClaudeCodeSettings()).command(), ['C:/npm/claude.cmd'])

    def test_task_profile_can_be_overridden_and_validated(self):
        settings = ClaudeCodeSettings(models=['sonnet'], model_task_kinds={'sonnet': ['analysis']})
        settings.validate()
        self.assertEqual(settings.task_kinds_for('sonnet'), ['analysis'])
        for bad in ([], {'other': ['study']}, {'sonnet': []}, {'sonnet': ['invalid']}, {'sonnet': [['study']]}):
            with self.subTest(bad=bad), self.assertRaises(RuntimeError):
                ClaudeCodeSettings(models=['sonnet'], model_task_kinds=bad).validate()
        with patch.dict('os.environ', {'IA_BBARU_CLAUDE_CODE_MODELS': 'sonnet',
                'IA_BBARU_CLAUDE_CODE_MODEL_TASK_KINDS': json.dumps({'sonnet': ['analysis']})}):
            self.assertEqual(ClaudeCodeSettings.from_env().task_kinds_for('sonnet'), ['analysis'])

    def test_routing_and_review_stay_inside_claude(self):
        upstream = self.client
        class Gateway:
            def catalog(self):
                return ModelCatalogV11.model_validate(upstream.get('/v1.1/models').json())
            def generate(self, request):
                response = upstream.post('/v1.1/generate', json=request.model_dump())
                assert response.status_code == 200, response.text
                return GenerateResponseV11.model_validate(response.json())
        token = 'fixture-only-backend-token-not-a-secret'
        with tempfile.TemporaryDirectory() as folder:
            with TestClient(backend_app(Path(folder) / 'backend.db', token, Gateway()),
                    headers={'Authorization': f'Bearer {token}'}) as client:
                project = client.post('/v1/projects', json={'title': 'Claude'}).json()['id']
                base = {'instruction': 'Compare os argumentos', 'kind': 'analysis', 'mode': 'review',
                        'allowed_model_ids': ['claude-code:haiku', 'claude-code:opus', 'claude-code:sonnet'],
                        'allow_unenforced_output_limit': True}
                response = client.post(f'/v1/projects/{project}/tasks', json=base)
                self.assertEqual(response.status_code, 201, response.text)
                task = response.json()
                self.assertEqual([p['model_id'] for p in task['plan']], ['claude-code:opus', 'claude-code:haiku'])
                self.assertEqual(self.runner.generations, 0)
                final = client.post(f'/v1/tasks/{task["id"]}/execute').json()
                self.assertEqual(final['status'], 'completed')
                self.assertEqual(self.runner.generations, 2)
                self.assertTrue(all(p['provider'] == 'claude-code' for p in final['plan']))
                override = client.post(f'/v1/projects/{project}/tasks', json={**base, 'preferred_model_id': 'claude-code:sonnet'}).json()
                self.assertEqual(override['plan'][0]['model_id'], 'claude-code:sonnet')
                self.assertEqual(self.runner.generations, 2)
