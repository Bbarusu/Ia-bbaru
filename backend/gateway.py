import httpx

from .contracts import GenerateRequest, GenerateResponse, ModelCatalog


class GatewayUnavailable(Exception):
    pass


class HttpGateway:
    def __init__(self, url: str | None, token: str | None):
        self.url = (url or "").rstrip("/")
        self.token = token

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
            return ModelCatalog.model_validate(self._request("GET", "/v1/models"))
        except ValueError as exc:
            raise GatewayUnavailable("gateway_invalid_catalog") from exc

    def generate(self, request: GenerateRequest):
        try:
            result = GenerateResponse.model_validate(
                self._request("POST", "/v1/generate", request.model_dump())
            )
            if result.request_id != request.request_id or result.model_id != request.model_id:
                raise ValueError("Gateway response does not match the request")
            return result
        except ValueError as exc:
            raise GatewayUnavailable("gateway_invalid_response") from exc
