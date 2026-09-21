# DBLA Audit

## Summary

This repository is a functional prototype with a usable local calibration flow and derived-feature privacy boundary, but the current anomaly engine is overly sensitive and the UI/contract assumptions are not robust enough for a judge-ready demo. The system demonstrates the right architecture, but it currently behaves like a single-threshold anomaly trigger instead of a stable continuous-authentication decision engine.

## Component audit

| Component | Status | Evidence | Fix planned |
| --- | --- | --- | --- |
| Frontend app shell | partially working | React + Vite app loads and demonstrates calibration/live trust flow. | Improve state model, telemetry contract, and demo reliability. |
| Calibration experience | partially working | [client/src/components/CalibrationGame.tsx](../client/src/components/CalibrationGame.tsx) collects 30 samples and posts to /api/calibration. | Add quality gating, clearer blocking states, persistence checks. |
| Live monitoring | partially working | [client/src/hooks/useBehaviorStream.ts](../client/src/hooks/useBehaviorStream.ts) emits WebSocket vectors and reads score state. | Add retry/backoff, health status, warm-up handling, and explicit error messaging. |
| WebSocket scoring | working | [server/routes/session_ws.py](../server/routes/session_ws.py) accepts JSON vectors, validates them, and emits trust results. | Harden reconnect and error frames. |
| FastAPI startup/config | working | [server/main.py](../server/main.py) and [server/config.py](../server/config.py) boot FastAPI with CORS and env config. | Add better validation and status endpoints. |
| Baseline trainer | working | [server/ml/baseline_trainer.py](../server/ml/baseline_trainer.py) computes mean/std and IsolationForest baseline. | Add sample quality validation and robust std floor. |
| Anomaly scorer | broken / over-sensitive | [server/ml/anomaly_scorer.py](../server/ml/anomaly_scorer.py) converts raw anomaly + bot score to trust with a single threshold. | Replace with multi-signal temporal decision engine. |
| Bot detector | partially working | [server/ml/bot_detector.py](../server/ml/bot_detector.py) produces a low-variance/entropy signal. | Expose as automation indication, not lock certainty. |
| Explainability | working | [server/ml/explainability.py](../server/ml/explainability.py) emits top z-score feature reasons. | Keep but tie to decision engine and confidence. |
| Privacy filter | working | [server/privacy/vectorizer.py](../server/privacy/vectorizer.py) strips raw input keys. | Add strict validation, payload size limits, and tests. |
| Admin status endpoints | partially working | [server/routes/admin.py](../server/routes/admin.py) reports AWS configuration, local history, generic risk. | Add real connectivity checks and better schema. |
| DB models | working | [server/db/models.py](../server/db/models.py) stores derived vectors and trust events. | Add more persisted snapshots and explicit event metadata. |
| AWS integration | disconnected / mocked | AWS code present in server/aws but not fully wired to env-safe checks. | Keep local fallback; detect status, no fake connectivity claims. |
| Tests | partially working | existing tests pass but do not cover over-triggering or decision-state logic. | Add regression tests for false positives and decision hysteresis. |
| Docs/demo scripts | partially working | [docs/DEMO_SCRIPT.md](../docs/DEMO_SCRIPT.md) exists, but the actual app flow is not audited against it. | Run and adjust exact judge flow. |

## End-to-end trace and verification

The intended system path is:

Browser sensors -> feature extraction -> normalized vector -> WebSocket -> FastAPI -> baseline model -> anomaly engine -> trust decision -> UI visualization -> event persistence -> admin history.

This repository does support that path in principle, but the current implementation is not stable for real judge use because the trust decision is too coarse and not stateful.

Observations:

