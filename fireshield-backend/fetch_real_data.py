import os
import json
import time
import urllib.request
import urllib.error
import random
import math

# Bounding box bounds
NORTH = 11.4587
SOUTH = 11.3867
EAST = 76.9031
WEST = 76.8231
GRID_SIZE = 50

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

def make_request(url, data=None, headers=None, method="GET", retries=3, timeout=15):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as e:
            print(f"Request failed (Attempt {attempt+1}/{retries}) to {url}: {e}")
            if attempt < retries - 1:
                time.sleep(2)
            else:
                raise e

def fetch_elevation():
    print("Fetching elevation data from Open-Elevation API...")
    # Generate 50x50 grid of lat/lng coordinates
    locations = []
    # Grid goes from South (row 0) to North (row 49) and West (col 0) to East (col 49)
    # y increases going north, x increases going east
    for r in range(GRID_SIZE):
        lat = SOUTH + (r / (GRID_SIZE - 1)) * (NORTH - SOUTH)
        for c in range(GRID_SIZE):
            lng = WEST + (c / (GRID_SIZE - 1)) * (EAST - WEST)
            locations.append({"latitude": lat, "longitude": lng})

    # Batch locations into groups of 100
    batch_size = 100
    all_results = []
    
    try:
        for i in range(0, len(locations), batch_size):
            batch = locations[i:i+batch_size]
            payload = json.dumps({"locations": batch}).encode("utf-8")
            url = "https://api.open-elevation.com/api/v1/lookup"
            headers = {"Content-Type": "application/json", "Accept": "application/json"}
            
            print(f"  Batching elevations {i+1} to {min(i+batch_size, len(locations))}...")
            resp = make_request(url, data=payload, headers=headers, method="POST", retries=2, timeout=20)
            
            # Extract elevation values
            if resp and "results" in resp:
                for res in resp["results"]:
                    all_results.append(res["elevation"])
            else:
                raise ValueError("Invalid response format from Open-Elevation API")
            time.sleep(0.5) # Politeness delay
            
        # Reconstruct 50x50 grid (rows = latitude, cols = longitude)
        elevation_grid = []
        for r in range(GRID_SIZE):
            row_vals = all_results[r * GRID_SIZE : (r + 1) * GRID_SIZE]
            elevation_grid.append(row_vals)
            
        print("Successfully fetched elevation data.")
        return elevation_grid
        
    except Exception as exc:
        print(f"Failed to fetch elevation from API: {exc}")
        print("Falling back to generating a realistic synthetic elevation grid for Kotagiri...")
        # Generate synthetic elevation (1600m to 2100m)
        # Using a gradient plus some noise, smoothed
        grid = []
        for r in range(GRID_SIZE):
            row_vals = []
            for c in range(GRID_SIZE):
                # Gradient going from south-west to north-east
                gradient = (r + c) / ((GRID_SIZE - 1) * 2)
                # Base elevation around 1650 to 2050
                base = 1650 + gradient * 350
                # Add some hills noise
                noise = math.sin(r * 0.2) * 50 + math.cos(c * 0.2) * 30
                row_vals.append(round(base + noise, 1))
            grid.append(row_vals)
        return grid

def fetch_pois():
    print("Fetching POI data from Overpass API...")
    query = f"""[out:json][timeout:25];
(
  node["amenity"~"^(hospital|clinic)$"]({SOUTH},{WEST},{NORTH},{EAST});
  node["place"~"^(village|town)$"]({SOUTH},{WEST},{NORTH},{EAST});
  way["highway"~"^(primary|secondary|trunk)$"]({SOUTH},{WEST},{NORTH},{EAST});
);
out center;"""
    
    url = "https://overpass-api.de/api/interpreter"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "FireShieldHackathonApp/1.0"
    }
    payload = f"data={urllib.parse.quote(query)}".encode("utf-8")
    
    pois = []
    
    try:
        resp = make_request(url, data=payload, headers=headers, method="POST", retries=3, timeout=25)
        if resp and "elements" in resp:
            for el in resp["elements"]:
                tags = el.get("tags", {})
                name = tags.get("name")
                
                # Deduce type
                p_type = None
                if "amenity" in tags:
                    if tags["amenity"] in ["hospital", "clinic"]:
                        p_type = "hospital"
                elif "place" in tags:
                    if tags["place"] in ["village", "town", "suburb"]:
                        p_type = "village"
                elif "highway" in tags:
                    p_type = "highway"
                    # Default highway name if missing
                    if not name:
                        name = f"{tags['highway'].capitalize()} Road"
                
                if not name:
                    continue
                    
                # Extract lat/lng (for ways, Overpass returns 'center' object)
                lat = el.get("lat")
                lng = el.get("lon")
                if lat is None or lng is None:
                    center = el.get("center", {})
                    lat = center.get("lat")
                    lng = center.get("lon")
                    
                if lat is not None and lng is not None:
                    pois.append({
                        "name": name,
                        "type": p_type,
                        "lat": float(lat),
                        "lng": float(lng)
                    })
        print(f"Successfully fetched {len(pois)} POIs from Overpass API.")
    except Exception as exc:
        print(f"Failed to fetch POIs from Overpass API: {exc}")
        print("Falling back to synthetic/manually placed POIs...")
        # Hardcode real coordinates for main landmarks near Kotagiri
        pois = [
            {"name": "Kotagiri Town Center", "type": "village", "lat": 11.4227, "lng": 76.8631},
            {"name": "District Hospital Kotagiri", "type": "hospital", "lat": 11.4245, "lng": 76.8665},
            {"name": "Kannerimukku Village", "type": "village", "lat": 11.4380, "lng": 76.8720},
            {"name": "Donington Road (SH-15)", "type": "highway", "lat": 11.4180, "lng": 76.8520},
        ]
        
    # Inject a guaranteed cell tower POI near the center
    pois.append({
        "name": "Kotagiri BSNL Cell Tower",
        "type": "cell_tower",
        "lat": 11.4255,
        "lng": 76.8612
    })
    
    return pois

