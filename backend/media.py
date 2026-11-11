"""Bounded raster attachments, stored locally and never disguised as prompt text."""
import base64
import binascii
import io

from PIL import Image, UnidentifiedImageError
from pydantic import Field
from typing import Literal
from .contracts import StrictModel


class MediaInput(StrictModel):
    kind: Literal["image", "screenshot"]
    data_url: str = Field(max_length=640100)


def validate_media(media):
    prefix, separator, encoded = media.data_url.partition(",")
    formats = {"data:image/png;base64": "PNG", "data:image/jpeg;base64": "JPEG"}
    if not separator or prefix not in formats:
        raise ValueError("invalid_image")
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > 480000 or not raw:
            raise ValueError("image_too_large")
        with Image.open(io.BytesIO(raw)) as im:
            width, height = im.size
            if width * height > 16000000 or width > 8000 or height > 8000:
                raise ValueError("image_dimensions_exceeded")
            if im.format != formats[prefix] or getattr(im, "n_frames", 1) != 1:
                raise ValueError("invalid_image")
            im.verify()
        # Decode too: JPEG verify alone does not reject truncated pixel data.
        with Image.open(io.BytesIO(raw)) as im:
            im.load()
    except (binascii.Error, UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError):
        raise ValueError("invalid_image") from None
    return {"kind": media.kind, "mime_type": "image/png" if formats[prefix] == "PNG" else "image/jpeg",
            "width": width, "height": height, "byte_count": len(raw), "data_url": media.data_url}
