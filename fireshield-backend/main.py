from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ai_layer import (
    ask_ai,
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
    RegionDataResponse,
    SimulateRequest,
    SimulateResponse,
)
from region_data import (
    GRID_SIZE,
    generate_elevation_map,
    generate_vegetation_map,
    get_points_of_interest,
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


@app.get("/region-data", response_model=RegionDataResponse)
def get_region_data() -> RegionDataResponse:
    if vegetation_map is None or elevation_map is None:
        raise HTTPException(status_code=503, detail="Region data is not initialized.")

    return RegionDataResponse(
        grid_size=GRID_SIZE,
        vegetation_map=vegetation_map.tolist(),
        elevation_map=elevation_map.tolist(),
        points_of_interest=points_of_interest,
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

    final_step = time_steps_data[-1] if time_steps_data else []
    total_cells_burnt = sum(
        1 for cell in final_step if cell.status in {"burning", "burnt"}
    )

    return SimulateResponse(
        grid_size=GRID_SIZE,
        time_steps_data=time_steps_data,
        final_risk_score=final_risk_score,
        risk_factors=risk_factors,
        total_cells_burnt=total_cells_burnt,
    )


@app.post("/incident-commander", response_model=IncidentCommanderResponse)
def incident_commander(
    request: IncidentCommanderRequest,
) -> IncidentCommanderResponse:
    recommendation = get_incident_commander_recommendation(
        request.risk_score,
        request.risk_factors,
        request.total_cells_burnt,
        request.points_of_interest,
        request.ignition_x,
        request.ignition_y,
    )
    return IncidentCommanderResponse(**recommendation)


@app.post("/public-alert", response_model=AlertResponse)
def public_alert(request: AlertRequest) -> AlertResponse:
    alerts = generate_public_alerts(
        request.evacuate_locations,
        request.safe_route,
        request.shelter_name,
        request.time_minutes,
    )
    return AlertResponse(**alerts)


@app.post("/ask-ai", response_model=AskAIResponse)
def ask_ai_endpoint(request: AskAIRequest) -> AskAIResponse:
    answer = ask_ai(request.question, request.context)
    return AskAIResponse(answer=answer)
