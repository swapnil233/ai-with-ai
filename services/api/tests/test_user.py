import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    response = await client.get("/api/user/me")
    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.asyncio
async def test_me_authenticated(auth_client: AsyncClient):
    response = await auth_client.get("/api/user/me")
    assert response.status_code == 200
    data = response.json()
    assert data is not None
    assert "user" in data
    assert "session" in data
    assert data["user"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_profile_unauthenticated(client: AsyncClient):
    response = await client.get("/api/user/profile")
    assert response.status_code == 401
    assert response.json() == {"error": "Unauthorized"}


@pytest.mark.asyncio
async def test_profile_authenticated(auth_client: AsyncClient):
    response = await auth_client.get("/api/user/profile")
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "test@example.com"
    assert "session" in data
