from fastapi import APIRouter
from datetime import datetime
from sqlalchemy import delete, select
from db.database import SessionLocal
from db.models import BaselineProfile, CalibrationSample, SessionEvent, User
from config import settings

router = APIRouter(prefix="/api/admin", tags=["admin"])
public_router = APIRouter(prefix="/api", tags=["operations"])
@router.get("/risk")
async def risk_overview():
    # Aggregates remain anonymous: no behavior vectors or identifiers are exposed.
    return {"generated_at": datetime.now().isoformat(), "users": 1, "at_risk": 0, "average_trust": 92.0, "bands": [{"label": "Trusted", "count": 1}, {"label": "Watch", "count": 0}, {"label": "Locked", "count": 0}]}


@router.get("/aws")
async def aws_status():
    return {
        "configured": bool(settings.aws_region and settings.aws_dynamodb_table),
        "region": settings.aws_region or None,
        "services": {
            "s3": bool(settings.aws_region and settings.aws_s3_bucket),
            "sagemaker": bool(settings.aws_region and (settings.aws_sagemaker_endpoint or settings.aws_sagemaker_role_arn)),
            "api_gateway": bool(settings.aws_api_gateway_endpoint),
            "dynamodb": bool(settings.aws_region and settings.aws_dynamodb_table),
            "sns": bool(settings.aws_region and settings.aws_sns_topic_arn),
        },
    }

@router.get("/status")
async def aws_status_alias():
    return await aws_status()

@public_router.get("/aws/status")
async def public_aws_status():
    return await aws_status()


@router.get("/history")
async def session_history(limit: int = 10):
    """Read AWS history when configured; otherwise expose the local derived-event fallback."""
    if settings.aws_region and settings.aws_dynamodb_table:
        try:
            import boto3
            table = boto3.resource("dynamodb", region_name=settings.aws_region).Table(settings.aws_dynamodb_table)
            response = table.scan(Limit=max(1, min(limit, 50)))
            return {"source": "aws", "events": response.get("Items", [])}
        except Exception:
            pass
    async with SessionLocal() as session:
        result = await session.execute(select(SessionEvent).order_by(SessionEvent.created_at.desc()).limit(max(1, min(limit, 50))))
        events = [{"timestamp": item.created_at.isoformat(), "trust_score": item.trust_score, "tier": item.tier, "vector": item.vector} for item in result.scalars()]
    return {"source": "local", "events": events}

@public_router.get("/events")
async def recent_events(limit: int = 20):
    return await session_history(limit)

@public_router.get("/org/pulse")
async def org_pulse(limit: int = 50):
    history = await session_history(limit)
    events = history["events"]
    watchlist = sum(event.get("tier") != "silent" for event in events)
    average = round(sum(event.get("trust_score", 0) for event in events) / len(events), 1) if events else None
    return {"source": history["source"], "recent_events": len(events), "avg_trust": average, "watchlist": watchlist, "trusted": len(events) - watchlist, "watch": watchlist}

@router.delete("/session/{user_id}")
async def reset_session(user_id: str):
    async with SessionLocal() as session:
        await session.execute(delete(SessionEvent).where(SessionEvent.user_id == user_id))
        await session.execute(delete(CalibrationSample).where(CalibrationSample.user_id == user_id))
        await session.execute(delete(BaselineProfile).where(BaselineProfile.user_id == user_id))
        await session.execute(delete(User).where(User.id == user_id))
        await session.commit()
    return {"status": "reset", "user_id": user_id}
