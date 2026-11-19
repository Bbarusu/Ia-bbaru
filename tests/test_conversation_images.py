"""Conversation images use the existing queue; no account or real model."""
import json
from uuid import uuid4
from backend.contracts_v1_3 import ModelCatalogV13, GenerateResponseV13
from test_conversations import ConversationCase
from test_media import picture

class ConversationImageTests(ConversationCase):
    # Reuse fixture setup/helpers, not the inherited test suite.
    def image(self, **overrides):
        return {"attachment_id": str(uuid4()), "title": "Diagrama", "media": {"kind": "image", "data_url": picture()}, **overrides}

    def enable(self, version="1.2"):
        self.gateway.models[0]["input"] = {"image": {"supported": True}}
        if version == "1.3":
            self.gateway.catalog = lambda: ModelCatalogV13(models=self.gateway.models)
            def generate(request):
                self.gateway.calls.append(request)
                return GenerateResponseV13(request_id=request.request_id, model_id=request.model_id, output="Imagens recebidas",
                    finish_reason="stop", attachments_used=[{"id": a.id, "sha256": a.sha256} for a in request.attachments])
            self.gateway.generate = generate

    def test_direct_image_never_creates_library_source_and_replays_once(self):
        self.enable()
        image = self.image()
        body = self.body(attachments=[image], allow_visual_input=True)
        sent = self.send(body)
        self.assertEqual(sent.status_code, 202, sent.text)
        self.assertNotIn("data_url", sent.text)
        final = self.process()
        self.assertEqual(final["status"], "completed")
        self.assertEqual(self.send(body).json()["task_id"], final["id"])
        self.assertEqual(len(self.gateway.calls), 1)
        with self.store.connect() as conn:
            self.assertEqual(conn.execute("SELECT count(*) FROM sources").fetchone()[0], 0)
            self.assertEqual(conn.execute("SELECT count(*) FROM conversation_media").fetchone()[0], 1)
        self.assertNotIn("data_base64", json.dumps(final))
        self.assertEqual(self.send().json()["detail"], "visual_input_not_accepted")
        self.send(allow_visual_input=True); self.process()
        self.assertEqual(self.gateway.calls[0].attachments, self.gateway.calls[1].attachments)

    def test_four_images_13_and_immutable_ids_across_conversations(self):
        self.enable("1.3")
        images = [self.image() for _ in range(4)]
        sent = self.send(attachments=images, allow_visual_input=True)
        self.assertEqual(sent.status_code, 202, sent.text)
        self.assertEqual(self.process()["status"], "completed")
        self.assertEqual(len(self.gateway.calls[0].attachments), 4)
        other = self.create()["id"]
        response = self.send(cid=other, attachments=images[:1], allow_visual_input=True)
        self.assertEqual(response.json()["detail"], "attachment_id_conflict")
        self.assertEqual(len(self.gateway.calls), 1)
        changed = self.send(attachments=[self.image()], allow_visual_input=True)
        self.assertEqual(changed.json()["detail"], "context_too_large")

    def test_tall_image_refused_before_queue(self):
        from PIL import Image
        import base64
        import io
        self.enable()
        stream = io.BytesIO()
        Image.new("RGB", (10, 2001)).save(stream, "PNG")
        image = self.image(media={"kind": "image", "data_url": "data:image/png;base64," + base64.b64encode(stream.getvalue()).decode()})
        response = self.send(attachments=[image], allow_visual_input=True)
        self.assertEqual(response.json()["detail"], "image_dimensions_exceeded")
        self.assertFalse(self.gateway.calls)

    def test_legacy_multiple_and_missing_consent_never_store_or_generate(self):
        self.enable()
        image = self.image()
        for values in ({"attachments": [image]}, {"attachments": [image, self.image()], "allow_visual_input": True}):
            self.assertEqual(self.send(**values).status_code, 422)
        self.assertEqual(self.gateway.calls, [])
        with self.store.connect() as conn:
            self.assertEqual(conn.execute("SELECT count(*) FROM conversation_media").fetchone()[0], 0)
