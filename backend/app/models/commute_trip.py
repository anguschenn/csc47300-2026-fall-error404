from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class CommuteTrip(Base):
    __tablename__ = "commute_trips"
    __table_args__ = (
        CheckConstraint("departure_station_id <> destination_station_id"),
        CheckConstraint("meetup_end_at > meetup_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    departure_station_id = Column(String, ForeignKey("stations.id"), nullable=False)
    destination_station_id = Column(String, ForeignKey("stations.id"), nullable=False)
    meetup_at = Column(DateTime(timezone=True), nullable=False, index=True)
    meetup_end_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    creator = relationship("Profile")
    departure_station = relationship("Station", foreign_keys=[departure_station_id])
    destination_station = relationship("Station", foreign_keys=[destination_station_id])
    members = relationship("CommuteTripMember", cascade="all, delete-orphan")


class CommuteTripMember(Base):
    __tablename__ = "commute_trip_members"

    trip_id = Column(UUID(as_uuid=True), ForeignKey("commute_trips.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), primary_key=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    profile = relationship("Profile")
