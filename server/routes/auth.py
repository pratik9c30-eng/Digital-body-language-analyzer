from fastapi import APIRouter
from pydantic import BaseModel
import secrets

router = APIRouter(prefix="/api/auth", tags=["auth"])
class SessionResponse(BaseModel): user_id: str

@router.post("/anonymous", response_model=SessionResponse)
async def anonymous_session(): return SessionResponse(user_id=secrets.token_urlsafe(12))
