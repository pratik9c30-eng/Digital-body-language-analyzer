from ml.feature_schema import FEATURE_NAMES

def explain(z_scores: list[float], limit: int = 3) -> list[dict]:
    ranked = sorted(enumerate(z_scores), key=lambda pair: abs(pair[1]), reverse=True)[:limit]
    labels = {
        "typing_speed": "typing speed", "dwell_mean": "key dwell", "flight_mean": "key flight time",
        "digraph_mean": "digraph latency", "typing_variance": "typing variance", "mouse_velocity": "mouse speed",
        "mouse_acceleration": "mouse acceleration", "mouse_curvature": "mouse path", "mouse_jitter": "mouse jitter",
        "click_dwell": "click dwell", "scroll_speed": "scroll speed", "scroll_reversals": "scroll reversals",
        "touch_pressure": "touch pressure", "touch_radius": "touch radius", "timing_entropy": "timing entropy",
    }
    results = []
    for index, z in ranked:
        direction = "higher" if z > 0 else "lower"
        results.append({"feature": FEATURE_NAMES[index], "label": labels[FEATURE_NAMES[index]], "z_score": round(float(z), 2), "reason": f"{labels[FEATURE_NAMES[index]].capitalize()} {abs(z) * 25:.0f}% {direction} than baseline"})
    return results
