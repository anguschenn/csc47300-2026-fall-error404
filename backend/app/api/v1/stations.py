from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.station import Station
from app.schemas.station import StationResponse

router = APIRouter()

@router.get("", response_model=List[StationResponse])
def get_stations(
    line: Optional[str] = Query(None, description="Filter by subway line, e.g. '1', 'A', 'N'"),
    borough: Optional[str] = Query(None, description="Filter by borough, e.g. 'Manhattan'"),
    search: Optional[str] = Query(None, description="Search station name"),
    ada_accessible: Optional[bool] = Query(None, description="Filter for fully or partially accessible stations"),
    db: Session = Depends(get_db)
):
    """
    Returns all NYC subway stations with native PostgreSQL array filtering.
    """
    query = db.query(Station)

    if line:
        # Native PostgreSQL array containment query
        query = query.filter(Station.lines.any(line.upper()))
    if borough:
        query = query.filter(Station.borough.ilike(f"%{borough}%"))
    if search:
        query = query.filter(Station.name.ilike(f"%{search}%"))
    if ada_accessible is True:
        query = query.filter(Station.ada > 0)
    elif ada_accessible is False:
        query = query.filter(Station.ada == 0)

    stations = query.order_by(Station.name.asc()).all()
    return stations

@router.get("/{station_id}", response_model=StationResponse)
def get_station(station_id: str, db: Session = Depends(get_db)):
    """
    Returns a single station by its GTFS Stop ID.
    """
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station

