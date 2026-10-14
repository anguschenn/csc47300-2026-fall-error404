from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.api.v1.stations import router as stations_router
from app.api.v1.subway_lines import router as subway_lines_router
from app.api.v1.auth import router as auth_router

app = FastAPI(
    title="MetroPulse NYC API",
    description="Real-time transit tracker, community incident board, and commuter safety network.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register modular API routers
app.include_router(stations_router, prefix="/api/v1/stations", tags=["Stations"])
app.include_router(subway_lines_router, prefix="/api/v1/subway-lines", tags=["Subway Lines"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth & Profiles"])

@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "Backend is running!"}

@app.get("/api/db-check", tags=["Health"])
def db_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "message": "Successfully connected to Supabase PostgreSQL!"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Database connection failed: {str(e)}"
        }