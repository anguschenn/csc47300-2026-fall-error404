import sys
import time
import httpx
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models.station import Station

NY_OPEN_DATA_STATIONS_URL = "https://data.ny.gov/resource/39hk-dx4f.json?$limit=1000"
MIN_STATIONS_THRESHOLD = 50  # Safety circuit breaker to prevent wiping database on bad API payloads

BOROUGH_MAP = {
    "M": "Manhattan",
    "Bk": "Brooklyn",
    "B": "Brooklyn",
    "Q": "Queens",
    "Bx": "Bronx",
    "SI": "Staten Island",
}

def fetch_with_retry(url: str, max_attempts: int = 3, timeout: float = 30.0) -> list:
    """
    Fetches JSON array from external API with exponential backoff retries.
    """
    last_err = None
    with httpx.Client(timeout=timeout) as client:
        for attempt in range(1, max_attempts + 1):
            try:
                resp = client.get(url)
                resp.raise_for_status()
                data = resp.json()
                if not isinstance(data, list):
                    raise ValueError(f"Expected JSON array, received: {type(data).__name__}")
                return data
            except Exception as err:
                last_err = err
                if attempt < max_attempts:
                    delay = attempt * 2.0
                    print(f"[WARN] Attempt {attempt} failed ({err}). Retrying in {delay}s...")
                    time.sleep(delay)

    raise RuntimeError(f"Failed to fetch data from NYC Open Data after {max_attempts} attempts: {last_err}")

def seed_stations(db: Session = None, recreate_table: bool = False):
    """
    Ingests official NYC Subway station metadata from New York State Open Data
    and upserts them into the Supabase PostgreSQL database.

    Fault-tolerant: Verifies and validates external data in memory BEFORE touching the database.
    """
    # 1. Fetch & Validate from External API first (Fetch first, mutate second)
    print("1. Fetching official MTA stations from NY State Open Data...")
    try:
        raw_stations = fetch_with_retry(NY_OPEN_DATA_STATIONS_URL)
    except Exception as fetch_err:
        print(f"[ERROR] Sync aborted. Could not fetch stations: {fetch_err}")
        print("[INFO] Existing database records were left untouched.")
        raise fetch_err

    # 2. Circuit Breaker validation
    if len(raw_stations) < MIN_STATIONS_THRESHOLD:
        err_msg = (
            f"[ERROR] API returned only {len(raw_stations)} stations (below safety threshold of {MIN_STATIONS_THRESHOLD}). "
            "Aborting sync to prevent data loss or corruption."
        )
        print(err_msg)
        raise ValueError(err_msg)

    print(f"Validated {len(raw_stations)} station records. Preparing database transaction...")

    # 3. Database mutation only after data is 100% verified
    should_close_db = False
    if db is None:
        db = SessionLocal()
        should_close_db = True

    try:
        if recreate_table:
            print("Rebuilding 'stations' table...")
            Station.__table__.drop(bind=engine, checkfirst=True)
            Base.metadata.create_all(bind=engine)
        else:
            Base.metadata.create_all(bind=engine)

        upserted_count = 0
        for item in raw_stations:
            station_id = item.get("gtfs_stop_id") or item.get("station_id")
            if not station_id:
                continue

            raw_borough = item.get("borough", "").strip()
            clean_borough = BOROUGH_MAP.get(raw_borough, raw_borough or "NYC")

            name = item.get("stop_name", "").strip()
            lines_list = [r.strip() for r in item.get("daytime_routes", "").split() if r.strip()]

            lat = float(item.get("gtfs_latitude", 0.0))
            lng = float(item.get("gtfs_longitude", 0.0))
            structure = item.get("structure")

            raw_ada = item.get("ada", "0")
            ada_val = int(raw_ada) if raw_ada and raw_ada.isdigit() else 0

            raw_notes = item.get("ada_notes")
            ada_notes = raw_notes if raw_notes and raw_notes != "NaN" else None

            existing = db.query(Station).filter(Station.id == station_id).first()
            if existing:
                existing.complex_id = item.get("complex_id")
                existing.name = name
                existing.borough = clean_borough
                existing.lines = lines_list
                existing.latitude = lat
                existing.longitude = lng
                existing.structure = structure
                existing.ada = ada_val
                existing.ada_notes = ada_notes
            else:
                new_station = Station(
                    id=station_id,
                    complex_id=item.get("complex_id"),
                    name=name,
                    borough=clean_borough,
                    lines=lines_list,
                    latitude=lat,
                    longitude=lng,
                    structure=structure,
                    ada=ada_val,
                    ada_notes=ada_notes
                )
                db.add(new_station)

            upserted_count += 1

        db.commit()
        print(f"[SUCCESS] Synchronized {upserted_count} MTA subway stations into Supabase.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Database transaction failed, rolling back changes: {e}")
        raise e
    finally:
        if should_close_db:
            db.close()

if __name__ == "__main__":
    recreate = "--recreate" in sys.argv or "--drop" in sys.argv
    seed_stations(recreate_table=recreate)

