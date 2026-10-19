from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.commute_trip import CommuteTrip, CommuteTripMember
from app.models.profile import Profile
from app.models.station import Station
from app.schemas.commute_trip import CommuteTripCreate, CommuteTripResponse
from app.schemas.profile import CurrentUser

router = APIRouter()


def commuter_profile(current_user, db):
    user_id = UUID(current_user.id)
    profile = db.get(Profile, user_id)
    if profile is None:
        metadata = current_user.user_metadata or {}
        profile = Profile(
            id=user_id,
            email=current_user.email or f"{user_id}@unknown.com",
            display_name=metadata.get("display_name") or metadata.get("full_name") or metadata.get("name") or "Commuter",
            full_name=metadata.get("full_name") or metadata.get("name"),
        )
        db.add(profile)
        db.flush()
    return profile


def person(profile):
    # Only public names are exposed to other riders, never email addresses.
    return {"id": profile.id, "display_name": profile.display_name or profile.full_name or "Commuter"}


def trip_response(trip):
    return {
        "id": trip.id,
        "creator": person(trip.creator),
        "train_line": trip.train_line,
        "departure_station": trip.departure_station,
        "destination_station": trip.destination_station,
        "meetup_at": trip.meetup_at,
        "meetup_end_at": trip.meetup_end_at,
        "participants": [person(member.profile) for member in sorted(
            trip.members, key=lambda member: (member.joined_at, str(member.user_id))
        )],
    }


@router.get("", response_model=list[CommuteTripResponse])
def list_trips(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trips = db.query(CommuteTrip).options(
        selectinload(CommuteTrip.creator),
        selectinload(CommuteTrip.departure_station),
        selectinload(CommuteTrip.destination_station),
        selectinload(CommuteTrip.members).selectinload(CommuteTripMember.profile),
    ).filter(CommuteTrip.meetup_end_at > datetime.now(timezone.utc)).order_by(
        CommuteTrip.meetup_at, CommuteTrip.id
    ).all()
    return [trip_response(trip) for trip in trips]


@router.post("", response_model=CommuteTripResponse, status_code=201)
def publish_trip(
    data: CommuteTripCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for station_id in (data.departure_station_id, data.destination_station_id):
        station = db.get(Station, station_id)
        if not station:
            raise HTTPException(400, "One of the selected stations no longer exists.")
        if data.train_line not in {line.strip().upper() for line in (station.lines or [])}:
            raise HTTPException(400, f"{station.name} is not served by the {data.train_line} train. Choose both stations on the selected line.")
    profile = commuter_profile(current_user, db)
    trip = CommuteTrip(creator_id=profile.id, **data.model_dump())
    db.add(trip)
    db.flush()
    # Publishing automatically joins the creator to their commute group.
    db.add(CommuteTripMember(trip_id=trip.id, user_id=profile.id))
    db.commit()
    db.refresh(trip)
    return trip_response(trip)


def change_membership(trip_id, current_user, db, joining):
    profile = commuter_profile(current_user, db)
    # Lock the parent row so simultaneous joins cannot create duplicate memberships.
    trip = db.query(CommuteTrip).filter(CommuteTrip.id == trip_id).with_for_update().first()
    if not trip:
        raise HTTPException(404, "Trip not found.")
    if trip.meetup_end_at <= datetime.now(timezone.utc):
        raise HTTPException(409, "This meetup window has ended. Refresh the trip list.")
    member = db.get(CommuteTripMember, (trip.id, profile.id))
    if joining and not member:
        db.add(CommuteTripMember(trip_id=trip.id, user_id=profile.id))
    elif not joining and member:
        db.delete(member)
    db.commit()
    db.refresh(trip)
    return trip_response(trip)


@router.put("/{trip_id}/membership", response_model=CommuteTripResponse)
def join_trip(
    trip_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return change_membership(trip_id, current_user, db, joining=True)


@router.delete("/{trip_id}/membership", response_model=CommuteTripResponse)
def leave_trip(
    trip_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return change_membership(trip_id, current_user, db, joining=False)
