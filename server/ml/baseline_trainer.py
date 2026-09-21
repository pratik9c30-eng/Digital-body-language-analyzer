import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from ml.feature_schema import FEATURE_COUNT

class BaselineModel:
    """A trained per-user model with a serializable sample-matrix state."""
    def __init__(self, vectors: list[list[float]]):
        self.scaler = StandardScaler()
        self.detector = IsolationForest(contamination=0.08, random_state=7, n_estimators=80)
        self.fit(vectors)

    def fit(self, vectors: list[list[float]]) -> None:
        data = np.asarray(vectors, dtype=float)
        if len(data) < 3 or data.ndim != 2 or data.shape[1] != FEATURE_COUNT:
            raise ValueError(f"baseline requires at least 3 vectors with {FEATURE_COUNT} features")
        if not np.isfinite(data).all():
            raise ValueError("baseline vectors must contain finite numbers")
        self.scaler.fit(data)
        self.detector.fit(self.scaler.transform(data))
        self.mean = data.mean(axis=0)
        self.std = np.maximum(data.std(axis=0), 0.12)
        self.vectors = data.tolist()

    def state(self) -> dict:
        return {"vectors": self.vectors}

    @classmethod
    def from_state(cls, state: dict) -> "BaselineModel":
        return cls(state["vectors"])

    def score(self, vector: list[float]) -> tuple[float, np.ndarray]:
        values = np.asarray(vector, dtype=float)
        z = (values - self.mean) / self.std
        anomaly = float(np.clip(-self.detector.decision_function(self.scaler.transform([values]))[0], 0, 1))
        return anomaly, z
