"""Conversation-only attachments: no library material, immutable IDs, atomic with turn."""
import json
from uuid import UUID
from fastapi import HTTPException
from pydantic import Field
from .contracts import StrictModel
from .media import MediaInput, validate_media
from .visual import attachment

class TurnImage(StrictModel):
    attachment_id: UUID
    title: str = Field(min_length=1, max_length=120)
    media: MediaInput


def prepare_images(images, project_id):
    if len({str(image.attachment_id) for image in images}) != len(images):
        raise HTTPException(422, "duplicate_attachment")
    prepared = []
    for image in images:
        try:
            media = validate_media(image.media)
        except ValueError:
            raise HTTPException(422, "invalid_image") from None
        prepared.append({"id": str(image.attachment_id), "title": image.title,
                         "media": media, "reference": attachment(str(image.attachment_id), project_id, media).model_dump(exclude={"data_base64"})})
    return prepared


def persist_images(conn, cid, images):
    for image in images:
        encoded = json.dumps({"title": image["title"], "media": image["media"]}, sort_keys=True)
        row = conn.execute("SELECT conversation_id,body FROM conversation_media WHERE id=?", (image["id"],)).fetchone()
        if (row and (row["conversation_id"] != cid or row["body"] != encoded)) or conn.execute("SELECT id FROM sources WHERE id=?", (image["id"],)).fetchone():
            raise HTTPException(409, "attachment_id_conflict")
        conn.execute("INSERT OR IGNORE INTO conversation_media VALUES (?,?,?)", (image["id"], cid, encoded))
