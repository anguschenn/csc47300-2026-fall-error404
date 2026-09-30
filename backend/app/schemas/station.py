from pydantic import BaseModel
from typing import List, Optional

class StationBase(BaseModel):
    id: str
    complex_id: Optional[str] = None
    name: str
    borough: str
    lines: List[str]
    latitude: float
    longitude: float
    structure: Optional[str] = None
    ada: int = 0
    ada_notes: Optional[str] = None

class StationResponse(StationBase):
    class Config:
        from_attributes = True

