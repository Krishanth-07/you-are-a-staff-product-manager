from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - dependency check happens in the environment
    load_dotenv = None

import urllib.request
import json

if load_dotenv is not None:
    load_dotenv()
    print("[dotenv] loaded environment variables from .env if present")
else:
    print("[dotenv] python-dotenv is not installed; skipping .env load")

from ai_layer import (
    ask_ai,
    generate_incident_report,
    generate_public_alerts,
    get_incident_commander_recommendation,
)
from models import (
    AlertRequest,
    AlertResponse,
    AskAIRequest,
    AskAIResponse,
    IncidentCommanderRequest,
    IncidentCommanderResponse,
    IncidentReportRequest,
    IncidentReportResponse,
    RegionDataResponse,
    SimulateRequest,
    SimulateResponse,
)
from region_data import (
    GRID_SIZE,
    generate_elevation_map,
    generate_vegetation_map,
    get_points_of_interest,
    get_bounds,
)
from simulation import calculate_risk_score, run_simulation


vegetation_map: np.ndarray | None = None
elevation_map: np.ndarray | None = None
points_of_interest = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global vegetation_map, elevation_map, points_of_interest
    vegetation_map = generate_vegetation_map()
    elevation_map = generate_elevation_map()
    points_of_interest = get_points_of_interest()
    yield


app = FastAPI(title="FireShield AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _validate_coordinates(x: int, y: int) -> None:
    if not (0 <= x < GRID_SIZE and 0 <= y < GRID_SIZE):
        raise HTTPException(
            status_code=400,
            detail=f"Coordinates must be between 0 and {GRID_SIZE - 1}.",
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/weather")
def get_live_weather():
    # Kotagiri coordinates
    lat = 11.4227
    lng = 76.8631
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=wind_speed_10m,wind_direction_10m,relative_humidity_2m"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'FireShieldHackathonApp/1.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            current = data.get("current", {})
            return {
                "wind_speed": current.get("wind_speed_10m", 15.0), # km/h
                "wind_direction": current.get("wind_direction_10m", 90.0), # degrees
                "humidity": current.get("relative_humidity_2m", 60.0) # percentage
            }
    except Exception as e:
        print(f"Failed to fetch live weather: {e}")
        raise HTTPException(status_code=503, detail="Live weather service unavailable.")


@app.get("/region-data", response_model=RegionDataResponse)
def get_region_data() -> RegionDataResponse:
    if vegetation_map is None or elevation_map is None:
        raise HTTPException(status_code=503, detail="Region data is not initialized.")

    return RegionDataResponse(
        grid_size=GRID_SIZE,
        points_of_interest=points_of_interest,
        bounds=get_bounds(),
    )


@app.post("/simulate", response_model=SimulateResponse)
def simulate(request: SimulateRequest) -> SimulateResponse:
    if vegetation_map is None or elevation_map is None:
        raise HTTPException(status_code=503, detail="Region data is not initialized.")

    _validate_coordinates(request.ignition_x, request.ignition_y)

    time_steps_data = run_simulation(
        request.ignition_x,
        request.ignition_y,
        request.wind_speed,
        request.wind_direction,
        request.humidity,
        request.time_steps,
        vegetation_map,
        elevation_map,
    )
    final_risk_score, risk_factors = calculate_risk_score(
        vegetation_map,
        elevation_map,
        request.ignition_x,
        request.ignition_y,
        request.wind_speed,
        request.humidity,
        points_of_interest,
    )

    # Approximate the area burnt based on the number of time steps and wind
    total_cells_burnt = int((request.time_steps ** 2) * (request.wind_speed / 10 + 1) * 10)

    return SimulateResponse(
        grid_size=GRID_SIZE,
        time_steps_data=time_steps_data,
        final_risk_score=final_risk_score,
        risk_factors=risk_factors,
        total_cells_burnt=total_cells_burnt,
        ignition_x=request.ignition_x,
        ignition_y=request.ignition_y,
    )


@app.post("/incident-commander", response_model=IncidentCommanderResponse)
def incident_commander(
    request: IncidentCommanderRequest,
) -> IncidentCommanderResponse:
    try:
        recommendation = get_incident_commander_recommendation(
            request.risk_score,
            request.risk_factors,
            request.total_cells_burnt,
            request.points_of_interest,
            request.ignition_x,
            request.ignition_y,
        )
        return IncidentCommanderResponse(**recommendation)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/public-alert", response_model=AlertResponse)
def public_alert(request: AlertRequest) -> AlertResponse:
    try:
        alerts = generate_public_alerts(
            request.evacuate_locations,
            request.safe_route,
            request.shelter_name,
            request.time_minutes,
        )
        return AlertResponse(**alerts)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/ask-ai", response_model=AskAIResponse)
def ask_ai_endpoint(request: AskAIRequest) -> AskAIResponse:
    try:
        answer = ask_ai(request.question, request.context)
        return AskAIResponse(answer=answer)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/incident-report", response_model=IncidentReportResponse)
def incident_report(request: IncidentReportRequest) -> IncidentReportResponse:
    try:
        report = generate_incident_report(
            request.simulation_data,
            request.incident_commander_data,
            request.logs,
        )
        return IncidentReportResponse(**report)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
