import json
from pathlib import Path
from test_gateway import GatewayTestCase, request_body
from test_visual_gateway import visual_attachment
from integrations.export_openapi_v13 import build, TARGET

class ContractV13Tests(GatewayTestCase):
    def test_four_images_echo_order_and_idempotency(self):
        self.settings.claude_code.vision_models = ['sonnet']
        images = [visual_attachment() for _ in range(4)]
        body = request_body(protocol_version='1.3', attachments=images, allow_visual_input=True, allow_unenforced_output_limit=True)
        first = self.client.post('/v1.3/generate', json=body)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json()['attachments_used'], [{'id': a['id'], 'sha256': a['sha256']} for a in images])
        self.assertEqual(self.client.post('/v1.3/generate', json=body).json(), first.json())
        self.assertEqual(self.runner.generations, 1)
        document = json.loads(self.recorded()['stdin'])
        self.assertEqual(len(document['message']['content']), 5)
        self.assertNotIn(images[0]['data_base64'], document['message']['content'][0]['text'])
        catalog = self.client.get('/v1.3/models').json()
        self.assertEqual(catalog['models'][0]['input']['image']['max_images'], 4)
        self.assertEqual(self.client.get('/v1.2/models').json()['models'][0]['input']['image']['max_images'], 1)

    def test_limits_duplicates_and_legacy_route_before_generation(self):
        self.settings.claude_code.vision_models = ['sonnet']
        image = visual_attachment()
        body = request_body(protocol_version='1.3', attachments=[image, image], allow_visual_input=True, allow_unenforced_output_limit=True)
        self.assertEqual(self.client.post('/v1.3/generate', json=body).status_code, 422)
        body['attachments'] = [visual_attachment() for _ in range(5)]
        self.assertEqual(self.client.post('/v1.3/generate', json=body).status_code, 422)
        body['attachments'] = body['attachments'][:2]
        self.assertEqual(self.client.post('/v1.2/generate', json={**body, 'protocol_version': '1.2'}).status_code, 422)
        self.assertEqual(self.runner.generations, 0)

    def test_export_matches_actual_schemas(self):
        schema = build()
        self.assertEqual(json.loads(TARGET.read_text()), schema)
        self.assertEqual(json.loads((Path(__file__).resolve().parents[2] / 'docs/openapi-gateway-1.3.json').read_text()), schema)
        actual = self.app.openapi()
        for name, model in schema['components']['schemas'].items():
            self.assertEqual(actual['components']['schemas'][name], model)
