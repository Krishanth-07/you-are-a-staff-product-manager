import math
import numpy as np
from skimage import measure
from models import PointOfInterest, RiskFactors
from region_data import GRID_SIZE

def grid_to_latlng(x: float, y: float, bounds: dict) -> tuple[float, float]:
    lat = float(bounds["south"] + (y / 49.0) * (bounds["north"] - bounds["south"]))
    lng = float(bounds["west"] + (x / 49.0) * (bounds["east"] - bounds["west"]))
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

def run_simulation_legacy(
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
    
    veg_density = float(vegetation_map[ignition_y][ignition_x])
    base_growth = 0.0015 * (0.5 + veg_density) * (1.0 - (humidity / 200.0))
    
    for step in range(1, time_steps + 1):
        drift_dist = step * base_growth * (wind_speed / 40.0)
        blow_rad = math.radians((wind_direction + 180) % 360)
        
        center_lng = start_lng + drift_dist * math.sin(blow_rad)
        center_lat = start_lat + drift_dist * math.cos(blow_rad)
        
        major_axis = step * base_growth * (1.0 + (wind_speed / 30.0))
        minor_axis = step * base_growth * 1.0
        
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


def grid_to_polygons(state_grid: np.ndarray, bounds: dict) -> list[list[list[float]]]:
    mask = (state_grid > 0).astype(float)
    if not np.any(mask):
        return []
    
    # skimage.measure.find_contours returns a list of (row, column) = (y, x)
    contours = measure.find_contours(mask, 0.5)
    polygons = []
    for contour in contours:
        poly = []
        for point in contour:
            y, x = point[0], point[1]
            lat, lng = grid_to_latlng(x, y, bounds)
            poly.append([lat, lng])
        if len(poly) >= 3:
            polygons.append(poly)
    return polygons


def run_cellular_automaton(
    ignition_x: int,
    ignition_y: int,
    wind_speed: float,
    wind_direction: float,
    humidity: float,
    time_steps: int,
    vegetation_map: np.ndarray,
    elevation_map: np.ndarray,
    seed: int | None = None
) -> list[np.ndarray]:
    rng = np.random.default_rng(seed)
    state = np.zeros((GRID_SIZE, GRID_SIZE), dtype=np.int8)
    burn_time = np.zeros((GRID_SIZE, GRID_SIZE), dtype=np.int8)
    
    if 0 <= ignition_x < GRID_SIZE and 0 <= ignition_y < GRID_SIZE:
        state[ignition_y, ignition_x] = 1
        
    snapshots = []
    snapshots.append(state.copy())
    
    wind_vec_x = math.sin(math.radians((wind_direction + 180) % 360))
    wind_vec_y = math.cos(math.radians((wind_direction + 180) % 360))
    
    # Adjust elevation to be roughly proportional to meters so dz isn't tiny
    # 0 to 1 usually in normalized elevation maps?
    for step in range(time_steps):
        new_state = state.copy()
        
        burning_mask = (state == 1)
        burn_time[burning_mask] += 1
        new_state[burn_time >= 3] = 2  # Burned after 3 steps
        
        burning_cells = np.argwhere(state == 1)
        for y, x in burning_cells:
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    ny, nx = y + dy, x + dx
                    if 0 <= nx < GRID_SIZE and 0 <= ny < GRID_SIZE:
                        if new_state[ny, nx] == 0:
                            veg = float(vegetation_map[ny, nx])
                            # dz = elevation difference
                            # assuming elevation_map is somewhat normalized
                            dz = float(elevation_map[ny, nx]) - float(elevation_map[y, x])
                            slope_mult = math.exp(2.0 * dz)
                            
                            dist = math.hypot(dx, dy)
                            dir_x = dx / dist
                            dir_y = dy / dist
                            dot = dir_x * wind_vec_x + dir_y * wind_vec_y
                            
                            wind_mult = math.exp(dot * (wind_speed / 20.0))
                            hum_mult = max(0.1, 1.0 - (humidity / 100.0))
                            
                            # Increased base probability to ensure spread at low wind speeds
                            prob = 0.7 * veg * slope_mult * wind_mult * hum_mult
                            
                            if rng.random() < prob:
                                new_state[ny, nx] = 1
                                
        state = new_state
        snapshots.append(state.copy())
        
    return snapshots


def run_ensemble(
    ignition_x: int,
    ignition_y: int,
    wind_speed: float,
    wind_direction: float,
    humidity: float,
    time_steps: int,
    vegetation_map: np.ndarray,
    elevation_map: np.ndarray,
    n_runs: int = 40
) -> np.ndarray:
    prob_grid = np.zeros((GRID_SIZE, GRID_SIZE), dtype=float)
    rng = np.random.default_rng()
    
    for i in range(n_runs):
        w_spd = max(0, wind_speed + rng.normal(0, wind_speed * 0.1))
        w_dir = (wind_direction + rng.normal(0, 8)) % 360
        hum = np.clip(humidity + rng.normal(0, 5), 0, 100)
        
        snaps = run_cellular_automaton(
            ignition_x, ignition_y, w_spd, w_dir, hum, time_steps,
            vegetation_map, elevation_map, seed=int(rng.integers(0, 999999))
        )
        final_state = snaps[-1]
        burned_mask = (final_state > 0).astype(float)
        prob_grid += burned_mask
        
    prob_grid /= float(n_runs)
    return prob_grid


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
