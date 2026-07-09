import json
import os

try:
    from google import genai
except ImportError:
    genai = None


GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
MAX_TOKENS = 1500


def call_gemini(system_prompt: str, user_message: str) -> str:
    if genai is None:
        return "Gemini API error: google-genai package is not installed."

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Gemini API error: GEMINI_API_KEY environment variable is not set."

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_message,
            config={
                "system_instruction": system_prompt,
                "max_output_tokens": MAX_TOKENS,
            },
        )
        return (response.text or "").strip()
    except Exception as exc:
        return f"Gemini API error: {exc}"


# Backward-compatible alias for any local callers from the earlier Claude version.
def call_claude(system_prompt: str, user_message: str) -> str:
    return call_gemini(system_prompt, user_message)


def _parse_json_with_retry(
    system_prompt: str,
    user_message: str,
    fallback_response: dict,
) -> dict:
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
        except json.JSONDecodeError:
            return fallback_response


def _poi_names(points_of_interest: list[dict]) -> list[str]:
    return [str(poi.get("name")) for poi in points_of_interest if poi.get("name")]


def _incident_commander_fallback(points_of_interest: list[dict]) -> dict:
    names = _poi_names(points_of_interest)
    primary_location = names[0] if names else "nearest listed point of interest"
    second_location = names[1] if len(names) > 1 else primary_location

    return {
        "evacuate": [
            {
                "location": primary_location,
                "time_minutes": 45,
                "reason": "Fire risk is elevated near this listed point of interest; begin precautionary evacuation.",
            }
        ],
        "deploy_resources": [
            {"type": "fire engines", "count": 3, "from": "nearest district fire station"},
            {"type": "forest teams", "count": 4, "from": "Nilgiris Forest Department field units"},
            {"type": "ambulances", "count": 2, "from": "nearest government hospital"},
        ],
        "road_closures": [
            "Close forest approach roads within 5 km of the ignition point.",
            "Keep one main evacuation route open for outbound civilian movement.",
        ],
        "priority_protect": [
            {
                "location": second_location,
                "reason": "Maintain emergency access and protect critical public services.",
            }
        ],
        "confidence_percent": 70,
        "cascading_risks": [
            "Smoke may reduce road visibility near the incident zone.",
            "Wind-driven spread may threaten nearby listed assets before containment improves.",
        ],
        "containment_estimate_percent": 55,
    }


def get_incident_commander_recommendation(
    risk_score: int,
    risk_factors: dict,
    total_cells_burnt: int,
    points_of_interest: list[dict],
    ignition_x: int,
    ignition_y: int,
) -> dict:
    system_prompt = (
        "You are an experienced Indian disaster management incident commander responding to "
        "a forest fire in the Nilgiris Biosphere Reserve, Tamil Nadu. You must respond ONLY "
        "with valid JSON, no markdown, no explanation text outside the JSON. Be decisive and "
        "specific - real time estimates in minutes, real resource counts, real reasons. "
        "Ground every recommendation strictly in the data provided. Do not invent locations "
        "not present in the points_of_interest list."
    )
    user_message = f"""
Incident data:
- risk_score: {risk_score}
- risk_factors: {json.dumps(risk_factors, indent=2)}
- total_cells_burnt: {total_cells_burnt}
- ignition_x: {ignition_x}
- ignition_y: {ignition_y}
- points_of_interest: {json.dumps(points_of_interest, indent=2)}

Return a JSON response matching this exact schema:
{{
  "evacuate": [{{"location": "<name from points_of_interest>", "time_minutes": <int>, "reason": "<string>"}}],
  "deploy_resources": [{{"type": "<fire engines/helicopters/forest teams/ambulances>", "count": <int>, "from": "<string>"}}],
  "road_closures": ["<string>"],
  "priority_protect": [{{"location": "<name>", "reason": "<string>"}}],
  "confidence_percent": <int 0-100>,
  "cascading_risks": ["<string>", "<string>"],
  "containment_estimate_percent": <int 0-100>
}}
"""
    return _parse_json_with_retry(
        system_prompt,
        user_message,
        _incident_commander_fallback(points_of_interest),
    )


def _alerts_fallback(
    evacuate_locations: list[str],
    safe_route: str,
    shelter_name: str,
    time_minutes: int,
) -> dict:
    locations = ", ".join(evacuate_locations) if evacuate_locations else "affected areas"
    short_location = evacuate_locations[0] if evacuate_locations else "affected area"
    return {
        "sms": {
            "english": f"Evacuate {short_location} in {time_minutes} min. Use safe official route. Move to assigned shelter. Follow police.",
            "tamil": f"{short_location} பகுதி மக்கள் {time_minutes} நிமிடத்தில் வெளியேறவும். அதிகாரிகள் கூறும் பாதையை பயன்படுத்தவும்.",
            "hindi": f"{short_location} से {time_minutes} मिनट में निकलें। अधिकारी बताए सुरक्षित मार्ग का उपयोग करें।",
        },
        "whatsapp": {
            "english": f"Emergency alert: residents in {locations} should evacuate within {time_minutes} minutes. Use {safe_route} and proceed to {shelter_name}. Follow police and forest officials.",
            "tamil": f"அவசர எச்சரிக்கை: {locations} பகுதி மக்கள் {time_minutes} நிமிடங்களில் வெளியேறவும். {safe_route} வழியாக {shelter_name} செல்லவும்.",
            "hindi": f"आपात सूचना: {locations} के निवासी {time_minutes} मिनट में निकलें। {safe_route} से {shelter_name} जाएं।",
        },
        "press_release": {
            "english": f"Authorities have advised residents in {locations} to evacuate within {time_minutes} minutes due to wildfire risk. The safe route is {safe_route}, and the designated shelter is {shelter_name}.",
            "tamil": f"காட்டுத்தீ அபாயம் காரணமாக {locations} பகுதி மக்கள் {time_minutes} நிமிடங்களில் வெளியேறுமாறு அதிகாரிகள் அறிவுறுத்தியுள்ளனர். பாதுகாப்பான பாதை {safe_route}; முகாம் {shelter_name}.",
            "hindi": f"वनाग्नि जोखिम के कारण {locations} के निवासियों को {time_minutes} मिनट में खाली करने की सलाह दी गई है। सुरक्षित मार्ग {safe_route} है और आश्रय {shelter_name} है।",
        },
    }


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
    return _parse_json_with_retry(
        system_prompt,
        user_message,
        _alerts_fallback(evacuate_locations, safe_route, shelter_name, time_minutes),
    )


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
    answer = call_gemini(system_prompt, user_message)
    if answer.startswith("Gemini API error:"):
        return (
            "AI service is unavailable, but the provided context indicates the incident "
            "should be handled using the latest risk score, affected cell count, and "
            "incident commander recommendations. Provide GEMINI_API_KEY to enable "
            "Gemini-powered answers."
        )
    return answer
