import json
import os
import random

try:
    from google import genai
except ImportError:
    genai = None


GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
MAX_TOKENS = 1500


# ==========================================
# GEMINI API CONNECTIONS
# ==========================================

def call_gemini(system_prompt: str, user_message: str) -> str:
    if genai is None:
        print("[Gemini] failure: google-genai package is not installed")
        raise RuntimeError("Gemini is required: google-genai package is not installed.")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[Gemini] failure: GEMINI_API_KEY environment variable is not set")
        raise RuntimeError("Gemini is required: GEMINI_API_KEY environment variable is not set.")

    try:
        print(f"[Gemini] request model={GEMINI_MODEL}")
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_message,
            config={
                "system_instruction": system_prompt,
                "max_output_tokens": MAX_TOKENS,
                "temperature": 0.9,
            },
        )
        text = (response.text or "").strip()
        print(f"[Gemini] success chars={len(text)}")
        return text
    except Exception as exc:
        print(f"[Gemini] failure: {exc}")
        raise RuntimeError(f"Gemini API error: {exc}") from exc


def call_claude(system_prompt: str, user_message: str) -> str:
    return call_gemini(system_prompt, user_message)


def _parse_json_with_retry(system_prompt: str, user_message: str) -> dict:
    response_text = call_gemini(system_prompt, user_message)
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        retry_message = (
            f"{user_message}\n\n"
            "Your last response was not valid JSON. Return ONLY the JSON object, nothing else."
        )
        retry_text = call_gemini(system_prompt, retry_message)
        try:
            return json.loads(retry_text)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Gemini returned invalid JSON twice.") from exc


def get_incident_commander_recommendation(
    risk_score: int,
    risk_factors: dict,
    total_cells_burnt: int,
    points_of_interest: list[dict],
    ignition_x: int,
    ignition_y: int,
    ensemble_confidence: int | None = None,
    high_confidence_cells: int | None = None,
    resource_allocation: list[dict] = None,
) -> dict:
    import math
    enriched_pois = []
    for poi in points_of_interest:
        px = poi.get("x", 25)
        py = poi.get("y", 25)
        dist_cells = math.hypot(px - ignition_x, py - ignition_y)
        dist_meters = round(dist_cells * 160)
        
        if dist_meters < 800:
            threat = "Critical"
        elif dist_meters < 1800:
            threat = "High"
        else:
            threat = "Low"
            
        enriched = dict(poi)
        enriched["distance_meters"] = dist_meters
        enriched["threat_level"] = threat
        enriched_pois.append(enriched)

    system_prompt = (
        "You are an experienced Indian disaster management incident commander responding to "
        "a forest fire in the Nilgiris Biosphere Reserve, Tamil Nadu. You must respond ONLY "
        "with valid JSON, no markdown, no explanation text outside the JSON. Be decisive and "
        "specific. "
        "Ground every recommendation strictly in the geographic data and threat levels provided. "
        "The following resource assignment has already been computed by an optimization algorithm — "
        "use these exact bases, unit counts, and ETAs in your `deploy_resources` field; do not invent different ones. "
        "Do not invent locations not present in the points_of_interest list. Avoid generic "
        "boilerplate phrases. Cite the specific distance in meters and threat level of the villages "
        "or hospitals in your reasoning fields to demonstrate real spatial awareness. "
        "For cascading_risks, reference SPECIFIC named assets from the points_of_interest list where relevant "
        "(e.g., a specific named cell tower, hospital, or road) rather than generic statements. Each cascading risk "
        "should name a concrete consequence: what fails, why, and what it affects downstream. Limit to the 2 most "
        "severe and specific cascading risks, not a generic list."
    )
    
    if ensemble_confidence is not None:
        system_prompt += f"You MUST use the provided ensemble_confidence_percent ({ensemble_confidence}%) as the exact value for the `confidence_percent` field in your JSON output. Do not invent a different confidence number."
    else:
        system_prompt += "Estimate the `confidence_percent` field based on the risk factors provided."
        
    user_message = f"""
Incident data:
- risk_score: {risk_score}
- risk_factors: {json.dumps(risk_factors, indent=2)}
- total_cells_burnt: {total_cells_burnt}
- ignition_x: {ignition_x}
- ignition_y: {ignition_y}
- points_of_interest (enriched with distances & threat levels relative to ignition): {json.dumps(enriched_pois, indent=2)}
- Computed resource_allocation: {json.dumps(resource_allocation or [], indent=2)}
{f"- ensemble_confidence_percent: {ensemble_confidence} (derived from multiple simulation runs)" if ensemble_confidence is not None else ""}
{f"- high_confidence_cells: {high_confidence_cells}" if high_confidence_cells is not None else ""}

Return a JSON response matching this exact schema:
{{
  "evacuate": [{{"location": "<name from points_of_interest>", "time_minutes": <int>, "reason": "<string citing specific threat/distance>"}}],
  "deploy_resources": [{{"type": "<type from resource_allocation>", "count": <int from resource_allocation>, "from": "<base from resource_allocation>", "to": "<poi from resource_allocation>", "eta_minutes": <int from resource_allocation>}}],
  "road_closures": ["<string citing specific highway or road name>"],
  "priority_protect": [{{"location": "<name>", "reason": "<string citing specific distance and risk factor>"}}],
  "confidence_percent": {ensemble_confidence if ensemble_confidence is not None else "<int 0-100>"},
  "cascading_risks": [
    {{"risk": "<specific failure, e.g. 'Kotagiri BSNL Cell Tower may lose power if the fire crosses Club Road'>", "impact": "<specific downstream consequence, e.g. 'would cut emergency radio contact for field teams in a 3km radius'>"}}
  ],
  "containment_estimate_percent": <int 0-100>
}}
"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing. Real-time AI generation is disabled. Please provide an API key for live data.")
        
    try:
        return _parse_json_with_retry(system_prompt, user_message)
    except Exception as e:
        print(f"[Gemini API failure] {e}")
        raise RuntimeError(f"Failed to generate real-time AI recommendation: {str(e)}")


def generate_public_alerts(
    evacuate_locations: list[str],
    safe_route: str,
    shelter_name: str,
    time_minutes: int,
) -> dict:
    system_prompt = (
        "You are a government disaster communication officer in Tamil Nadu, India. "
        "Generate clear, calm, actionable emergency alerts. Respond ONLY with valid JSON."
    )
    user_message = f"""
