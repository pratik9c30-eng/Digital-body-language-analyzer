"""Seed a local DBLA session with derived vectors and exercise scoring."""
import argparse
import httpx

FEATURES = [
    "typing_speed", "dwell_mean", "flight_mean", "digraph_mean", "typing_variance",
    "mouse_velocity", "mouse_acceleration", "mouse_curvature", "mouse_jitter", "click_dwell",
    "scroll_speed", "scroll_reversals", "touch_pressure", "touch_radius", "timing_entropy",
]


def vector(offset: float = 0.0) -> dict[str, float]:
    return {name: max(0.01, min(0.95, 0.45 + index * 0.01 + offset)) for index, name in enumerate(FEATURES)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8000")
    parser.add_argument("--session", default="simulate-session")
    args = parser.parse_args()
    with httpx.Client(base_url=args.base, timeout=5) as client:
        for index in range(30):
            response = client.post("/api/calibration/sample", json={"session_id": args.session, "vector": vector((index % 3) * 0.01)})
            response.raise_for_status()
        response = client.post("/api/calibration/finalize", params={"session_id": args.session})
        response.raise_for_status()
        print("baseline:", response.json())
        for label, change in [("normal", 0.0), ("anomalous", 0.45)]:
            response = client.post("/api/score", json={"session_id": args.session, "vector": vector(change)})
            response.raise_for_status()
            print(label + ":", response.json())


if __name__ == "__main__":
    main()
