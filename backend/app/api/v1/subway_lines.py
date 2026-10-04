from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.subway_line import SubwayLine
from app.schemas.subway_line import SubwayLineResponse, GeoJSONFeatureCollection

router = APIRouter()

@router.get("", response_model=List[SubwayLineResponse])
def get_subway_lines(db: Session = Depends(get_db)):
    """
    Returns all MTA subway service lines with track geometries.
    """
    return db.query(SubwayLine).order_by(SubwayLine.id.asc()).all()

@router.get("/geojson", response_model=GeoJSONFeatureCollection)
def get_subway_lines_geojson(db: Session = Depends(get_db)):
    """
    Returns subway service line tracks formatted as a standard GeoJSON FeatureCollection,
    optimized for direct consumption by Leaflet, Mapbox, or other mapping libraries.
    """
    lines = db.query(SubwayLine).order_by(SubwayLine.id.asc()).all()
    features = [
        {
            "type": "Feature",
            "properties": {
                "id": line.id,
                "service": line.id,  # Friendly alias
                "name": line.name,
                "color": line.color,
            },
            "geometry": line.geometry,
        }
        for line in lines
    ]
    return {"type": "FeatureCollection", "features": features}

@router.get("/{line_id}", response_model=SubwayLineResponse)
def get_subway_line(line_id: str, db: Session = Depends(get_db)):
    """
    Returns a single subway line by ID.
    """
    line = db.query(SubwayLine).filter(SubwayLine.id == line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Subway line not found")
    return line
