import httpx
from .gateway_errors import ERROR_STATUS

from .contracts import GenerateRequest, GenerateResponse, ModelCatalog
from .contracts_v1_1 import GenerateRequestV11, GenerateResponseV11, ModelCatalogV11


class GatewayUnavailable(Exception):
    def __init__(self, code="gateway_request_failed", http_status=None):
        super().__init__(code)
        self.code = code
        self.http_status = http_status


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
                if not response.is_success:
                    code = "gateway_request_failed"
                    # Limit input before parsing. Free-form message/next_action are ignored.
                    if len(response.content) <= 16384:
                        try:
                            raw = response.json()
                            candidate = raw.get("error", {}).get("code")
                            if isinstance(candidate, str) and ERROR_STATUS.get(candidate) == response.status_code:
                                code = candidate
                        except (ValueError, AttributeError, TypeError):
                            pass
                    raise GatewayUnavailable(code, response.status_code)
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
