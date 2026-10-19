"""Run from backend: python -m app.scripts.setup_safe_commute."""
from sqlalchemy import text

from app.database import engine
from app.models.profile import Profile  # Register existing foreign-key targets.
from app.models.station import Station
from app.models.commute_trip import CommuteTrip, CommuteTripMember


def setup_safe_commute():
    # Only create the two new tables; existing tables and data are untouched.
    with engine.begin() as connection:
        CommuteTrip.__table__.create(connection, checkfirst=True)
        CommuteTripMember.__table__.create(connection, checkfirst=True)
        # Access goes through authenticated FastAPI endpoints using the backend DB role.
        # No direct Supabase anon/authenticated access policies are granted.
        connection.execute(text("ALTER TABLE commute_trips ENABLE ROW LEVEL SECURITY"))
        connection.execute(text("ALTER TABLE commute_trip_members ENABLE ROW LEVEL SECURITY"))
    print("SafeCommute tables are ready.")


if __name__ == "__main__":
    setup_safe_commute()
