import math
import numpy as np
from models import PointOfInterest, RiskFactors
from region_data import GRID_SIZE

def grid_to_latlng(x: int, y: int, bounds: dict) -> tuple[float, float]:
    lat = bounds["south"] + (y / 49.0) * (bounds["north"] - bounds["south"])
    lng = bounds["west"] + (x / 49.0) * (bounds["east"] - bounds["west"])
    return lat, lng

def latlng_to_grid(lat: float, lng: float, bounds: dict) -> tuple[int, int]:
    y = int(round((lat - bounds["south"]) / (bounds["north"] - bounds["south"]) * 49.0))
    x = int(round((lng - bounds["west"]) / (bounds["east"] - bounds["west"]) * 49.0))
    x = max(0, min(49, x))
    y = max(0, min(49, y))
    return x, y

def generate_ellipse_polygon(
    center_lat: float,
    center_lng: float,
    major_axis: float,
    minor_axis: float,
    angle_deg: float,
    num_points: int = 32
) -> list[list[float]]:
    angle_rad = math.radians(angle_deg)
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)
    
    polygon = []
    for i in range(num_points):
        t = 2 * math.pi * i / num_points
        # unrotated ellipse points (Y is major axis)
        x = minor_axis * math.cos(t)
        y = major_axis * math.sin(t)
        
        # rotated
        rot_x = x * cos_a - y * sin_a
        rot_y = x * sin_a + y * cos_a
        
        polygon.append([center_lat + rot_y, center_lng + rot_x])
        
    return polygon

def run_simulation(
    ignition_x: int,
    ignition_y: int,
    wind_speed: float,
    wind_direction: float,
    humidity: float,
    time_steps: int,
    vegetation_map: np.ndarray,
    elevation_map: np.ndarray,
) -> list[list[list[float]]]:
    from region_data import get_bounds
    bounds = get_bounds()
    
    start_lat, start_lng = grid_to_latlng(ignition_x, ignition_y, bounds)
    snapshots = []
    
    # Vegetation at ignition affects overall scale
    veg_density = float(vegetation_map[ignition_y][ignition_x])
    
    # Base growth per step in degrees (roughly 0.0015 degrees ~ 160 meters)
    base_growth = 0.0015 * (0.5 + veg_density) * (1.0 - (humidity / 200.0))
    
    for step in range(1, time_steps + 1):
        # Fire drifts with wind
        drift_dist = step * base_growth * (wind_speed / 40.0)
        
        # Meteorological wind direction: degrees clockwise from North. 
        # Wind blowing FROM 90 (East) means it blows TOWARDS 270 (West).
        blow_rad = math.radians((wind_direction + 180) % 360)
        
        # math.sin(blow_rad) -> dx (East), math.cos(blow_rad) -> dy (North)
        center_lng = start_lng + drift_dist * math.sin(blow_rad)
        center_lat = start_lat + drift_dist * math.cos(blow_rad)
        
        major_axis = step * base_growth * (1.0 + (wind_speed / 30.0))
        minor_axis = step * base_growth * 1.0
        
        # Align major axis with wind direction
        polygon = generate_ellipse_polygon(
            center_lat, 
            center_lng, 
            major_axis, 
            minor_axis, 
            -wind_direction, 
            num_points=32
        )
        snapshots.append(polygon)
        
    return snapshots

def calculate_risk_score(
    vegetation_map: np.ndarray,
    elevation_map: np.ndarray,
    ignition_x: int,
    ignition_y: int,
    wind_speed: float,
    humidity: float,
    points_of_interest: list[PointOfInterest],
) -> tuple[int, RiskFactors]:
    vegetation_density_at_ignition = float(vegetation_map[ignition_y][ignition_x])

    if vegetation_density_at_ignition < 0.33:
        vegetation_density = "sparse"
    elif vegetation_density_at_ignition <= 0.66:
        vegetation_density = "moderate"
    else:
        vegetation_density = "dense"

    min_x = max(0, ignition_x - 5)
    max_x = min(GRID_SIZE, ignition_x + 6)
    min_y = max(0, ignition_y - 5)
    max_y = min(GRID_SIZE, ignition_y + 6)
    local_avg_elevation = float(np.mean(elevation_map[min_y:max_y, min_x:max_x]))
    ignition_elevation = float(elevation_map[ignition_y][ignition_x])

    if ignition_elevation > local_avg_elevation + 0.02:
        terrain = "uphill"
    elif ignition_elevation < local_avg_elevation - 0.02:
        terrain = "downhill"
    else:
        terrain = "flat"

    nearby_settlements = any(
        math.hypot(poi.x - ignition_x, poi.y - ignition_y) <= 10
        for poi in points_of_interest
    )

    risk_score = (
        (vegetation_density_at_ignition * 30)
        + ((wind_speed / 100) * 30)
        + (((100 - humidity) / 100) * 25)
        + (15 if nearby_settlements else 0)
    )
    risk_score = round(max(0, min(100, risk_score)))

    risk_factors = RiskFactors(
        wind_speed=wind_speed,
        humidity=humidity,
        vegetation_density=vegetation_density,
        terrain=terrain,
        nearby_settlements=nearby_settlements,
    )
    return risk_score, risk_factors
