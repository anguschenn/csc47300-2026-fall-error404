from datetime import datetime, timezone
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


class CommuteTripCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    departure_station_id: str = Field(min_length=1, max_length=100)
    destination_station_id: str = Field(min_length=1, max_length=100)
    meetup_at: AwareDatetime
    meetup_end_at: AwareDatetime

    @model_validator(mode="after")
    def validate_trip(self):
        if self.departure_station_id == self.destination_station_id:
            raise ValueError("Choose different departure and destination stations.")
        if self.meetup_at <= datetime.now(timezone.utc):
            raise ValueError("Meetup time must be in the future.")
        if self.meetup_end_at <= self.meetup_at:
            raise ValueError("The meetup window must end after it starts.")
        return self


class CommutePerson(BaseModel):
    id: UUID
    display_name: str


class CommuteStation(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str


class CommuteTripResponse(BaseModel):
    id: UUID
    creator: CommutePerson
    departure_station: CommuteStation
    destination_station: CommuteStation
    meetup_at: datetime
    meetup_end_at: datetime
    participants: list[CommutePerson]
