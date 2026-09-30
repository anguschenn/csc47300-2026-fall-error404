from sqlalchemy import Column, String, Float, Integer
from sqlalchemy.dialects.postgresql import ARRAY
from app.database import Base

class Station(Base):
    __tablename__ = "stations"

    # Canonical MTA GTFS Parent Station ID (e.g. '118' for 137 St, 'R01' for Astoria-Ditmars)
    id = Column(String, primary_key=True, index=True)
    complex_id = Column(String, nullable=True, index=True)  # Connects multi-line transfer hubs
    name = Column(String, index=True, nullable=False)
    borough = Column(String, index=True, nullable=False)
    lines = Column(ARRAY(String), nullable=False)           # PostgreSQL Native Array: ['N', 'W']
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    structure = Column(String, nullable=True)               # e.g. "Subway", "Elevated", "Open Cut"
    ada = Column(Integer, default=0, nullable=False)        # 0 = Not accessible, 1 = Fully accessible, 2 = Partially
    ada_notes = Column(String, nullable=True)               # e.g. "Uptown only", "Manhattan-bound only"

