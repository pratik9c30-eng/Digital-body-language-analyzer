from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from db.database import SessionLocal
from db.models import BaselineProfile, SessionEvent
from ml.anomaly_scorer import AnomalyScorer
from ml.baseline_trainer import BaselineModel
from privacy.vectorizer import sanitize_features
from alerts.webhook_dispatcher import dispatch_alert

router = APIRouter()

class ScorePayload(BaseModel):
    session_id: str
    vector: dict[str, float]

async def scorer_for_user(session, user_id: str) -> AnomalyScorer | None:
    profile = await session.get(BaselineProfile, user_id)
    if profile is None or not profile.model_state:
        return None
    return AnomalyScorer(BaselineModel.from_state(profile.model_state))

@router.post("/api/score")
async def score_http(payload: ScorePayload):
    try:
        vector = sanitize_features(payload.vector)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    async with SessionLocal() as session:
        scorer = await scorer_for_user(session, payload.session_id)
        if scorer is None:
            return {"status": "calibration_required", "trust": None, "risk_tier": "silent", "signal_confidence": 0}
        result = scorer.score(vector).as_dict()
        session.add(SessionEvent(user_id=payload.session_id, trust_score=result["trust_score"], tier=result["tier"], vector=vector))
        await session.commit()
        return result

@router.websocket("/ws/session/{user_id}")
async def session_socket(websocket: WebSocket, user_id: str):
    await websocket.accept()
    scorer = None
    try:
        while True:
            payload = await websocket.receive_json()
            try: vector = sanitize_features(payload)
            except ValueError as error:
                await websocket.send_json({"error": str(error)}); continue
            async with SessionLocal() as session:
                if scorer is None:
                    scorer = await scorer_for_user(session, user_id)
                if scorer is None:
                    await websocket.send_json({"status": "calibration_required", "error": "calibration required before live scoring"})
                    continue
                result = scorer.score(vector).as_dict()
                session.add(SessionEvent(user_id=user_id, trust_score=result["trust_score"], tier=result["tier"], vector=vector))
                await session.commit()
            await websocket.send_json(result)
            await dispatch_alert(user_id, result)
    except WebSocketDisconnect: pass
