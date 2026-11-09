import httpx

from .contracts import GenerateRequest, GenerateResponse, ModelCatalog
from .contracts_v1_1 import GenerateRequestV11, GenerateResponseV11, ModelCatalogV11


class GatewayUnavailable(Exception):
    pass


class HttpGateway:
    def __init__(self, url: str | None, token: str | None, protocol_version: str = "1"):
        if protocol_version not in {"1", "1.1"}:
            raise ValueError("GATEWAY_PROTOCOL_VERSION must be 1 or 1.1")
        self.url = (url or "").rstrip("/")
        self.token = token
        self.protocol_version = protocol_version

    def _request(self, method, path, body=None):
        if not self.url or not self.token:
            raise GatewayUnavailable("gateway_not_configured")
        try:
            # No redirects or automatic retry: a timed out generation may be billed.
            with httpx.Client(timeout=httpx.Timeout(120, connect=5), follow_redirects=False) as client:
                response = client.request(
                    method, self.url + path, json=body,
                    headers={"Authorization": f"Bearer {self.token}"},
                )
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            # Do not expose upstream bodies, URLs with credentials, or prompts.
            raise GatewayUnavailable("gateway_request_failed") from exc

    def catalog(self):
        try:
            raw = self._request("GET", f"/v{self.protocol_version}/models")
            schema = ModelCatalogV11 if self.protocol_version == "1.1" else ModelCatalog
            if self.protocol_version == "1.1" and raw.get("protocol_version") != "1.1":
                raise ValueError("Gateway catalog version does not match configuration")
            return schema.model_validate(raw)
        except (ValueError, AttributeError) as exc:
            raise GatewayUnavailable("gateway_invalid_catalog") from exc

    def generate(self, request: GenerateRequest | GenerateRequestV11):
        try:
            if request.protocol_version != self.protocol_version:
                raise ValueError("Task gateway version does not match configuration")
            schema = GenerateResponseV11 if self.protocol_version == "1.1" else GenerateResponse
            raw = self._request("POST", f"/v{self.protocol_version}/generate", request.model_dump())
            if self.protocol_version == "1.1" and raw.get("protocol_version") != "1.1":
                raise ValueError("Gateway response version does not match configuration")
            result = schema.model_validate(raw)
            if result.request_id != request.request_id or result.model_id != request.model_id:
                raise ValueError("Gateway response does not match the request")
            return result
        except (ValueError, AttributeError) as exc:
            raise GatewayUnavailable("gateway_invalid_response") from exc
