from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base

class SubwayLine(Base):
    __tablename__ = "subway_lines"

    # Canonical MTA Route identifier (e.g., '1', '2', 'A', '5 Peak', 'SF', 'SIR')
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=True)     # e.g., 'Broadway / 7AV Local'
    color = Column(String, nullable=False)   # Official hex color code (e.g., '#D82233')
    geometry = Column(JSONB, nullable=False) # GeoJSON geometry: {"type": "MultiLineString", "coordinates": [...]}
