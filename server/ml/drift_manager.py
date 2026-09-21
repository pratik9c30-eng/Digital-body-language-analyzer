import numpy as np

class DriftManager:
    """Dual time constants: fast observation, slow trusted baseline adaptation."""
    def __init__(self, mean: list[float] | None = None, std: list[float] | None = None):
        self.mean = np.asarray(mean or [0.5] * 15, dtype=float)
        self.std = np.maximum(np.asarray(std or [0.2] * 15, dtype=float), 0.08)
        self.confidence = 0.6

    def update(self, vector: list[float], anomaly: float) -> None:
        if anomaly < 0.25:
            values = np.asarray(vector, dtype=float)
            self.mean = self.mean * 0.985 + values * 0.015
            self.std = np.maximum(self.std * 0.985 + np.abs(values - self.mean) * 0.015, 0.08)
            self.confidence = min(0.99, self.confidence + 0.01)
        else:
            self.confidence = max(0.1, self.confidence - 0.03)
