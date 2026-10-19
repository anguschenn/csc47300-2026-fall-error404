"""API checks with isolated in-memory storage; no Supabase data is accessed."""
import unittest
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.auth import get_current_user
from app.database import get_db
from app.main import app
from app.models.commute_trip import CommuteTrip, CommuteTripMember
from app.models.profile import Profile
from app.models.station import Station
from app.schemas.profile import CurrentUser


@compiles(ARRAY, "sqlite")
def compile_test_array(element, compiler, **kwargs):
    return "TEXT"


def restore_timezone(target, context, attrs=None):
    # SQLite discards timezone information; PostgreSQL preserves these UTC instants.
    for field in ("meetup_at", "meetup_end_at"):
        value = getattr(target, field)
        if value.tzinfo is None:
            setattr(target, field, value.replace(tzinfo=timezone.utc))


event.listen(CommuteTrip, "load", restore_timezone)
event.listen(CommuteTrip, "refresh", restore_timezone)


class SafeCommuteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        with self.engine.begin() as connection:
            connection.execute(text("PRAGMA foreign_keys=ON"))
            for table in (Station.__table__, Profile.__table__, CommuteTrip.__table__, CommuteTripMember.__table__):
                table.create(connection)
            for station_id, name in (("A", "First station"), ("B", "Second station")):
                connection.execute(text(
                    "INSERT INTO stations (id, name, borough, lines, latitude, longitude, ada) "
                    "VALUES (:id, :name, 'Manhattan', '[]', 40.7, -74, 0)"
                ), {"id": station_id, "name": name})
        self.creator = CurrentUser(id=str(uuid4()), email="creator@example.com", user_metadata={"display_name": "Alex"})
        self.rider = CurrentUser(id=str(uuid4()), email="rider@example.com", user_metadata={"display_name": "Sam"})
        self.current_user = self.creator

        def database():
            with Session(self.engine) as session:
                yield session

        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_user] = lambda: self.current_user
        self.client = TestClient(app)
        start = datetime.now(timezone.utc) + timedelta(hours=2)
        self.payload = {
            "departure_station_id": "A", "destination_station_id": "B",
            "meetup_at": start.isoformat(), "meetup_end_at": (start + timedelta(minutes=15)).isoformat(),
        }

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def publish(self):
        response = self.client.post("/api/v1/commute-trips", json=self.payload)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_publish_list_join_leave_and_repeat_requests(self):
        trip = self.publish()
        self.assertEqual(trip["creator"], {"id": self.creator.id, "display_name": "Alex"})
        self.assertEqual(trip["departure_station"]["name"], "First station")
        self.assertEqual([person["id"] for person in trip["participants"]], [self.creator.id])
        self.current_user = self.rider
        listed = self.client.get("/api/v1/commute-trips").json()
        self.assertEqual(listed[0]["id"], trip["id"])
        endpoint = f'/api/v1/commute-trips/{trip["id"]}/membership'
        for _ in range(2):
            joined = self.client.put(endpoint)
            self.assertEqual(joined.status_code, 200, joined.text)
            self.assertEqual(len(joined.json()["participants"]), 2)
            self.assertIn({"id": self.rider.id, "display_name": "Sam"}, joined.json()["participants"])
        for _ in range(2):
            left = self.client.delete(endpoint)
            self.assertEqual(left.status_code, 200, left.text)
            self.assertEqual(len(left.json()["participants"]), 1)
        self.assertNotIn("email", str(self.client.get("/api/v1/commute-trips").json()))

    def test_validates_stations_time_window_and_server_owned_identity(self):
        cases = [
            ({"destination_station_id": "A"}, 422),
            ({"destination_station_id": "missing"}, 400),
            ({"meetup_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}, 422),
            ({"meetup_end_at": self.payload["meetup_at"]}, 422),
            ({"meetup_at": "2027-01-01T12:00:00"}, 422),
            ({"creator_id": self.rider.id}, 422),
        ]
        for changes, expected in cases:
            with self.subTest(changes=changes):
                response = self.client.post("/api/v1/commute-trips", json={**self.payload, **changes})
                self.assertEqual(response.status_code, expected, response.text)

    def test_expired_trips_are_hidden_and_membership_is_closed(self):
        trip = self.publish()
        with Session(self.engine) as session:
            stored = session.get(CommuteTrip, UUID(trip["id"]))
            stored.meetup_at = datetime.now(timezone.utc) - timedelta(hours=2)
            stored.meetup_end_at = datetime.now(timezone.utc) - timedelta(hours=1)
            session.commit()
        self.assertEqual(self.client.get("/api/v1/commute-trips").json(), [])
        endpoint = f'/api/v1/commute-trips/{trip["id"]}/membership'
        self.assertEqual(self.client.put(endpoint).status_code, 409)
        self.assertEqual(self.client.delete(endpoint).status_code, 409)

    def test_unknown_trip_returns_404(self):
        self.assertEqual(self.client.put(f"/api/v1/commute-trips/{uuid4()}/membership").status_code, 404)

    def test_all_endpoints_require_login(self):
        del app.dependency_overrides[get_current_user]
        endpoint = f"/api/v1/commute-trips/{uuid4()}/membership"
        for method, path in (("GET", "/api/v1/commute-trips"), ("POST", "/api/v1/commute-trips"), ("PUT", endpoint), ("DELETE", endpoint)):
            with self.subTest(method=method):
                response = self.client.request(method, path, json=self.payload if method == "POST" else None)
                self.assertEqual(response.status_code, 401, response.text)


if __name__ == "__main__":
    unittest.main()
