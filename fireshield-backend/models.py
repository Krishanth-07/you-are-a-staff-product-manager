from pydantic import BaseModel


class SimulateRequest(BaseModel):
    ignition_x: int
    ignition_y: int
    wind_speed: float
    wind_direction: float
    humidity: float
    time_steps: int = 6


class RiskFactors(BaseModel):
    wind_speed: float
    humidity: float
    vegetation_density: str
    terrain: str
    nearby_settlements: bool


class SimulateResponse(BaseModel):
    grid_size: int
    time_steps_data: list[list[list[list[float]]]]  # List of time steps -> List of polygons -> List of points -> [lat, lng]
    final_risk_score: int
    risk_factors: RiskFactors
    total_cells_burnt: int
    ignition_x: int
    ignition_y: int


class EnsembleRequest(SimulateRequest):
    n_runs: int = 40


class EnsembleResponse(BaseModel):
    grid_size: int
    probability_grid: list[list[float]]
    contours: dict[str, list[list[list[float]]]]  # dict of "25", "50", "75" -> list of polygons -> list of points -> [lat, lng]
    mean_confidence_percent: int
    high_confidence_cells: int
    n_runs: int


class PointOfInterest(BaseModel):
    name: str
    type: str
    x: int
    y: int
    lat: float | None = None
    lng: float | None = None


class RegionDataResponse(BaseModel):
    grid_size: int
    points_of_interest: list[PointOfInterest]
    bounds: dict | None = None


class IncidentCommanderRequest(BaseModel):
    risk_score: int
    risk_factors: dict
    total_cells_burnt: int
    points_of_interest: list[dict]
    ignition_x: int
    ignition_y: int
    ensemble_confidence: int | None = None
    high_confidence_cells: int | None = None


class IncidentCommanderResponse(BaseModel):
    evacuate: list[dict]
    deploy_resources: list[dict]
    resource_allocation_top5: list[dict] = []
    road_closures: list[str]
    priority_protect: list[dict]
    confidence_percent: int
    cascading_risks: list[dict]
    containment_estimate_percent: int


class AlertRequest(BaseModel):
    evacuate_locations: list[str]
    safe_route: str
    shelter_name: str
    time_minutes: int


class AlertResponse(BaseModel):
    sms: dict
    whatsapp: dict
    press_release: dict


class AskAIRequest(BaseModel):
    question: str
    context: dict


class AskAIResponse(BaseModel):
    answer: str


class IncidentReportRequest(BaseModel):
    simulation_data: dict
    incident_commander_data: dict
    logs: list[str]


class IncidentReportResponse(BaseModel):
    incident_id: str
    summary: str
    timeline_narrative: str
    actions_taken: list[str]
    resources_deployed: str
    recommendation: str

class HistoricalPreset(BaseModel):
    id: str
    label: str
    description: str
    ignition_x: int
    ignition_y: int
    wind_speed: float
    wind_direction: float
    humidity: float
    time_steps: int

class HistoricalPresetsResponse(BaseModel):
    presets: list[HistoricalPreset]

