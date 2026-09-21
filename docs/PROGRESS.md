# DBLA Progress

## Current milestone

Milestone 1 complete: repository audit and explain-back written in [docs/AUDIT.md](AUDIT.md). The root cause is confirmed: the scoring stack applies a single-threshold, single-sample anomaly model without temporal or confidence-aware logic, which produces over-triggering.

## What is done

- Created feature branch: feat/dbla-judge-ready
- Initialized Git repository
- Inspected the main frontend/backend flows and confirmed the sensor -> feature -> WebSocket -> score architecture
- Wrote audit with component classification and requirement-to-file mapping
- Added a regression test file to cover the decision engine and quality checks before implementation

## What is next

- Implement the decision engine in [server/ml/decision_engine.py](../server/ml/decision_engine.py)
- Replace the raw anomaly scorer call path with the stabilized state-driven engine
- Add validation and privacy tests
- Re-run the backend and frontend checks
- Complete the UI contract and demo flow updates

## Known issues

- Too-sensitivity caused by direct anomaly mapping in [server/ml/anomaly_scorer.py](../server/ml/anomaly_scorer.py)
- No decision state machine, no warm-up gating, no hysteresis, no signal agreement checks
- Frontend lacks robust health/error UI and backend connection states
- Calibration quality is not enforced
- AWS status is not actively validated

## Commands to resume

```bash
cd "c:/Users/Lenovo/OneDrive/Desktop/hack/digital-body-language-analyzer"
.\.venv\Scripts\python.exe -m pytest -q
cd client
npm run build
```
