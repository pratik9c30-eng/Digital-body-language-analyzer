import math

from ml.feature_schema import FEATURE_NAME_SET, FEATURE_NAMES, vector_from_payload

RAW_INPUT_KEYS = {"key", "code", "text", "value", "content", "character", "keyCode"}

def sanitize_features(payload: dict) -> list[float]:
    """Allow only canonical derived metrics. Raw keystrokes/text are rejected by design."""
    if not isinstance(payload, dict):
        raise ValueError("only canonical derived feature values are accepted")
    if RAW_INPUT_KEYS.intersection(payload):
        raise ValueError("raw input is not accepted; send derived feature values only")
    if not set(payload).issubset(FEATURE_NAME_SET):
        raise ValueError("only canonical derived feature values are accepted")
    vector = vector_from_payload(payload)
    if not all(math.isfinite(value) for value in vector):
        raise ValueError("feature values must be finite numbers")
    return vector
