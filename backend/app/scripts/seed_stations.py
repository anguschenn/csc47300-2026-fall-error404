import sys
import httpx
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models.station import Station

NY_OPEN_DATA_STATIONS_URL = "https://data.ny.gov/resource/39hk-dx4f.json?$limit=1000"

BOROUGH_MAP = {
    "M": "Manhattan",
    "Bk": "Brooklyn",
    "B": "Brooklyn",
    "Q": "Queens",
    "Bx": "Bronx",
    "SI": "Staten Island",
}

def seed_stations(db: Session = None, recreate_table: bool = False):
    """
    Ingests official NYC Subway station metadata from New York State Open Data
    and upserts them into the Supabase PostgreSQL database.

    Can be run as an initial database seed or periodically as a sync task.
    """
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

        print(f"Fetching official MTA stations from Open Data...")
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(NY_OPEN_DATA_STATIONS_URL)
            resp.raise_for_status()
            raw_stations = resp.json()

        print(f"Fetched {len(raw_stations)} station records. Synchronizing database...")

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
        print(f"Successfully synchronized {upserted_count} MTA subway stations to Supabase.")

    except Exception as e:
        db.rollback()
        print(f"Error during station synchronization: {e}")
        raise e
    finally:
        if should_close_db:
            db.close()

if __name__ == "__main__":
    recreate = "--recreate" in sys.argv or "--drop" in sys.argv
    seed_stations(recreate_table=recreate)

