import httpx
from config import settings

async def dispatch_alert(user_id: str, result: dict) -> None:
    if not settings.alert_webhook_url or result.get("tier") == "silent": return
    message = {"text": f"DBLA anomaly for anonymized session {user_id[:8]}: {result['tier']} ({result['trust_score']}/100)"}
    try:
        async with httpx.AsyncClient(timeout=2) as client: await client.post(settings.alert_webhook_url, json=message)
    except httpx.HTTPError:
        pass
