import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_csrf_token_endpoint(client: AsyncClient):
    response = await client.get("/api/security/csrf-token")
    assert response.status_code == 200
    data = response.json()
    assert "csrfToken" in data
    assert len(data["csrfToken"]) == 64  # 32 bytes hex = 64 chars
    assert response.headers.get("cache-control") == "no-store"

    # Check CSRF cookie was set
    cookie_headers = response.headers.get_list("set-cookie")
    csrf_cookie_found = any("aiapp.csrf-token=" in c for c in cookie_headers)
    assert csrf_cookie_found


@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient):
    response = await client.get("/health")
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert response.headers.get("referrer-policy") == "no-referrer"
    assert response.headers.get("x-dns-prefetch-control") == "off"
    assert response.headers.get("x-xss-protection") == "0"


@pytest.mark.asyncio
async def test_request_id_header(client: AsyncClient):
    response = await client.get("/health")
    assert "x-request-id" in response.headers
    assert len(response.headers["x-request-id"]) > 0


@pytest.mark.asyncio
async def test_request_id_passthrough(client: AsyncClient):
    custom_id = "my-custom-request-id"
    response = await client.get("/health", headers={"x-request-id": custom_id})
    assert response.headers["x-request-id"] == custom_id


@pytest.mark.asyncio
async def test_rate_limit_headers(client: AsyncClient):
    response = await client.get("/health")
    assert "x-ratelimit-limit" in response.headers
    assert "x-ratelimit-remaining" in response.headers
    assert "x-ratelimit-reset" in response.headers
