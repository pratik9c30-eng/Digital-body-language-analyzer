from datetime import datetime, timezone

from ml.feature_schema import FEATURE_COUNT, FEATURE_NAMES
from privacy.vectorizer import sanitize_features

RISK_TIERS = {"challenge", "lock"}


def validate_event(payload: dict) -> dict:
    """Normalize an API Gateway event and reject anything outside the AWS contract."""
    if not isinstance(payload, dict):
        raise ValueError("event must be an object")
    required = {"user_id", "timestamp", "trust_score", "tier", "bot_probability", "vector"}
    missing = required - payload.keys()
    if missing:
        raise ValueError(f"missing required fields: {', '.join(sorted(missing))}")
    if not isinstance(payload["user_id"], str) or not payload["user_id"]:
        raise ValueError("user_id must be a non-empty anonymized identifier")
    vector = payload["vector"]
    if not isinstance(vector, dict):
        raise ValueError("vector must contain canonical derived feature values")
    values = sanitize_features(vector)
    if len(values) != FEATURE_COUNT:
        raise ValueError("vector must contain the canonical feature count")
    tier = payload["tier"]
    if tier not in {"silent", "challenge", "lock"}:
        raise ValueError("tier must be silent, challenge, or lock")
    trust_score = float(payload["trust_score"])
    bot_probability = float(payload["bot_probability"])
    if not 0 <= trust_score <= 100 or not 0 <= bot_probability <= 1:
        raise ValueError("score metadata is outside its allowed range")
    return {
        "user_id": payload["user_id"],
        "timestamp": str(payload["timestamp"] or datetime.now(timezone.utc).isoformat()),
        "trust_score": trust_score,
        "tier": tier,
        "bot_probability": bot_probability,
        "vector": dict(zip(FEATURE_NAMES, values)),
    }