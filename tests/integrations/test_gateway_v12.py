"""Text contract 1.2 interoperability, without real accounts or generation."""
import json
from pathlib import Path
from unittest.mock import patch
from backend.contracts_v1_2 import GenerateRequestV12, GenerateResponseV12, ModelCatalogV12
from backend.gateway import HttpGateway, GatewayUnavailable
from integrations.export_openapi_v12 import build, TARGET
from test_gateway import GatewayTestCase, request_body


class ContractV12Tests(GatewayTestCase):
    def body(self, **overrides):
        return request_body(protocol_version="1.2", allow_unenforced_output_limit=True, **overrides)

    def test_served_model_replay_and_legacy_schema_are_separate(self):
        self.assertEqual(ModelCatalogV12.model_validate(self.client.get('/v1.2/models').json()).protocol_version, '1.2')
        first = self.client.post('/v1.2/generate', json=self.body())
        self.assertEqual(first.status_code, 200, first.text)
        result = GenerateResponseV12.model_validate(first.json())
        self.assertEqual(result.served_model, 'claude-sonnet-5-5')
        self.assertEqual(self.client.post('/v1.2/generate', json=self.body()).json(), first.json())
        self.assertEqual(self.runner.generations, 1)
        legacy = self.client.post('/v1.1/generate', json={**self.body(), 'protocol_version': '1.1'})
        self.assertEqual(legacy.status_code, 409)
        legacy = self.client.post('/v1.1/generate', json={**self.body(request_id='legacy'), 'protocol_version': '1.1'})
        self.assertNotIn('served_model', legacy.json())

    def test_acceptance_versions_and_unknown_remain_enforced(self):
        self.assertEqual(self.client.post('/v1.2/generate', json={**self.body(), 'allow_unenforced_output_limit': False}).status_code, 422)
        self.assertEqual(self.client.post('/v1.1/generate', json=self.body()).status_code, 422)
        self.assertEqual(self.runner.generations, 0)
        self.set_mode(FAKE_CLAUDE_MODE='no_stop_reason')
        result = self.client.post('/v1.2/generate', json=self.body()).json()
        self.assertEqual(result['finish_reason'], 'unknown')
        self.assertTrue(result['output'])
        self.assertEqual(self.client.post('/v1.2/generate', json=self.body()).json(), result)
        self.assertEqual(self.runner.generations, 1)

    def test_backend_uses_v12_without_fallback(self):
        gateway = HttpGateway('http://fixture', 'fixture-token', '1.2')
        def transport(method, path, body=None):
            response = self.client.request(method, path, json=body)
            self.assertEqual(response.status_code, 200, response.text)
            return response.json()
        with patch.object(gateway, '_request', side_effect=transport):
            self.assertEqual(gateway.catalog().protocol_version, '1.2')
            result = gateway.generate(GenerateRequestV12(**self.body()))
            self.assertEqual(result.served_model, 'claude-sonnet-5-5')
        with patch.object(gateway, '_request', return_value={**result.model_dump(), 'protocol_version': '1.1'}):
            with self.assertRaises(GatewayUnavailable):
                gateway.generate(GenerateRequestV12(**self.body()))

    def test_published_contract_and_actual_routes_match(self):
        schema = json.loads(json.dumps(build()))
        self.assertEqual(json.loads(TARGET.read_text(encoding='utf-8')), schema)
        consumer = Path(__file__).resolve().parents[2] / 'docs/openapi-gateway-1.2.json'
        self.assertEqual(json.loads(consumer.read_text(encoding='utf-8')), schema)
        actual = self.client.app.openapi()
        for name, model in schema['components']['schemas'].items():
            self.assertEqual(actual['components']['schemas'][name], model)
        self.assertEqual(self.runner.generations, 0)
