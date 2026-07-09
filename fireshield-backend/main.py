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
import csv
import os
import time
import io

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
    EnsembleRequest,
    EnsembleResponse,
)
from region_data import (
    GRID_SIZE,
    generate_elevation_map,
    generate_vegetation_map,
    get_points_of_interest,
    get_bounds,
)
from simulation import calculate_risk_score, run_cellular_automaton, grid_to_polygons, run_ensemble
from resource_allocation import allocate_resources


vegetation_map: np.ndarray | None = None
elevation_map: np.ndarray | None = None
points_of_interest = []
resource_bases = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global vegetation_map, elevation_map, points_of_interest, resource_bases
    vegetation_map = generate_vegetation_map()
    elevation_map = generate_elevation_map()
    points_of_interest = get_points_of_interest()
    try:
        with open("data/resource_bases.json", "r") as f:
            resource_bases = json.load(f)
    except Exception:
        resource_bases = []
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
        return {"error": str(e)}

# Cache for FIRMS data (dict of "data" and "timestamp")
firms_cache = {"data": None, "timestamp": 0.0}

@app.get("/api/active-fires")
def get_active_fires():
    global firms_cache
    
    # Cache for 15 minutes (900 seconds)
    if firms_cache["data"] is not None and (time.time() - firms_cache["timestamp"] < 900):
        return firms_cache["data"]

    firms_key = os.getenv("FIRMS_MAP_KEY")
    if not firms_key:
        return {"error": "FIRMS_MAP_KEY is missing"}

    bounds = get_bounds()
    if not bounds:
        return {"error": "Region bounds not available"}
        
    west, south, east, north = bounds["west"], bounds["south"], bounds["east"], bounds["north"]
    # Expand slightly just in case
    west -= 0.5
    east += 0.5
    south -= 0.5
    north += 0.5
    
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{firms_key}/VIIRS_SNPP_NRT/{west},{south},{east},{north}/1"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'FireShieldHackathonApp/1.0'})
        with urllib.request.urlopen(req, timeout=15) as response:
            csv_data = response.read().decode("utf-8")
            
        reader = csv.DictReader(io.StringIO(csv_data))
        fires = []
        for row in reader:
            fires.append({
                "lat": float(row["latitude"]),
                "lng": float(row["longitude"]),
                "confidence": row.get("confidence", "nominal"),
                "brightness": float(row.get("bright_ti4", 0)),
                "acquired_at": f"{row.get('acq_date', '')}T{row.get('acq_time', '')}Z"
            })
            
        firms_cache["data"] = fires
        firms_cache["timestamp"] = time.time()
        
        return fires
    except Exception as e:
        return {"error": str(e)}


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

    state_grids = run_cellular_automaton(
        request.ignition_x,
        request.ignition_y,
        request.wind_speed,
        request.wind_direction,
        request.humidity,
        request.time_steps,
        vegetation_map,
        elevation_map,
    )
    
    # Convert state grids to polygons
    bounds = get_bounds()
    time_steps_data = []
    for state_grid in state_grids:
        polygons = grid_to_polygons(state_grid, bounds)
        time_steps_data.append(polygons)

    final_risk_score, risk_factors = calculate_risk_score(
        vegetation_map,
        elevation_map,
        request.ignition_x,
        request.ignition_y,
        request.wind_speed,
        request.humidity,
        points_of_interest,
    )

    # Approximate cells burnt from the final state grid
    total_cells_burnt = int(np.sum(state_grids[-1] > 0))

    return SimulateResponse(
        grid_size=GRID_SIZE,
        time_steps_data=time_steps_data,
        final_risk_score=final_risk_score,
        risk_factors=risk_factors,
        total_cells_burnt=total_cells_burnt,
        ignition_x=request.ignition_x,
        ignition_y=request.ignition_y,
    )


@app.post("/simulate-ensemble", response_model=EnsembleResponse)
def simulate_ensemble(request: EnsembleRequest) -> EnsembleResponse:
    if vegetation_map is None or elevation_map is None:
        raise HTTPException(status_code=503, detail="Region data is not initialized.")

    _validate_coordinates(request.ignition_x, request.ignition_y)

    prob_grid = run_ensemble(
        request.ignition_x,
        request.ignition_y,
        request.wind_speed,
        request.wind_direction,
        request.humidity,
        request.time_steps,
        vegetation_map,
        elevation_map,
        request.n_runs
    )

    # Calculate mean confidence percent (average of cells that burned at least once)
    burned_any = prob_grid > 0
    if np.any(burned_any):
        mean_confidence = int(np.mean(prob_grid[burned_any]) * 100)
    else:
        mean_confidence = 0
        
    high_confidence_cells = int(np.sum(prob_grid > 0.7))

    return EnsembleResponse(
        grid_size=GRID_SIZE,
        probability_grid=prob_grid.tolist(),
        mean_confidence_percent=mean_confidence,
        high_confidence_cells=high_confidence_cells,
        n_runs=request.n_runs,
    )


@app.post("/incident-commander", response_model=IncidentCommanderResponse)
def incident_commander(
    request: IncidentCommanderRequest,
) -> IncidentCommanderResponse:
    try:
        import math
        # Reconstruct enriched POIs for allocation
        enriched_pois = []
        for poi in request.points_of_interest:
            px = poi.get("x", 25)
            py = poi.get("y", 25)
            dist_cells = math.hypot(px - request.ignition_x, py - request.ignition_y)
            dist_meters = round(dist_cells * 160)
            
            if dist_meters < 800:
                threat = "Critical"
            elif dist_meters < 1800:
                threat = "High"
            else:
                threat = "Low"
                
            enriched = dict(poi)
            enriched["distance_meters"] = dist_meters
            enriched["threat_level"] = threat
            enriched_pois.append(enriched)
            
        allocation = allocate_resources(enriched_pois, resource_bases)
        
        recommendation = get_incident_commander_recommendation(
            request.risk_score,
            request.risk_factors,
            request.total_cells_burnt,
            request.points_of_interest,
            request.ignition_x,
            request.ignition_y,
            mean_confidence_percent=75, # Fallback, ideally we'd pass this from frontend but signature assumes 75 if not provided
            resource_allocation=allocation
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