- Sensors are captured in the client and normalized before being sent, as seen in [client/src/hooks/useBehaviorStream.ts](../client/src/hooks/useBehaviorStream.ts) and [client/src/ml-client/featureNormalizer.ts](../client/src/ml-client/featureNormalizer.ts).
- The backend validates input keys in [server/privacy/vectorizer.py](../server/privacy/vectorizer.py) and rejects raw keystrokes/text.
- The baseline model is trained in [server/ml/baseline_trainer.py](../server/ml/baseline_trainer.py). It computes mean/std and an IsolationForest model.
- The scoring step in [server/ml/anomaly_scorer.py](../server/ml/anomaly_scorer.py) converts anomaly directly into trust_score with no temporal smoothing, no hysteresis, and no confidence gating.
- Session persistence is implemented in [server/routes/session_ws.py](../server/routes/session_ws.py) and [server/db/models.py](../server/db/models.py), but it stores only a trust score and vector, not a richer per-sample engine snapshot needed for replay.
- The frontend uses generic charts and trust bands, but not the full decision-state system described in the product brief. This is why it feels prototype-like rather than operational.

## Root cause of over-triggering

The core issue is not one single threshold; it is the combination of:

1. A single risk calculation in [server/ml/anomaly_scorer.py](../server/ml/anomaly_scorer.py) where anomaly is scaled directly against a circadian factor and then mapped to trust.
2. No rolling persistence or hysteresis. One abnormal sample can immediately move the tier.
3. No calibration-quality check. The project stores a confidence value but does not use it to widen thresholds or prevent low-quality decisions.
4. No per-signal agreement logic. A single large z-score can dominate a decision even when the rest of the signal channels remain stable.
5. A fixed IsolationForest configuration with contamination=0.08 and a hard trust cutoff logic that triggers on moderate anomalies rather than sustained drift.

This is why the prototype appears very sensitive even when the user is behaving normally.

## Requirement-to-file map

- Phase 3 / decision engine: [server/ml/decision_engine.py](../server/ml/decision_engine.py), [tests/test_decision_engine.py](../tests/test_decision_engine.py)
- Phase 4 / error handling and API contracts: [server/routes/admin.py](../server/routes/admin.py), [server/routes/session_ws.py](../server/routes/session_ws.py), [server/config.py](../server/config.py)
- Phase 5 / privacy and validation: [server/privacy/vectorizer.py](../server/privacy/vectorizer.py), [server/db/models.py](../server/db/models.py), [tests/test_privacy.py](../tests/test_privacy.py)
- Phase 6 / calibration quality: [server/ml/baseline_trainer.py](../server/ml/baseline_trainer.py), [client/src/components/CalibrationGame.tsx](../client/src/components/CalibrationGame.tsx)
- Phase 7 / dashboard polish: [client/src/App.tsx](../client/src/App.tsx), [client/src/components](../client/src/components)
- Phase 8 / AWS status: [server/routes/admin.py](../server/routes/admin.py), [server/aws](../server/aws)
- Phase 9 / demo script: [docs/DEMO_SCRIPT.md](../docs/DEMO_SCRIPT.md)
- Phase 10 / visual polish: [client/src/styles/globals.css](../client/src/styles/globals.css)
- Phase 11 / tests: [tests](../tests)
- Phase 12 / cleanup: cross-cutting cleanup across server and client

## Explain-back

DBLA currently works as a derived-feature sensor pipeline: the browser collects keyboard, mouse, scroll, and timing signals, normalizes them into a fixed-length vector, and sends them over a WebSocket to the FastAPI backend. The backend validates that the payload contains only derived numeric features, trains a per-user baseline using mean/std and IsolationForest, scores incoming vectors, and returns a trust score plus a tier. The front end presents that score, a heartbeat, and an explainability panel to the user.

The false-positive problem is rooted in the fact that scoring is a direct function of anomaly magnitude and bot signal, with no temporal smoothing, hysteresis, multi-signal agreement, calibration confidence, or state machine. As a result, a single larger-than-baseline sample or small shift in a single channel can push the trust score down and trigger a challenge state. The code also accepts the data as the model input without checking calibration quality or sample stability, which makes behavior appear riskier than it really is.

The fix is to move the decision logic into a dedicated engine that computes per-signal deviation, smoothed anomaly, signal agreement, confidence, and state transitions in a controlled way, while keeping the existing model and privacy constraints intact.
