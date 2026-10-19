from datetime import datetime, timezone
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator


class CommuteTripCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    train_line: str = Field(min_length=1, max_length=16)
    departure_station_id: str = Field(min_length=1, max_length=100)
    destination_station_id: str = Field(min_length=1, max_length=100)
    meetup_at: AwareDatetime
    meetup_end_at: AwareDatetime

    @field_validator("train_line", mode="before")
    @classmethod
    def normalize_train_line(cls, value):
        return value.strip().upper() if isinstance(value, str) else value

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
    train_line: str | None = None
    departure_station: CommuteStation
    destination_station: CommuteStation
    meetup_at: datetime
    meetup_end_at: datetime
    participants: list[CommutePerson]
