import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_invalid_session_token(client: AsyncClient):
    """A request with a bad session cookie should get 401 on protected routes."""
    response = await client.get(
        "/api/user/profile",
        cookies={"better-auth.session_token": "invalid-token"},
    )
    assert response.status_code == 401
    assert response.json() == {"error": "Unauthorized"}


@pytest.mark.asyncio
async def test_missing_session_cookie(client: AsyncClient):
    """No cookie at all should get 401 on protected routes."""
    response = await client.get("/api/user/profile")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_csrf_blocks_post_without_token(auth_client: AsyncClient):
    """POST without CSRF token should be rejected."""
    response = await auth_client.post(
        "/api/projects/",
        json={"name": "Test"},
        headers={"origin": "http://localhost:3000"},
    )
    assert response.status_code == 403
    assert response.json() == {"error": "Invalid CSRF token"}


@pytest.mark.asyncio
async def test_csrf_blocks_bad_origin(auth_client: AsyncClient):
    """POST from untrusted origin should be rejected."""
    response = await auth_client.post(
        "/api/projects/",
        json={"name": "Test"},
        headers={
            "origin": "http://evil.com",
            "x-csrf-token": "some-token",
        },
    )
    assert response.status_code == 403
    assert response.json() == {"error": "Forbidden origin"}
