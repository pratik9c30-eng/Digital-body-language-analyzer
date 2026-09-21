# Architecture

## Data flow

1. Event listeners in the browser maintain rolling aggregates. Keyboard events use `event.code` only for pairing down/up timestamps; the code and any text are discarded immediately.
2. `SensorFusion` creates a fixed 15-feature vector every 1.5 seconds.
3. The WebSocket accepts JSON only after `privacy.vectorizer.sanitize_features` removes the possibility of raw input.
4. `AnomalyScorer` combines IsolationForest drift, bot probability, and a time-of-day multiplier into a 0-100 trust score.
5. The client maps `silent`, `challenge`, and `lock` to visible state, passive verification, or session hold.

## Storage and security

SQLite stores user baseline distributions and anonymized session vectors. It does not store event payloads. Production deployment should add authenticated device-bound encryption keys, TLS, rate limiting, and a retention job.

## Model evolution

`BaselineModel` is the swap boundary. The current MVP is deliberately small and explainable. A future autoencoder should return an anomaly magnitude and feature-level reconstruction contributions so the existing scorer and UI remain stable.
