FEATURE_NAMES = [
    "typing_speed", "dwell_mean", "flight_mean", "digraph_mean", "typing_variance",
    "mouse_velocity", "mouse_acceleration", "mouse_curvature", "mouse_jitter", "click_dwell",
    "scroll_speed", "scroll_reversals", "touch_pressure", "touch_radius", "timing_entropy",
]
FEATURE_COUNT = len(FEATURE_NAMES)

def vector_from_payload(payload: dict) -> list[float]:
    unknown = set(payload) - set(FEATURE_NAMES)
    if unknown:
        raise ValueError("only canonical derived feature values are accepted")
    return [float(payload.get(name, 0.0)) for name in FEATURE_NAMES]
