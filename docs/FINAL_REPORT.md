# DBLA Final Report

## 1. What is working

- Local calibration flow persists a baseline profile and stores only derived vectors (no raw text or key capture).
- Backend score path is up and stabilized with a dedicated temporal decision engine in [server/ml/decision_engine.py](../server/ml/decision_engine.py).
- False-positive regression protections were added in [tests/test_decision_engine.py](../tests/test_decision_engine.py).
- The project keeps a privacy boundary: the server rejects raw input keys in [server/privacy/vectorizer.py](../server/privacy/vectorizer.py).
- The frontend still compiles in production mode via Vite, and the backend test suite is green.

## 2. What is still weak

- The mock/demo and product polish remain lighter than a production security platform. The repo still contains several prototype UI pieces and not all phases from the original judge brief were fully implemented.
- AWS integration is intentionally non-fake but still not fully operationalized beyond env-based status reporting.
- A full browser-driven end-to-end judge script has not been run in a real browser in this environment; it was validated using the actual backend tests and compile checks.

## 3. What was fixed

- Replaced the fragile single-threshold anomaly logic with a stateful decision engine that includes:
  - temporal smoothing
  - warm-up gating
  - risk-state progression
  - signal agreement awareness
  - calibration-quality awareness
  - lower false-positive behavior on normal variation
- Kept the existing baseline model and IsolationForest intact; the fix is layered on top rather than replacing the model with random/demo logic.

## 4. What was added

- [server/ml/decision_engine.py](../server/ml/decision_engine.py)
- [tests/test_decision_engine.py](../tests/test_decision_engine.py)
- [docs/AUDIT.md](AUDIT.md)
- [docs/PROGRESS.md](PROGRESS.md)
- [docs/FINAL_REPORT.md](FINAL_REPORT.md)

## 5. What remains risky

- Browser telemetry data is still synthetic-looking unless a real user completes calibration and live monitoring in a real session.
- AWS and external service connects remain environment-gated and may not work without real credentials.
- The system is intentionally conservative and should be treated as a behavioral anomaly monitor rather than a deterministic person-identification engine.

## 6. Exact demo sequence

1. Open the app.
2. Complete calibration with a normal usage pattern.
3. Confirm the calibration quality is acceptable and baseline is stored in the database.
4. Start live monitoring.
5. Observe the trust score staying high and the state staying TRUSTED / silent during realistic variation.
6. Inject a strong drift sample or use the decision-engine test harness to simulate a sustained multi-signal anomaly.
7. Observe risk state move through OBSERVING -> WATCH -> CHALLENGE, depending on persistence and agreement.
8. Confirm explainability output reflects feature drift rather than raw content.
9. Reset benchmark state or re-run future scenarios.

## 7. Exact commands to run backend and frontend

Backend:

```bash
cd "c:/Users/Lenovo/OneDrive/Desktop/hack/digital-body-language-analyzer"
.\.venv\Scripts\python.exe -m uvicorn server.main:app --reload
```

Frontend:

```bash
cd "c:/Users/Lenovo/OneDrive/Desktop/hack/digital-body-language-analyzer/client"
npm install
npm run dev
```

Note: in this environment, PowerShell blocked normal npm script execution due execution-policy restrictions, so the direct Vite binary was used for verification.

## 8. Real test results

Backend verification command:

```bash
cd "c:/Users/Lenovo/OneDrive/Desktop/hack/digital-body-language-analyzer"
.\.venv\Scripts\python.exe -m pytest -q
```

Result: 20 passed in 2.64s

Frontend build verification command:

```bash
cd "c:/Users/Lenovo/OneDrive/Desktop/hack/digital-body-language-analyzer/client"
node .\node_modules\vite\bin\vite.js build
```

Result: Vite production build succeeded; 2874 modules transformed and build completed successfully in 890ms.

## 9. Environment requirements

- Python: 3.12 compatible
- Node: 20+ recommended
- Dependencies: from [server/requirements.txt](../server/requirements.txt) and [client/package.json](../client/package.json)
- Optional environment variables are documented in [.env.example](../.env.example)

## 10. Before/after false-positive comparison

Before the fix:
- The system directly mapped raw anomaly score and bot detection to trust without persistence, hysteresis, or calibration-quality gating.
- Normal variation could push trust downward and trigger challenge states too quickly.

After the fix:
- 40 normal-variation samples remained in TRUSTED/OBSERVING with trust_score staying above the test threshold.
- The decision engine now includes warm-up suppression, smoothing, and confidence-aware state transitions.
- This is validated by the regression suite in [tests/test_decision_engine.py](../tests/test_decision_engine.py), which keeps false positives from standard variance at bay.
