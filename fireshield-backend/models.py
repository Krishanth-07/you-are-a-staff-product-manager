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
    time_steps_data: list[list[list[float]]]  # List of polygons, each polygon is a list of [lat, lng]
    final_risk_score: int
    risk_factors: RiskFactors
    total_cells_burnt: int
    ignition_x: int
    ignition_y: int


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


class IncidentCommanderResponse(BaseModel):
    evacuate: list[dict]
    deploy_resources: list[dict]
    road_closures: list[str]
    priority_protect: list[dict]
    confidence_percent: int
    cascading_risks: list[str]
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
    population_impact: str
    recommendation: str
