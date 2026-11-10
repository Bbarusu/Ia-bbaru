import json
import struct
from typing import Literal
from uuid import UUID

import httpx
from pydantic import Field, ValidationError

from backend.contracts import StrictModel
from backend.main import ProjectInput, SourceInput, TaskInput
from backend.gateway_errors import ERROR_STATUS, error_message

HOST_NAME = "ia_bbaru.bridge"
EXTENSION_ID = "ia-bbaru@bbarusu.local"
MAX_BYTES = 900_000
OPERATIONS = ("bridge.info", "health.get", "projects.list", "projects.create",
              "sources.list", "sources.create", "sources.get", "models.list", "connections.list",
              "tasks.list", "tasks.plan", "tasks.get", "tasks.enqueue", "tasks.resume")


class Envelope(StrictModel):
    protocol_version: Literal["0"]
    request_id: UUID
    operation: str
    params: dict = Field(default_factory=dict)


class Empty(StrictModel):
    pass


class Page(StrictModel):
    offset: int = Field(default=0, ge=0, le=1_000_000)


class ProjectPage(Page):
    project_id: UUID


class NewSource(SourceInput):
    project_id: UUID


class SourceRef(StrictModel):
    project_id: UUID
    source_id: UUID


class NewTask(StrictModel):
    project_id: UUID
    task: TaskInput


class TaskRef(StrictModel):
    task_id: UUID


class QueueTask(TaskRef):
    confirmed: bool = Field(strict=True)


class Bridge:
    def __init__(self, client):
        self.client = client

    def handle(self, raw):
        candidate = raw.get("request_id") if isinstance(raw, dict) else None
        request_id = candidate if isinstance(candidate, str) and len(candidate) <= 36 else None
        def reply(ok, data):
            return {"protocol_version": "0", "request_id": request_id,
                    "ok": ok, "data" if ok else "error": data}
        try:
            envelope = Envelope.model_validate(raw)
            request_id = str(envelope.request_id)
            op, params = envelope.operation, envelope.params
            if op not in OPERATIONS:
                return reply(False, {"code": "unsupported_operation", "message": "Operação não disponível nesta versão."})
            if op == "bridge.info":
                Empty.model_validate(params)
                enabled = False
                try:
                    response = self.client.get("/health")
                    enabled = response.is_success and response.json().get("task_execution") is True
                except (httpx.HTTPError, ValueError, AttributeError):
                    pass
                return reply(True, {"version": "0.2.0", "operations": list(OPERATIONS), "task_execution": enabled})
            method, path, body, query = self.route(op, params)
            response = self.client.request(method, path, json=body, params=query)
            if not response.is_success:
                try:
                    code = response.json().get("detail")
                except (ValueError, AttributeError):
                    code = None
                if isinstance(code, str) and code in ERROR_STATUS:
                    return reply(False, {"code": code, "message": error_message(code)})
                if code == "visual_context_not_supported":
                    return reply(False, {"code": code, "message": "A imagem está salva, mas estes agentes recebem somente texto. Selecione materiais de texto; análise visual depende de um transporte multimodal."})
                messages = {401: "Autorização local inválida. Confira a instalação do componente local.",
                            404: "Item não encontrado.", 409: "A tarefa já foi iniciada.",
                            422: "Confira os campos e os limites de contexto.",
                            503: "Nenhum serviço de IA disponível. Seus materiais continuam acessíveis."}
                return reply(False, {"code": f"http_{response.status_code}", "message": messages.get(response.status_code, "O backend não concluiu a operação.")})
            return reply(True, response.json())
        except ValidationError:
            return reply(False, {"code": "invalid_request", "message": "Pedido inválido. Confira os campos."})
        except httpx.TimeoutException:
            return reply(False, {"code": "outcome_unknown", "message": "O pedido demorou. Atualize a lista antes de tentar novamente."})
        except (httpx.HTTPError, ValueError):
            return reply(False, {"code": "backend_unavailable", "message": "Backend local indisponível. Inicie o serviço no computador."})

    @staticmethod
    def route(op, params):
        if op == "connections.list":
            Empty.model_validate(params)
            return "GET", "/v1/connections", None, None
        if op in ("tasks.enqueue", "tasks.resume"):
            data = QueueTask.model_validate(params)
            return "POST", f"/v1/tasks/{data.task_id}/{op.split('.')[1]}", {"confirmed": data.confirmed}, None
        if op in ("health.get", "models.list"):
            Empty.model_validate(params)
            return "GET", "/health" if op == "health.get" else "/v1/models", None, None
        if op == "projects.list":
            data = Page.model_validate(params)
            return "GET", "/v1/projects", None, {"offset": data.offset, "limit": 30}
        if op == "projects.create":
            data = ProjectInput.model_validate(params)
            return "POST", "/v1/projects", data.model_dump(), None
        if op in ("sources.list", "tasks.list"):
            data = ProjectPage.model_validate(params)
            suffix = "sources" if op == "sources.list" else "tasks"
            return "GET", f"/v1/projects/{data.project_id}/{suffix}", None, {"offset": data.offset, "limit": 20, "summary": "true"}
        if op == "sources.create":
            data = NewSource.model_validate(params)
            return "POST", f"/v1/projects/{data.project_id}/sources", data.model_dump(exclude={"project_id"}), None
        if op == "sources.get":
            data = SourceRef.model_validate(params)
            return "GET", f"/v1/projects/{data.project_id}/sources/{data.source_id}", None, None
        if op == "tasks.plan":
            data = NewTask.model_validate(params)
            return "POST", f"/v1/projects/{data.project_id}/tasks", data.task.model_dump(), None
        data = TaskRef.model_validate(params)
        return "GET", f"/v1/tasks/{data.task_id}", None, None


def read_exact(stream, size):
    chunks = bytearray()
    while len(chunks) < size:
        part = stream.read(size - len(chunks))
        if not part:
            if not chunks:
                return None
            raise ValueError("Truncated frame")
        chunks.extend(part)
    return bytes(chunks)


def serve(bridge, incoming, outgoing):
    while True:
        header = read_exact(incoming, 4)
        if header is None:
            return
        length = struct.unpack("=I", header)[0]
        if not 0 < length <= MAX_BYTES:
            raise ValueError("Message size out of range")
        payload = read_exact(incoming, length)
        if payload is None:
            raise ValueError("Missing payload")
        try:
            request = json.loads(payload)
        except (ValueError, UnicodeError):
            raise ValueError("Invalid JSON") from None
        result = bridge.handle(request)
        encoded = json.dumps(result, ensure_ascii=False).encode("utf-8")
        if len(encoded) > MAX_BYTES:
            encoded = json.dumps({"protocol_version": "0", "request_id": result["request_id"],
                                  "ok": False, "error": {"code": "response_too_large",
                                  "message": "Resultado grande demais para o painel. Consulte pelo backend local."}}).encode()
        outgoing.write(struct.pack("=I", len(encoded)))
        outgoing.write(encoded)
        outgoing.flush()
