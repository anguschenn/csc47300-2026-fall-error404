import sys
import time
import httpx
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models.subway_line import SubwayLine

NY_OPEN_DATA_LINES_URL = "https://data.ny.gov/resource/s692-irgq.json?$limit=100"
NY_OPEN_DATA_COLORS_URL = "https://data.ny.gov/resource/3uhz-sej2.json?$limit=100"
MIN_LINES_THRESHOLD = 10  # Circuit breaker threshold (expected ~27-29 lines)

FALLBACK_COLOR_MAP = {
    "1": "#D82233", "2": "#D82233", "3": "#D82233",
    "4": "#009952", "5": "#009952", "6": "#009952",
    "7": "#9A38A1",
    "A": "#0062CF", "C": "#0062CF", "E": "#0062CF",
    "B": "#EB6800", "D": "#EB6800", "F": "#EB6800", "M": "#EB6800",
    "N": "#FFE033", "Q": "#FFE033", "R": "#FFE033", "W": "#FFE033",
    "G": "#799534",
    "J": "#8E5C33", "Z": "#8E5C33",
    "L": "#7C858C",
    "S": "#7C858C", "SF": "#7C858C", "SR": "#7C858C", "ST": "#7C858C",
    "SIR": "#08179C",
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

    raise RuntimeError(f"Failed to fetch data from {url} after {max_attempts} attempts: {last_err}")

def fetch_official_mta_colors() -> dict:
    """
    Fetches official MTA color specifications from New York State Open Data
    Dataset: 'MTA Colors' (https://data.ny.gov/resource/3uhz-sej2.json)
    """
    try:
        records = fetch_with_retry(NY_OPEN_DATA_COLORS_URL, max_attempts=2, timeout=15.0)
        color_map = {}
        for row in records:
            hex_color = row.get("hex_color", "").strip()
            service_group = row.get("service", "").strip()
            operator = row.get("operator", "")

            if not hex_color or not service_group:
                continue

            if "Staten Island" in operator or "Staten Island" in service_group:
                color_map["SIR"] = hex_color
                continue

            for route in service_group.split(","):
                clean_route = route.strip().upper()
                if clean_route:
                    color_map[clean_route] = hex_color
                    if clean_route == "S":
                        color_map["SF"] = hex_color
                        color_map["SR"] = hex_color
                        color_map["ST"] = hex_color

        # Retain lighter canary yellow for N, Q, R, W on OpenStreetMap tiles
        for yellow_line in ["N", "Q", "R", "W"]:
            color_map[yellow_line] = "#FFE033"

        print(f"[INFO] Fetched {len(color_map)} official route colors from NY State Open Data.")
        return color_map

    except Exception as err:
        print(f"[WARN] Could not fetch MTA Colors API ({err}). Using fallback color map.")
        return FALLBACK_COLOR_MAP

def round_coords(coords):
    if isinstance(coords, (float, int)):
        return round(float(coords), 5)
    return [round_coords(c) for c in coords]

def seed_subway_lines(db: Session = None, recreate_table: bool = True):
    """
    Ingests official MTA Subway Service Line track vectors and color specifications
    from New York State Open Data APIs and synchronizes them into Supabase PostgreSQL.

    Fault-tolerant: Validates all external network data in memory BEFORE touching the database.
    """
    # 1. Fetch & Validate from External APIs first
    print("1. Fetching official MTA colors...")
    color_map = fetch_official_mta_colors()

    print("2. Fetching official MTA subway service line tracks from NY State Open Data...")
    try:
        records = fetch_with_retry(NY_OPEN_DATA_LINES_URL)
    except Exception as fetch_err:
        print(f"[ERROR] Sync aborted. Could not fetch subway line tracks: {fetch_err}")
        print("[INFO] Existing database records were left untouched.")
        raise fetch_err

    # 2. Circuit Breaker validation
    if len(records) < MIN_LINES_THRESHOLD:
        err_msg = (
            f"[ERROR] API returned only {len(records)} line records (below safety threshold of {MIN_LINES_THRESHOLD}). "
            "Aborting sync to prevent data loss or corruption."
        )
        print(err_msg)
        raise ValueError(err_msg)

    print(f"Validated {len(records)} line vector records. Processing and aggregating...")

    # Aggregate records by route identifier to unify multi-branch lines (e.g. A and C)
    services_map = {}
    for item in records:
        service = item.get("service")
        if not service:
            continue

        the_geom = item.get("geometry") or item.get("the_geom")
        if not the_geom or "coordinates" not in the_geom:
            continue

        line_id = service.strip()
        clean_coords = round_coords(the_geom.get("coordinates", []))
        base_key = line_id.replace(" Peak", "").strip().upper()
        line_color = color_map.get(base_key, FALLBACK_COLOR_MAP.get(base_key, "#808183"))

        if line_id not in services_map:
            services_map[line_id] = {
                "id": line_id,
                "name": item.get("service_name"),
                "color": line_color,
                "coordinates": list(clean_coords),
            }
        else:
            services_map[line_id]["coordinates"].extend(clean_coords)

    # 3. Database mutation only after data is 100% verified
    should_close_db = False
    if db is None:
        db = SessionLocal()
        should_close_db = True

    try:
        if recreate_table:
            print("Rebuilding 'subway_lines' table...")
            SubwayLine.__table__.drop(bind=engine, checkfirst=True)
            Base.metadata.create_all(bind=engine)
        else:
            Base.metadata.create_all(bind=engine)

        upserted_count = 0
        for line_id, data in services_map.items():
            optimized_geometry = {
                "type": "MultiLineString",
                "coordinates": data["coordinates"]
            }

            existing = db.query(SubwayLine).filter(SubwayLine.id == line_id).first()
            if existing:
                existing.name = data["name"]
                existing.color = data["color"]
                existing.geometry = optimized_geometry
            else:
                new_line = SubwayLine(
                    id=line_id,
                    name=data["name"],
                    color=data["color"],
                    geometry=optimized_geometry
                )
                db.add(new_line)

            upserted_count += 1

        db.commit()
        print(f"[SUCCESS] Synchronized {upserted_count} MTA subway lines into Supabase.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Database transaction failed, rolling back changes: {e}")
        raise e
    finally:
        if should_close_db:
            db.close()

if __name__ == "__main__":
    recreate = "--no-recreate" not in sys.argv
    seed_subway_lines(recreate_table=recreate)

