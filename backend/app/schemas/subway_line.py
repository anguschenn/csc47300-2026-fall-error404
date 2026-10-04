from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class SubwayLineResponse(BaseModel):
    id: str
    name: Optional[str] = None
    color: str
    geometry: Dict[str, Any]

    class Config:
        from_attributes = True

class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    properties: Dict[str, Any]
    geometry: Dict[str, Any]

class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]
