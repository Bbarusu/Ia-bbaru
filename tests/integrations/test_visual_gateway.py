import base64
import hashlib
import io
from uuid import uuid4
from PIL import Image
from test_gateway import GatewayTestCase, request_body


def visual_attachment():
    output = io.BytesIO()
    Image.new('RGB', (8, 8), 'blue').save(output, format='PNG')
    raw = output.getvalue()
    return dict(id=str(uuid4()), project_id=str(uuid4()), kind='image', mime_type='image/png',
                byte_count=len(raw), width=8, height=8, sha256=hashlib.sha256(raw).hexdigest(),
                data_base64=base64.b64encode(raw).decode())


class VisualGatewayTests(GatewayTestCase):
    def body(self, **overrides):
        return request_body(protocol_version='1.2', attachments=[visual_attachment()],
                            allow_visual_input=True, allow_unenforced_output_limit=True, **overrides)

    def test_vision_requires_model_opt_in_and_task_acceptance(self):
        body = self.body()
        self.assertEqual(self.client.post('/v1.2/generate', json=body).json()['error']['code'], 'visual_input_not_supported')
        self.settings.claude_code.vision_models = ['sonnet']
        self.assertEqual(self.client.post('/v1.2/generate', json={**body, 'allow_visual_input': False}).json()['error']['code'], 'visual_input_not_accepted')
        self.assertEqual(self.client.post('/v1.1/generate', json={**body, 'protocol_version': '1.1'}).status_code, 422)
        body['attachments'][0]['sha256'] = '0' * 64
        self.assertEqual(self.client.post('/v1.2/generate', json=body).status_code, 422)
        self.assertEqual(self.runner.generations, 0)

    def test_typed_image_echo_and_dedup_without_base64_in_text(self):
        self.settings.claude_code.vision_models = ['sonnet']
        body = self.body()
        first = self.client.post('/v1.2/generate', json=body)
        self.assertEqual(first.status_code, 200, first.text)
        image = body['attachments'][0]
        self.assertEqual(first.json()['attachments_used'], [{'id': image['id'], 'sha256': image['sha256']}])
        import json
        document = json.loads(self.recorded()['stdin'])
        self.assertNotIn(image['data_base64'], document['message']['content'][0]['text'])
        self.assertEqual(document['message']['content'][1]['source']['data'], image['data_base64'])
        self.assertEqual(self.client.post('/v1.2/generate', json=body).json(), first.json())
        self.assertEqual(self.runner.generations, 1)

    def test_missing_or_changed_echo_never_claims_image_was_used(self):
        self.settings.claude_code.vision_models = ['sonnet']
        for mode in ('visual_no_echo', 'visual_changed_echo'):
            self.set_mode(FAKE_CLAUDE_MODE=mode)
            body = self.body(request_id=mode)
            result = self.client.post('/v1.2/generate', json=body)
            self.assertEqual(result.json()['error']['code'], 'visual_input_unconfirmed')
            self.assertEqual(self.client.post('/v1.2/generate', json=body).json(), result.json())
        self.assertEqual(self.runner.generations, 2)
