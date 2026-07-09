import os
import json
import numpy as np
from models import PointOfInterest

GRID_SIZE = 50

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

def load_json_data(filename):
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None

def get_bounds():
    data = load_json_data("elevation_grid.json")
    if data and "bounds" in data:
        return data["bounds"]
    return {
        "north": 11.4587,
        "south": 11.3867,
        "east": 76.9031,
        "west": 76.8231
    }

def _smooth_3x3(values: np.ndarray, iterations: int = 1) -> np.ndarray:
    smoothed = values.astype(float).copy()
    for _ in range(iterations):
        padded = np.pad(smoothed, pad_width=1, mode="edge")
        next_values = np.zeros_like(smoothed)
        for y in range(smoothed.shape[0]):
            for x in range(smoothed.shape[1]):
                window = padded[y : y + 3, x : x + 3]
                next_values[y, x] = float(np.mean(window))
        smoothed = next_values
    return smoothed

def generate_vegetation_map() -> np.ndarray:
    data = load_json_data("vegetation_grid.json")
    if data and "grid" in data:
        return np.array(data["grid"])
    
    # Fallback to synthetic
    rng = np.random.default_rng(42)
    vegetation_map = rng.random((GRID_SIZE, GRID_SIZE))
    return _smooth_3x3(vegetation_map, iterations=2)

def generate_elevation_map() -> np.ndarray:
    data = load_json_data("elevation_grid.json")
    if data and "grid" in data:
        # Open-Elevation returns absolute values in meters (e.g. 1400-2100).
        # We store the raw meters, but for mathematical simulation logic we can normalize
        # when needed or keep raw meters. Let's keep raw meters and normalize relative to range [0.0, 1.0]
        # so the simulation slope math remains exactly the same as abstract grid!
        raw_grid = np.array(data["grid"])
        min_v = raw_grid.min()
        max_v = raw_grid.max()
        if max_v > min_v:
            normalized = (raw_grid - min_v) / (max_v - min_v)
        else:
            normalized = raw_grid * 0.0
        return normalized
    
    # Fallback to synthetic
    rng = np.random.default_rng(43)
    y_indices, x_indices = np.indices((GRID_SIZE, GRID_SIZE))
    gradient = 1.0 - ((x_indices + y_indices) / ((GRID_SIZE - 1) * 2))
    noise = rng.normal(loc=0.0, scale=0.03, size=(GRID_SIZE, GRID_SIZE))
    elevation_map = np.clip(gradient + noise, 0.0, 1.0)
    return _smooth_3x3(elevation_map, iterations=1)

def get_points_of_interest() -> list[PointOfInterest]:
    data = load_json_data("real_pois.json")
    bounds = get_bounds()
    if data:
        pois = []
        for item in data:
            lat = item["lat"]
            lng = item["lng"]
            # Project real lat/lng back to grid (0 to 49)
            # y increases going north, x increases going east
            y_grid = int(round((lat - bounds["south"]) / (bounds["north"] - bounds["south"]) * (GRID_SIZE - 1)))
            x_grid = int(round((lng - bounds["west"]) / (bounds["east"] - bounds["west"]) * (GRID_SIZE - 1)))
            y_grid = max(0, min(GRID_SIZE - 1, y_grid))
            x_grid = max(0, min(GRID_SIZE - 1, x_grid))
            
            pois.append(PointOfInterest(
                name=item["name"],
                type=item["type"],
                x=x_grid,
                y=y_grid,
                lat=lat,
                lng=lng
            ))
        return pois
        
    return [
        PointOfInterest(name="Kotagiri Village", type="village", x=30, y=20, lat=11.42, lng=76.86),
        PointOfInterest(name="District Hospital", type="hospital", x=35, y=22, lat=11.425, lng=76.865),
        PointOfInterest(name="NH-181 Highway", type="highway", x=25, y=15, lat=11.415, lng=76.85),
        PointOfInterest(name="BSNL Tower - Kotagiri", type="cell_tower", x=32, y=18, lat=11.422, lng=76.862),
    ]
