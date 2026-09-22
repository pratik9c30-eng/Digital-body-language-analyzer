FEATURE_NAMES = [
    "typing_speed", "dwell_mean", "flight_mean", "digraph_mean", "typing_variance",
    "mouse_velocity", "mouse_acceleration", "mouse_curvature", "mouse_jitter", "click_dwell",
    "scroll_speed", "scroll_reversals", "touch_pressure", "touch_radius", "timing_entropy",
]
FEATURE_COUNT = len(FEATURE_NAMES)
FEATURE_NAME_SET = frozenset(FEATURE_NAMES)

def vector_from_payload(payload: dict) -> list[float]:
    unknown = set(payload) - FEATURE_NAME_SET
    if unknown:
        raise ValueError("only canonical derived feature values are accepted")
    values = []
    for name in FEATURE_NAMES:
        value = payload.get(name, 0.0)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"derived metric {name} must be numeric")
        values.append(float(value))
    return values
