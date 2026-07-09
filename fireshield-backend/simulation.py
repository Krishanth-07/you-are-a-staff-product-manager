import math
import random

import numpy as np

from models import CellState, PointOfInterest, RiskFactors
from region_data import GRID_SIZE


def calculate_ignition_probability(
    cell_veg_density: float,
    cell_elevation: float,
    neighbor_elevation: float,
    wind_speed: float,
    wind_direction: float,
    cell_dx: int,
    cell_dy: int,
    humidity: float,
) -> float:
    base_prob = cell_veg_density * 0.4

    cell_angle = math.degrees(math.atan2(cell_dy, cell_dx))
    cell_angle = (cell_angle + 360) % 360
    wind_direction = wind_direction % 360
    angle_diff = abs((wind_direction - cell_angle + 180) % 360 - 180)

    if angle_diff <= 45:
        wind_factor = (wind_speed / 100) * 0.4
    else:
        wind_factor = (wind_speed / 100) * 0.05

    if cell_elevation > neighbor_elevation:
        elevation_factor = 0.15
    else:
        elevation_factor = 0.02

    humidity_factor = (humidity / 100) * 0.3
    probability = base_prob + wind_factor + elevation_factor - humidity_factor
    return max(0.0, min(1.0, probability))


def _snapshot_grid(grid: list[list[str]]) -> list[CellState]:
    snapshot = []
    for y, row in enumerate(grid):
        for x, status in enumerate(row):
            snapshot.append(CellState(x=x, y=y, status=status))
    return snapshot


def run_simulation(
    ignition_x: int,
    ignition_y: int,
    wind_speed: float,
    wind_direction: float,
    humidity: float,
    time_steps: int,
    vegetation_map: np.ndarray,
    elevation_map: np.ndarray,
) -> list[list[CellState]]:
    random.seed(44)
    grid = [["unburnt" for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    grid[ignition_y][ignition_x] = "burning"

    snapshots = []
    neighbor_offsets = [
        (-1, -1),
        (0, -1),
        (1, -1),
        (-1, 0),
        (1, 0),
        (-1, 1),
        (0, 1),
        (1, 1),
    ]

    for _ in range(time_steps):
        burning_cells = [
            (x, y)
            for y in range(GRID_SIZE)
            for x in range(GRID_SIZE)
            if grid[y][x] == "burning"
        ]
        newly_ignited = set()

        for x, y in burning_cells:
            for dx, dy in neighbor_offsets:
                nx = x + dx
                ny = y + dy
                if not (0 <= nx < GRID_SIZE and 0 <= ny < GRID_SIZE):
                    continue
                if grid[ny][nx] != "unburnt":
                    continue

                probability = calculate_ignition_probability(
                    float(vegetation_map[ny][nx]),
                    float(elevation_map[ny][nx]),
                    float(elevation_map[y][x]),
                    wind_speed,
                    wind_direction,
                    dx,
                    dy,
                    humidity,
                )
                if random.random() < probability:
                    newly_ignited.add((nx, ny))

        for x, y in burning_cells:
            grid[y][x] = "burnt"
        for x, y in newly_ignited:
            grid[y][x] = "burning"

        snapshots.append(_snapshot_grid(grid))

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
