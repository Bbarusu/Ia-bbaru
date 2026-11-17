"""Persist image references and hashes; reload pixels only for dispatch."""
import base64
import hashlib
import json
from .contracts_v1_2 import VisualAttachment


def visual_policy(model):
    declared = getattr(model, "input", None)
    return None if declared and declared.image.supported else "visual_input_not_supported"


def attachment(source_id, project_id, media):
    encoded = media["data_url"].partition(",")[2]
    return VisualAttachment(id=source_id, project_id=project_id, kind=media["kind"],
        mime_type=media["mime_type"], byte_count=media["byte_count"], width=media["width"], height=media["height"],
        sha256=hashlib.sha256(base64.b64decode(encoded, validate=True)).hexdigest(), data_base64=encoded)


def source_attachment(conn, source_id, project_id):
    row = conn.execute("SELECT body FROM source_media WHERE source_id=?", (source_id,)).fetchone()
    if not row:
        return None
    return attachment(source_id, project_id, json.loads(row["body"]))


def dispatch_attachments(store, task):
    images = []
    with store.connect() as conn:
        for ref in task.get("attachment_refs", []):
            # Both project identity and immutable content must still match.
            row = conn.execute("SELECT id FROM sources WHERE id=? AND project_id=?", (ref["id"], task["project_id"])).fetchone()
            image = source_attachment(conn, ref["id"], task["project_id"]) if row else None
            if not image or image.model_dump(exclude={"data_base64"}) != ref:
                raise ValueError("attachment_changed_replan_required")
            images.append(image.model_dump())
    return images