Evacuation alert data:
- evacuate_locations: {json.dumps(evacuate_locations, indent=2)}
- safe_route: {safe_route}
- shelter_name: {shelter_name}
- time_minutes: {time_minutes}

Return alerts in this exact JSON schema, for EACH of English, Tamil, and Hindi:
{{
  "sms": {{"english": "<under 160 chars>", "tamil": "<under 160 chars, Tamil script>", "hindi": "<under 160 chars, Devanagari script>"}},
  "whatsapp": {{"english": "<slightly longer, can include emoji>", "tamil": "<...>", "hindi": "<...>"}},
  "press_release": {{"english": "<one paragraph>", "tamil": "<...>", "hindi": "<...>"}}
}}
"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing. Real-time public alerts generation is disabled.")
        
    try:
        return _parse_json_with_retry(system_prompt, user_message)
    except Exception as e:
        print(f"[Gemini API failure] {e}")
        raise RuntimeError(f"Failed to generate public alerts: {str(e)}")


def ask_ai(question: str, context: dict) -> str:
    system_prompt = (
        "You are the AI assistant inside FireShield AI, an emergency command platform. "
        "Answer the incident commander's question using ONLY the data provided in context. "
        "Be concise, operational, and specific - 2-4 sentences maximum. If the answer "
        "requires data not present in context, say what additional data would be needed."
    )
    user_message = f"""
Context:
{json.dumps(context, indent=2)}

Question:
{question}
"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing. Real-time AI assistant is disabled.")
        
    try:
        return call_gemini(system_prompt, user_message)
    except Exception as e:
        print(f"[Gemini API failure] {e}")
        raise RuntimeError(f"Failed to communicate with AI assistant: {str(e)}")


def generate_incident_report(
    simulation_data: dict,
    incident_commander_data: dict,
    logs: list[str],
) -> dict:
    system_prompt = (
        "You are drafting an official incident report for Tamil Nadu Forest Department "
        "and District Emergency Operations Centre records. Write in formal government "
        "incident-report style. Respond ONLY with valid JSON."
    )
    user_message = f"""
Incident source data:
- simulation_data: {json.dumps(simulation_data, indent=2)}
- incident_commander_data: {json.dumps(incident_commander_data, indent=2)}
- logs: {json.dumps(logs, indent=2)}

Return a JSON response matching this exact schema:
{{
  "incident_id": "<e.g. FIRE-2026-NLG-001>",
  "summary": "<2-3 sentences>",
  "timeline_narrative": "<formatted from logs>",
  "actions_taken": ["<string>"],
  "resources_deployed": "<summary>",
  "population_impact": "<summary>",
  "recommendation": "<forward-looking string>"
}}
"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing. Real-time incident report generation is disabled.")
        
    try:
        return _parse_json_with_retry(system_prompt, user_message)
    except Exception as e:
        print(f"[Gemini API failure] {e}")
        raise RuntimeError(f"Failed to generate incident report: {str(e)}")
