import numpy as np

from models import PointOfInterest


GRID_SIZE = 50


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
    rng = np.random.default_rng(42)
    vegetation_map = rng.random((GRID_SIZE, GRID_SIZE))
    return _smooth_3x3(vegetation_map, iterations=2)


def generate_elevation_map() -> np.ndarray:
    rng = np.random.default_rng(43)
    y_indices, x_indices = np.indices((GRID_SIZE, GRID_SIZE))
    gradient = 1.0 - ((x_indices + y_indices) / ((GRID_SIZE - 1) * 2))
    noise = rng.normal(loc=0.0, scale=0.03, size=(GRID_SIZE, GRID_SIZE))
    elevation_map = np.clip(gradient + noise, 0.0, 1.0)
    return _smooth_3x3(elevation_map, iterations=1)


def get_points_of_interest() -> list[PointOfInterest]:
    return [
        PointOfInterest(name="Kotagiri Village", type="village", x=30, y=20),
        PointOfInterest(name="District Hospital", type="hospital", x=35, y=22),
        PointOfInterest(name="NH-181 Highway", type="highway", x=25, y=15),
        PointOfInterest(name="BSNL Tower - Kotagiri", type="cell_tower", x=32, y=18),
    ]
