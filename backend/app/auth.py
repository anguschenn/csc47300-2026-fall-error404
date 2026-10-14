import os
import httpx
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from app.schemas.profile import CurrentUser

from pathlib import Path

backend_env = Path(__file__).resolve().parent.parent / ".env"
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env)
else:
    load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# HTTPBearer extracts 'Authorization: Bearer <token>' header
# auto_error=False lets us handle missing tokens with custom messages or optional auth
security = HTTPBearer(auto_error=False)

def verify_supabase_token(token: str) -> dict:
    """
    Validates a JWT token against Supabase Auth API (/auth/v1/user).
    Returns user data dictionary if valid, or raises HTTPException if invalid/expired.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase configuration missing in server environment"
        )

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers)

        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return resp.json()

    except httpx.RequestError as err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to reach authentication service: {str(err)}"
        )

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> CurrentUser:
    """
    FastAPI Dependency: Requires a valid Supabase Bearer token.
    Returns CurrentUser if authenticated, or raises 401 Unauthorized.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_data = verify_supabase_token(credentials.credentials)

    user_id = user_data.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not found in token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return CurrentUser(
        id=user_id,
        email=user_data.get("email"),
        role=user_data.get("role", "authenticated"),
        user_metadata=user_data.get("user_metadata", {})
    )

def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[CurrentUser]:
    """
    FastAPI Dependency: Returns CurrentUser if token is provided and valid,
    or None if the request is anonymous / guest.
    """
    if not credentials or not credentials.credentials:
        return None

    try:
        return get_current_user(credentials)
    except HTTPException:
        return None