def fetch_vegetation():
    print("Fetching vegetation data from Overpass API...")
    query = f"""[out:json][timeout:25];
(
  way["landuse"~"^(forest|orchard)$"]({SOUTH},{WEST},{NORTH},{EAST});
  way["natural"~"^(wood|scrub|tree_row)$"]({SOUTH},{WEST},{NORTH},{EAST});
);
out geom;"""
    
    url = "https://overpass-api.de/api/interpreter"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "FireShieldHackathonApp/1.0"
    }
    payload = f"data={urllib.parse.quote(query)}".encode("utf-8")
    
    # Initialize with default low vegetation density
    grid = [[0.2 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    
    try:
        resp = make_request(url, data=payload, headers=headers, method="POST", retries=3, timeout=25)
        if resp and "elements" in resp:
            for el in resp["elements"]:
                if "geometry" in el:
                    # Mark all cells that intersect with this geometry
                    for pt in el["geometry"]:
                        lat = pt["lat"]
                        lng = pt["lon"]
                        if SOUTH <= lat <= NORTH and WEST <= lng <= EAST:
                            # Map to grid
                            r = int(((lat - SOUTH) / (NORTH - SOUTH)) * (GRID_SIZE - 1))
                            c = int(((lng - WEST) / (EAST - WEST)) * (GRID_SIZE - 1))
                            r = max(0, min(GRID_SIZE - 1, r))
                            c = max(0, min(GRID_SIZE - 1, c))
                            grid[r][c] = 0.9 # high vegetation for explicit forest
            print(f"Successfully mapped real vegetation data from {len(resp.get('elements', []))} features.")
            
        # 2 iterations of 3x3 smoothing blur to spread vegetation bounds
        for _ in range(2):
            next_grid = []
            for y in range(GRID_SIZE):
                row_vals = []
                for x in range(GRID_SIZE):
                    vals = []
                    for dy in [-1, 0, 1]:
                        for dx in [-1, 0, 1]:
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < GRID_SIZE and 0 <= nx < GRID_SIZE:
                                vals.append(grid[ny][nx])
                    row_vals.append(sum(vals) / len(vals))
                next_grid.append(row_vals)
            grid = next_grid
            
        print("Vegetation grid processed successfully.")
        return grid
    except Exception as exc:
        print(f"Failed to fetch vegetation from Overpass API: {exc}")
        print("Falling back to modeled vegetation...")
        # Smooth random grid
        rng = random.Random(42)
        grid = [[rng.random() for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
        for _ in range(2):
            next_grid = []
            for y in range(GRID_SIZE):
                row_vals = []
                for x in range(GRID_SIZE):
                    vals = []
                    for dy in [-1, 0, 1]:
                        for dx in [-1, 0, 1]:
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < GRID_SIZE and 0 <= nx < GRID_SIZE:
                                vals.append(grid[ny][nx])
                    row_vals.append(sum(vals) / len(vals))
                next_grid.append(row_vals)
            grid = next_grid
        return grid

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    
    print(f"Initializing data gathering process for Kotagiri region.")
    print(f"Bounds: North {NORTH}, South {SOUTH}, East {EAST}, West {WEST}")
    
    elevation_grid = fetch_elevation()
    real_pois = fetch_pois()
    vegetation_grid = fetch_vegetation()
    
    # Write files
    elevation_path = os.path.join(DATA_DIR, "elevation_grid.json")
    with open(elevation_path, "w") as f:
        json.dump({
            "bounds": {"north": NORTH, "south": SOUTH, "east": EAST, "west": WEST},
            "grid": elevation_grid
        }, f, indent=2)
        
    pois_path = os.path.join(DATA_DIR, "real_pois.json")
    with open(pois_path, "w") as f:
        json.dump(real_pois, f, indent=2)
        
    vegetation_path = os.path.join(DATA_DIR, "vegetation_grid.json")
    with open(vegetation_path, "w") as f:
        json.dump({
            "bounds": {"north": NORTH, "south": SOUTH, "east": EAST, "west": WEST},
            "grid": vegetation_grid
        }, f, indent=2)
        
    # Summary calculations
    flat_elev = [e for row in elevation_grid for e in row]
    min_elev = min(flat_elev)
    max_elev = max(flat_elev)
    
    print("\n================== SUMMARY ==================")
    print(f"Elevation Grid written to {elevation_path} (Range: {min_elev}m to {max_elev}m)")
    print(f"Real POIs written to {pois_path} (Count: {len(real_pois)})")
    print(f"Vegetation Grid written to {vegetation_path}")
    print("All files cached successfully in data/ directory.")
    print("=============================================")

if __name__ == "__main__":
    main()
