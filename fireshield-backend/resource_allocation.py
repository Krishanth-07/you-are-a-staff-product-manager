import math
import copy

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def allocate_resources(threatened_pois: list[dict], resource_bases: list[dict]) -> list[dict]:
    # Make a copy of bases to mutate available units
    bases = copy.deepcopy(resource_bases)
    
    # Sort POIs by threat level (Critical first)
    threat_priority = {"Critical": 1, "High": 2, "Low": 3}
    sorted_pois = sorted(threatened_pois, key=lambda p: threat_priority.get(p.get("threat_level", "Low"), 4))
    
    allocations = []
    
    for poi in sorted_pois:
        # Determine needs based on POI type and threat
        needs = {}
        if poi["type"] == "village":
            needs["fire_engines"] = 2 if poi["threat_level"] == "Critical" else 1
            needs["ambulances"] = 1
        elif poi["type"] == "hospital":
            needs["fire_engines"] = 3
            needs["ambulances"] = 3
        else:
            needs["fire_engines"] = 1
            needs["forest_teams"] = 1
            
        poi_lat = poi.get("lat", 11.42)
        poi_lng = poi.get("lng", 76.86)
        
        for unit_type, count_needed in needs.items():
            for _ in range(count_needed):
                # Find closest base with this unit available
                closest_base = None
                min_dist = float('inf')
                
                for base in bases:
                    available = base.get("available_units", {}).get(unit_type, 0)
                    if available > 0:
                        dist = haversine_distance(poi_lat, poi_lng, base["lat"], base["lng"])
                        if dist < min_dist:
                            min_dist = dist
                            closest_base = base
                            
                if closest_base:
                    # Allocate
                    closest_base["available_units"][unit_type] -= 1
                    
                    # Assume 35 km/h on hill roads
                    eta_minutes = int((min_dist / 35.0) * 60)
                    
                    # Check if we already have an entry for this base and POI and unit_type
                    existing = next((a for a in allocations if a["poi"] == poi["name"] and a["from"] == closest_base["name"] and a["type"] == unit_type), None)
                    if existing:
                        existing["count"] += 1
                    else:
                        allocations.append({
                            "poi": poi["name"],
                            "from": closest_base["name"],
                            "type": unit_type,
                            "count": 1,
                            "distance_km": round(min_dist, 1),
                            "eta_minutes": max(5, eta_minutes) # min 5 mins
                        })

    return allocations
