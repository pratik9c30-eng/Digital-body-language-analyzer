# Digital Body Language Analyzer (DBLA)

DBLA is a passwordless, continuous-authentication prototype. It learns a person's behavioral fingerprint from timing and motion statistics, then streams a trust score while they work. It never transmits or stores raw keystrokes, text, pointer paths, or page content.

## Architecture

```text
Browser-native events -> statistical feature vector -> WebSocket -> FastAPI
       |                         |                         |
  keyboard/pointer          no raw input             sklearn scorer
  wheel/touch               leaves browser           -> trust/tier/reasons
                                                           |
                                         silent / challenge / session lock
```

The MVP uses `StandardScaler + IsolationForest`, a bot signal based on timing variance/entropy, adaptive drift management, circadian sensitivity, and plain-English z-score explanations. The model interface is intentionally isolated so a PyTorch autoencoder can replace it later. A service worker/model cache can add fully offline scoring later; the current capture layer already works offline until a score is needed.

## Run

### First-time Windows setup

PowerShell commands:

```powershell
py -3.12 -m venv .venv
& .\.venv\Scripts\Activate.ps1
pip install -r server\requirements.txt
Set-Location client
npm install
Set-Location ..
Copy-Item client\.env.example client\.env
Copy-Item server\.env.example server\.env
```

Start both services with one command:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

The API binds to `0.0.0.0:8000` and the Vite client to `5173`. AWS is optional; with blank AWS variables the server uses SQLite in `data/dbla.db`.

With Docker:

```bash
docker-compose up --build
```

Open `http://localhost:5173`. Health endpoints are `http://localhost:8000/` and `http://localhost:8000/health`.
The optional AWS pipeline, SAM template, environment variables, and SageMaker guidance are documented in [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md). AWS is not required for local development.

Without Docker, use Python 3.12 and Node 20:

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload

cd ../client
npm install
npm run dev
```

To exercise calibration and scoring without browser input:

```powershell
& .\.venv\Scripts\python.exe scripts\simulate.py
```

## Privacy contract

`server/privacy/vectorizer.py` rejects payload keys such as `text`, `key`, `code`, and `value`. Only the canonical 15-number vector is accepted. The database schema stores derived vectors and scores, never raw input. This is a product boundary, not just a UI promise.

## 60-second demo

1. Start the stack and type naturally into calibration until the progress bar enables live mode.
2. Show the live trust gauge, animated behavioral heartbeat, trust drift chart, and anonymous organization pulse.
3. Keep moving and typing normally: the stream stays green and the explanation panel stays quiet.
4. Have a second person type with a very different cadence, or use the browser devtools to send repetitive timing: the score falls, reasons appear, and the passive checkpoint activates.
5. Sweep rapidly from one corner of the browser to the opposite corner to demonstrate the hidden duress lock.
6. Close on the privacy statement: the session can be reviewed as anonymized vectors, never as content.

## Extension points

- Export/import: encrypt a baseline vector distribution with Web Crypto before cross-device transfer.
- Forensics: persist vector windows and render ghost cursor paths without content.
- Offline: cache a compact scorer in a service worker and reconcile events when connected.
- Autoencoder: implement the same `score(vector) -> anomaly, z_scores` interface in `server/ml`.
