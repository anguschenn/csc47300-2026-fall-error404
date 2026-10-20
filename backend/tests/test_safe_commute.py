"""API checks with isolated in-memory storage; no Supabase data is accessed."""
import unittest
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import JSON, create_engine, event, text
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
from app.api.v1.commute_trips import trip_status
from types import SimpleNamespace


@compiles(ARRAY, "sqlite")
def compile_test_array(element, compiler, **kwargs):
    return "TEXT"


def restore_timezone(target, context, attrs=None):
    # SQLite discards timezone information; PostgreSQL preserves these UTC instants.
    for field in ("meetup_at", "meetup_end_at", "cancelled_at"):
        value = getattr(target, field)
        if value is not None and value.tzinfo is None:
            setattr(target, field, value.replace(tzinfo=timezone.utc))


event.listen(CommuteTrip, "load", restore_timezone)
event.listen(CommuteTrip, "refresh", restore_timezone)


class SafeCommuteTests(unittest.TestCase):
    def setUp(self):
        # PostgreSQL arrays use JSON in the isolated SQLite tests so line membership is real data.
        array_adapter = patch.object(Station.__table__.c.lines, "type", JSON())
        array_adapter.start()
        self.addCleanup(array_adapter.stop)
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        with self.engine.begin() as connection:
            connection.execute(text("PRAGMA foreign_keys=ON"))
            for table in (Station.__table__, Profile.__table__, CommuteTrip.__table__, CommuteTripMember.__table__):
                table.create(connection)
            for station_id, name, lines in (("A", "First station", ["4", "6"]), ("B", "Second station", ["6"]), ("C", "Other line station", ["4"])):
                connection.execute(text(
                    "INSERT INTO stations (id, name, borough, lines, latitude, longitude, ada) "
                    "VALUES (:id, :name, 'Manhattan', :lines, 40.7, -74, 0)"
                ), {"id": station_id, "name": name, "lines": json.dumps(lines)})
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
            "train_line": "6",
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
        self.assertEqual(trip["train_line"], "6")
        self.assertEqual([person["id"] for person in trip["participants"]], [self.creator.id])
        self.current_user = self.rider
        listed = self.client.get("/api/v1/commute-trips").json()
        self.assertEqual(listed[0]["id"], trip["id"])
        self.assertEqual(listed[0]["train_line"], "6")
        endpoint = f'/api/v1/commute-trips/{trip["id"]}/membership'
        for _ in range(2):
            joined = self.client.put(endpoint)
            self.assertEqual(joined.status_code, 200, joined.text)
            self.assertEqual(len(joined.json()["participants"]), 2)
            self.assertEqual(joined.json()["train_line"], "6")
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

    def test_expired_trips_are_completed_and_membership_is_closed(self):
        trip = self.publish()
        with Session(self.engine) as session:
            stored = session.get(CommuteTrip, UUID(trip["id"]))
            stored.meetup_at = datetime.now(timezone.utc) - timedelta(hours=2)
            stored.meetup_end_at = datetime.now(timezone.utc) - timedelta(hours=1)
            session.commit()
        completed = self.client.get("/api/v1/commute-trips").json()
        self.assertEqual(completed[0]["id"], trip["id"])
        self.assertEqual(completed[0]["status"], "completed")
        endpoint = f'/api/v1/commute-trips/{trip["id"]}/membership'
        self.assertEqual(self.client.put(endpoint).status_code, 409)
        self.assertEqual(self.client.delete(endpoint).status_code, 409)

    def test_unknown_trip_returns_404(self):
        self.assertEqual(self.client.put(f"/api/v1/commute-trips/{uuid4()}/membership").status_code, 404)

    def test_rejects_stations_outside_chosen_line(self):
        for changes in ({"destination_station_id": "C"}, {"train_line": "4"}, {"train_line": "NOT-A-LINE"}):
            with self.subTest(changes=changes):
                response = self.client.post("/api/v1/commute-trips", json={**self.payload, **changes})
                self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(self.client.get("/api/v1/commute-trips").json(), [])

    def test_line_is_required_and_normalized(self):
        missing = {key: value for key, value in self.payload.items() if key != "train_line"}
        self.assertEqual(self.client.post("/api/v1/commute-trips", json=missing).status_code, 422)
        self.assertEqual(self.client.post("/api/v1/commute-trips", json={**self.payload, "train_line": " "}).status_code, 422)
        response = self.client.post("/api/v1/commute-trips", json={**self.payload, "train_line": " 6 "})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["train_line"], "6")

    def test_old_trips_without_a_chosen_line_remain_visible(self):
        trip = self.publish()
        with Session(self.engine) as session:
            stored = session.get(CommuteTrip, UUID(trip["id"]))
            stored.train_line = None
            session.commit()
        response = self.client.get("/api/v1/commute-trips")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsNone(response.json()[0]["train_line"])

    def test_all_endpoints_require_login(self):
        del app.dependency_overrides[get_current_user]
        endpoint = f"/api/v1/commute-trips/{uuid4()}/membership"
        trip_endpoint = f"/api/v1/commute-trips/{uuid4()}"
        for method, path in (("GET", "/api/v1/commute-trips"), ("POST", "/api/v1/commute-trips"), ("PUT", endpoint), ("DELETE", endpoint), ("PUT", trip_endpoint), ("POST", trip_endpoint + "/cancel")):
            with self.subTest(method=method):
                response = self.client.request(method, path, json=self.payload if method in ("POST", "PUT") else None)
                self.assertEqual(response.status_code, 401, response.text)

    def test_status_boundaries_and_cancellation_precedence(self):
        start = datetime.now(timezone.utc)
        trip = SimpleNamespace(meetup_at=start, meetup_end_at=start + timedelta(minutes=15), cancelled_at=None)
        self.assertEqual(trip_status(trip, start - timedelta(seconds=1)), "upcoming")
        self.assertEqual(trip_status(trip, start), "meeting_now")
        self.assertEqual(trip_status(trip, trip.meetup_end_at), "completed")
        trip.cancelled_at = start
        self.assertEqual(trip_status(trip, trip.meetup_end_at + timedelta(days=1)), "cancelled")

    def test_creator_can_edit_and_membership_is_preserved(self):
        trip = self.publish()
        self.current_user = self.rider
        self.client.put(f'/api/v1/commute-trips/{trip["id"]}/membership')
        self.current_user = self.creator
        changes = {**self.payload, "train_line": "4", "destination_station_id": "C"}
        response = self.client.put(f'/api/v1/commute-trips/{trip["id"]}', json=changes)
        self.assertEqual(response.status_code, 200, response.text)
        updated = response.json()
        self.assertEqual(updated["train_line"], "4")
        self.assertEqual(updated["destination_station"]["id"], "C")
        self.assertEqual(updated["creator"]["id"], self.creator.id)
        self.assertEqual(len(updated["participants"]), 2)
        self.assertEqual(updated["status"], "upcoming")

    def test_other_riders_cannot_edit_or_cancel(self):
        trip = self.publish()
        self.current_user = self.rider
        endpoint = f'/api/v1/commute-trips/{trip["id"]}'
        self.assertEqual(self.client.put(endpoint, json=self.payload).status_code, 403)
        self.assertEqual(self.client.post(endpoint + "/cancel").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/commute-trips").json()[0]["status"], "upcoming")

    def test_cancel_retains_trip_and_riders_and_is_idempotent(self):
        trip = self.publish()
        self.current_user = self.rider
        membership = f'/api/v1/commute-trips/{trip["id"]}/membership'
        self.client.put(membership)
        self.current_user = self.creator
        endpoint = f'/api/v1/commute-trips/{trip["id"]}'
        cancelled = self.client.post(endpoint + "/cancel")
        self.assertEqual(cancelled.status_code, 200, cancelled.text)
        self.assertEqual(cancelled.json()["status"], "cancelled")
        self.assertEqual(len(cancelled.json()["participants"]), 2)
        repeated = self.client.post(endpoint + "/cancel").json()
        self.assertEqual(repeated["cancelled_at"], cancelled.json()["cancelled_at"])
        self.assertEqual(self.client.get("/api/v1/commute-trips").json()[0]["status"], "cancelled")
        self.assertEqual(self.client.put(endpoint, json=self.payload).status_code, 409)
        self.assertEqual(self.client.put(membership).status_code, 409)
        self.assertEqual(self.client.delete(membership).status_code, 409)

    def test_edit_checks_line_membership_and_future_times(self):
        trip = self.publish()
        endpoint = f'/api/v1/commute-trips/{trip["id"]}'
        self.assertEqual(self.client.put(endpoint, json={**self.payload, "destination_station_id": "C"}).status_code, 400)
        self.assertEqual(self.client.put(endpoint, json={**self.payload, "meetup_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}).status_code, 422)
        self.assertEqual(self.client.get("/api/v1/commute-trips").json()[0]["destination_station"]["id"], "B")

    def test_meeting_trip_cannot_be_edited_but_can_be_cancelled(self):
        trip = self.publish()
        with Session(self.engine) as session:
            stored = session.get(CommuteTrip, UUID(trip["id"]))
            stored.meetup_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            stored.meetup_end_at = datetime.now(timezone.utc) + timedelta(minutes=14)
            session.commit()
        endpoint = f'/api/v1/commute-trips/{trip["id"]}'
        self.assertEqual(self.client.get("/api/v1/commute-trips").json()[0]["status"], "meeting_now")
        self.assertEqual(self.client.put(endpoint, json=self.payload).status_code, 409)
        self.assertEqual(self.client.post(endpoint + "/cancel").status_code, 200)

    def test_completed_trip_cannot_be_edited_or_cancelled(self):
        trip = self.publish()
        with Session(self.engine) as session:
            stored = session.get(CommuteTrip, UUID(trip["id"]))
            stored.meetup_at = datetime.now(timezone.utc) - timedelta(hours=2)
            stored.meetup_end_at = datetime.now(timezone.utc) - timedelta(hours=1)
            session.commit()
        endpoint = f'/api/v1/commute-trips/{trip["id"]}'
        self.assertEqual(self.client.put(endpoint, json=self.payload).status_code, 409)
        self.assertEqual(self.client.post(endpoint + "/cancel").status_code, 409)

    def test_unknown_edit_and_cancel_return_404(self):
        endpoint = f"/api/v1/commute-trips/{uuid4()}"
        self.assertEqual(self.client.put(endpoint, json=self.payload).status_code, 404)
        self.assertEqual(self.client.post(endpoint + "/cancel").status_code, 404)


if __name__ == "__main__":
    unittest.main()
