import math

from ml.feature_schema import FEATURE_NAMES, vector_from_payload

RAW_INPUT_KEYS = {"key", "code", "text", "value", "content", "character", "keyCode"}

def sanitize_features(payload: dict) -> list[float]:
    """Allow only canonical derived metrics. Raw keystrokes/text are rejected by design."""
    if RAW_INPUT_KEYS.intersection(payload):
        raise ValueError("raw input is not accepted; send derived feature values only")
    vector = vector_from_payload(payload)
    if not all(math.isfinite(value) for value in vector):
        raise ValueError("feature values must be finite numbers")
    return vector
