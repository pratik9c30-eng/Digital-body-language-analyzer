from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.database import get_session
from db.models import BaselineProfile, CalibrationSample as CalibrationSampleModel, User
from ml.baseline_trainer import BaselineModel
from ml.feature_schema import FEATURE_COUNT, FEATURE_NAMES
from privacy.vectorizer import sanitize_features

router = APIRouter(prefix="/api/calibration", tags=["calibration"])


class CalibrationSample(BaseModel):
    typing_speed: float | None = None
    dwell_mean: float | None = None
    flight_mean: float | None = None
    digraph_mean: float | None = None
    typing_variance: float | None = None
    mouse_velocity: float | None = None
    mouse_acceleration: float | None = None
    mouse_curvature: float | None = None
    mouse_jitter: float | None = None
    click_dwell: float | None = None
    scroll_speed: float | None = None
    scroll_reversals: float | None = None
    touch_pressure: float | None = None
    touch_radius: float | None = None
    timing_entropy: float | None = None


class CalibrationPayload(BaseModel):
    user_id: str
    samples: list[CalibrationSample] = Field(min_length=3)


class CalibrationResponse(BaseModel):
    user_id: str
    samples: int
    feature_count: int
    status: str
    training_status: str
    quality: dict

class SamplePayload(BaseModel):
    session_id: str
    ts: str | None = None
    vector: dict[str, float]



async def _quality_summary(vectors: list[list[float]]) -> dict:
    import numpy as np

    arr = np.asarray(vectors, dtype=float)

    # A feature is considered active if it has meaningful
    # non-zero activity in at least 10% of the samples.
    active_features = np.mean(np.abs(arr) > 1e-6, axis=0)
    active_count = int(np.sum(active_features >= 0.10))
    total_features = arr.shape[1]

    # Don't penalize desktop users for unavailable touch sensors.
    # The useful desktop signals are typing, mouse and scroll.
    usable_indexes = list(range(min(12, total_features)))
    usable_activity = active_features[usable_indexes]

    active_usable = int(np.sum(usable_activity >= 0.10))
    usable_total = len(usable_indexes)

    confidence = active_usable / max(usable_total, 1)

    quality = {
        "confidence": round(float(np.clip(confidence, 0.0, 1.0)), 3),
        "limited": bool(
            len(vectors) < 30
            or confidence < settings.calibration_min_quality
        ),
        "weakest_signal": round(float(np.min(usable_activity)), 3),
        "active_features": active_count,
        "sample_count": len(vectors),
        "status": (
            "Calibration quality: Limited"
            if len(vectors) < 30 or confidence < settings.calibration_min_quality
            else "Calibration quality: Good"
        ),
    }

    return quality

@router.post("", response_model=CalibrationResponse)
async def calibrate(payload: CalibrationPayload, session: AsyncSession = Depends(get_session)):
    try:
        vectors = [sanitize_features(sample.model_dump()) for sample in payload.samples]
        model = BaselineModel(vectors)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    quality = await _quality_summary(vectors)
    if quality["limited"]:
        raise HTTPException(status_code=422, detail="Calibration quality is limited. Move your mouse more and collect diverse samples.")

    user = await session.get(User, payload.user_id)
    if user is None:
        session.add(User(id=payload.user_id))
    profile = await session.get(BaselineProfile, payload.user_id)
    if profile is None:
        profile = BaselineProfile(user_id=payload.user_id)
        session.add(profile)
    profile.mean = model.mean.tolist()
    profile.std = model.std.tolist()
    profile.samples = len(vectors)
    profile.confidence = quality["confidence"]
    profile.model_state = model.state()
    await session.commit()

    training_status = "not-configured"
    if settings.aws_s3_bucket:
        try:
            from aws.s3_training import upload_calibration_batch
            upload_calibration_batch(settings.aws_s3_bucket, payload.user_id, [dict(zip(FEATURE_NAMES, vector)) for vector in vectors])
            training_status = "uploaded"
        except Exception:
            training_status = "upload-failed"

    return {
        "user_id": payload.user_id,
        "samples": len(vectors),
        "feature_count": FEATURE_COUNT,
        "status": "baseline-ready",
        "training_status": training_status,
        "quality": quality,
    }

@router.post("/sample")
async def store_sample(payload: SamplePayload, session: AsyncSession = Depends(get_session)):
    try:
        vector = sanitize_features(payload.vector)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    session.add(CalibrationSampleModel(user_id=payload.session_id, vector=vector))
    await session.commit()
    return await calibration_status(payload.session_id, session)

@router.get("/status")
async def calibration_status(session_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(CalibrationSampleModel).where(CalibrationSampleModel.user_id == session_id).order_by(CalibrationSampleModel.id))
    samples = list(result.scalars())[-30:]
    count = len(samples)
    vectors = [sample.vector for sample in samples]
    has_signal = lambda indexes: any(abs(vector[index]) > 1e-6 for vector in vectors for index in indexes)
    typing = min(1.0, count / 30 + (0.3 if has_signal(range(0, 5)) else 0))
    mouse = min(1.0, count / 30 + (0.3 if has_signal(range(5, 10)) else 0))
    scroll = min(1.0, count / 30 + (0.3 if has_signal(range(10, 15)) else 0))
    confidence = round(min(typing, mouse, scroll), 3)
    return {"collected": count, "target": 30, "typing": round(typing, 3), "mouse": round(mouse, 3), "scroll": round(scroll, 3), "confidence": confidence, "ready": count >= 30 and confidence >= settings.calibration_min_quality}

@router.post("/finalize")
async def finalize_calibration(session_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(CalibrationSampleModel).where(CalibrationSampleModel.user_id == session_id).order_by(CalibrationSampleModel.id))
    samples = list(result.scalars())[-30:]
    if len(samples) < 30:
        raise HTTPException(status_code=409, detail="Calibration requires 30 derived samples")
    vectors = [sample.vector for sample in samples]
    model = BaselineModel(vectors)
    quality = await _quality_summary(vectors)
    if quality["limited"]:
        raise HTTPException(status_code=422, detail="Calibration quality is limited. Move your mouse more and collect diverse samples.")
    user = await session.get(User, session_id)
    if user is None:
        session.add(User(id=session_id))
    profile = await session.get(BaselineProfile, session_id)
    if profile is None:
        profile = BaselineProfile(user_id=session_id)
        session.add(profile)
    profile.mean = model.mean.tolist()
    profile.std = model.std.tolist()
    profile.samples = len(vectors)
    profile.confidence = quality["confidence"]
    profile.model_state = model.state()
    await session.execute(delete(CalibrationSampleModel).where(CalibrationSampleModel.user_id == session_id))
    await session.commit()
    return {"user_id": session_id, "samples": len(vectors), "status": "baseline-ready", "quality": quality}
