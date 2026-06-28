/**
 * Generates the Python httpx-based HTTP client class for the SDK.
 */

import type { ParsedSpec } from "../../types";

/**
 * Generate the Python client class source code.
 *
 * @param spec - The parsed OpenAPI spec
 * @returns Python source code string for the client module
 */
export function generatePythonClient(spec: ParsedSpec): string {
  const baseUrl = spec.servers[0] || "http://localhost:3000";
  const title = spec.info.title || "API";

  return `# Auto-generated ${title} Client
# Do not edit manually

from typing import Any, Optional

import httpx

from .errors import EmitError, EmitHttpError


class Client:
    """HTTP client for ${title}."""

    def __init__(
        self,
        base_url: str = "${baseUrl}",
        token: Optional[str] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> None:
        self.base_url = base_url
        self.token = token
        self.headers = headers or {}
        self._client = httpx.Client()

    def set_token(self, token: str) -> None:
        """Set the authentication token."""
        self.token = token

    def set_base_url(self, base_url: str) -> None:
        """Set the base URL."""
        self.base_url = base_url

    def _build_headers(self, content_type: Optional[str] = None) -> dict[str, str]:
        headers: dict[str, str] = {**self.headers}

        if content_type:
            headers["Content-Type"] = content_type

        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        return headers

    def _build_url(self, path: str, params: Optional[dict[str, str]] = None) -> str:
        return f"{self.base_url}{path}"

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[Any] = None,
        params: Optional[dict[str, str]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Any:
        url = self._build_url(path, params)
        request_headers = self._build_headers(
            "application/json" if body is not None else None
        )
        if headers:
            request_headers.update(headers)

        try:
            response = self._client.request(
                method,
                url,
                json=body,
                params=params,
                headers=request_headers,
            )
        except httpx.HTTPError as exc:
            raise EmitError(f"Network error: {exc}") from exc

        if response.status_code >= 400:
            try:
                error_body = response.json()
            except Exception:
                error_body = response.text
            raise EmitHttpError(
                f"HTTP {response.status_code}: {response.reason_phrase}",
                response.status_code,
                error_body,
            )

        if response.status_code == 204:
            return None

        return response.json()

    def get(
        self,
        path: str,
        params: Optional[dict[str, str]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Any:
        return self._request("GET", path, params=params, headers=headers)

    def post(
        self,
        path: str,
        body: Optional[Any] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Any:
        return self._request("POST", path, body=body, headers=headers)

    def put(
        self,
        path: str,
        body: Optional[Any] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Any:
        return self._request("PUT", path, body=body, headers=headers)

    def patch(
        self,
        path: str,
        body: Optional[Any] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Any:
        return self._request("PATCH", path, body=body, headers=headers)

    def delete(
        self,
        path: str,
        headers: Optional[dict[str, str]] = None,
    ) -> Any:
        return self._request("DELETE", path, headers=headers)
`;
}
