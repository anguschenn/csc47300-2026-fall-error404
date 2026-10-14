from sqlalchemy import Column, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class Profile(Base):
    __tablename__ = "profiles"

    # UUID matching Supabase auth.users.id
    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(String, nullable=False, unique=True, index=True)
    full_name = Column(String, nullable=True)          # Real name (optional)
    display_name = Column(String, nullable=True)       # Public commuter handle (e.g. 'Alex M.')
    avatar_url = Column(String, nullable=True)         # Link to profile picture

    # Optional commuter station preferences
    home_station_id = Column(String, ForeignKey("stations.id"), nullable=True)
    work_station_id = Column(String, ForeignKey("stations.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
