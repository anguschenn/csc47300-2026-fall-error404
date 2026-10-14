from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class ProfileBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    home_station_id: Optional[str] = None
    work_station_id: Optional[str] = None

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    home_station_id: Optional[str] = None
    work_station_id: Optional[str] = None

class ProfileResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    home_station_id: Optional[str] = None
    work_station_id: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None
    role: Optional[str] = "authenticated"
    user_metadata: Optional[Dict[str, Any]] = None
