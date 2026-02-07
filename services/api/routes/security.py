from fastapi import APIRouter
from starlette.responses import JSONResponse

from middleware.csrf import create_csrf_token, set_csrf_cookie

router = APIRouter(prefix="/api/security")


@router.get("/csrf-token")
async def csrf_token():
    token = create_csrf_token()
    response = JSONResponse(content={"csrfToken": token})
    set_csrf_cookie(response, token)
    response.headers["cache-control"] = "no-store"
    return response
