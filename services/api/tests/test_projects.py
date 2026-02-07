import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_projects_unauthenticated(client: AsyncClient):
    response = await client.get("/api/projects")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_projects_empty(auth_client: AsyncClient):
    response = await auth_client.get("/api/projects")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_project(auth_client: AsyncClient):
    # First get a CSRF token
    csrf_resp = await auth_client.get("/api/security/csrf-token")
    csrf_token = csrf_resp.json()["csrfToken"]

    response = await auth_client.post(
        "/api/projects",
        json={"name": "My Project", "description": "A test project"},
        headers={
            "x-csrf-token": csrf_token,
            "origin": "http://localhost:3000",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Project"
    assert data["description"] == "A test project"
    assert "id" in data
    assert "createdAt" in data
    assert "updatedAt" in data


@pytest.mark.asyncio
async def test_create_project_empty_name(auth_client: AsyncClient):
    csrf_resp = await auth_client.get("/api/security/csrf-token")
    csrf_token = csrf_resp.json()["csrfToken"]

    response = await auth_client.post(
        "/api/projects",
        json={"name": ""},
        headers={
            "x-csrf-token": csrf_token,
            "origin": "http://localhost:3000",
        },
    )
    assert response.status_code == 400
    assert "error" in response.json()


@pytest.mark.asyncio
async def test_get_project_not_found(auth_client: AsyncClient):
    response = await auth_client.get("/api/projects/nonexistent-id")
    assert response.status_code == 404
    assert response.json() == {"error": "Project not found"}


@pytest.mark.asyncio
async def test_create_and_get_project(auth_client: AsyncClient):
    csrf_resp = await auth_client.get("/api/security/csrf-token")
    csrf_token = csrf_resp.json()["csrfToken"]

    # Create
    create_resp = await auth_client.post(
        "/api/projects",
        json={"name": "Test Project"},
        headers={
            "x-csrf-token": csrf_token,
            "origin": "http://localhost:3000",
        },
    )
    assert create_resp.status_code == 201
    project_id = create_resp.json()["id"]

    # Get
    get_resp = await auth_client.get(f"/api/projects/{project_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == project_id
    assert get_resp.json()["name"] == "Test Project"


@pytest.mark.asyncio
async def test_create_and_list_projects(auth_client: AsyncClient):
    csrf_resp = await auth_client.get("/api/security/csrf-token")
    csrf_token = csrf_resp.json()["csrfToken"]

    await auth_client.post(
        "/api/projects",
        json={"name": "Project A"},
        headers={
            "x-csrf-token": csrf_token,
            "origin": "http://localhost:3000",
        },
    )
    await auth_client.post(
        "/api/projects",
        json={"name": "Project B"},
        headers={
            "x-csrf-token": csrf_token,
            "origin": "http://localhost:3000",
        },
    )

    list_resp = await auth_client.get("/api/projects")
    assert list_resp.status_code == 200
    projects = list_resp.json()
    assert len(projects) == 2
