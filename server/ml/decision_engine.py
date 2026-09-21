from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from ml.explainability import explain
from config import settings


@dataclass
class DecisionConfig:
    std_floor: float = 0.12
    warmup_samples: int = 4
    entry_threshold: float = 0.55
    watch_threshold: float = 0.68
    challenge_threshold: float = 0.78
    lock_threshold: float = 0.90
    exit_threshold: float = 0.45
    persistence_window: int = 5
    signal_agreement_min: float = 0.28
    min_confidence: float = 0.55
    smoothing_alpha: float = 0.45
    anomaly_z_tolerance: float = settings.anomaly_z_tolerance
    anomaly_z_scale: float = settings.anomaly_z_scale


class DecisionEngine:
    def __init__(self, model: Any, config: DecisionConfig | None = None):
        self.model = model
        self.config = config or DecisionConfig()
        self.ewma = 0.0
        self.samples_seen = 0
        self.recent_scores: deque[float] = deque(maxlen=12)
        self.consecutive_above = 0
        self.consecutive_stable = 0
        self.state = "TRUSTED"

    @staticmethod
    def estimate_calibration_quality(vectors: list[list[float]]) -> dict[str, Any]:
        if not vectors:
            return {"confidence": 0.0, "limited": True, "sample_count": 0, "status": "Calibration quality: Limited"}
        arr = np.asarray(vectors, dtype=float)
        count = len(arr)
        variance = np.nanstd(arr, axis=0)
        feature_variance = float(np.mean(variance))
        diversity = float(np.clip(1.0 - (np.std(arr) / max(1.0, np.mean(np.abs(arr)))), 0.0, 1.0))
        quality = min(1.0, (count / 30.0) * 0.6 + max(0.0, min(1.0, feature_variance / 0.4)) * 0.4)
        limited = count < 12 or feature_variance < 0.05 or not np.isfinite(arr).all()
        result = {
            "confidence": round(float(np.clip(quality, 0.0, 1.0)), 3),
            "limited": bool(limited),
            "sample_count": int(count),
            "feature_variance": round(float(feature_variance), 3),
            "diversity": round(float(diversity), 3),
            "status": "Calibration quality: Limited" if limited else "Calibration quality: Good",
        }
        return result

    def _signal_anomaly(self, z_scores: np.ndarray) -> tuple[float, float, list[float]]:
        z_abs = np.abs(z_scores)
        tolerance = max(0.0, self.config.anomaly_z_tolerance)
        scale = max(1e-6, self.config.anomaly_z_scale)
        excess = np.maximum(z_abs - tolerance, 0.0)
        signal_scores = np.clip(excess / scale, 0.0, 1.0)
        signal_strength = float(np.mean(signal_scores))
        agreement = float(np.mean(signal_scores >= 0.48))
        return signal_strength, agreement, signal_scores.tolist()

    def score(self, vector: list[float]) -> Any:
        anomaly, z = self.model.score(vector)
        z = np.asarray(z, dtype=float)
        signal_strength, signal_agreement, _ = self._signal_anomaly(z)
        base_anomaly = float(np.clip(0.7 * anomaly + 0.3 * signal_strength, 0.0, 1.0))
        calibration = self.estimate_calibration_quality(self.model.vectors)
        confidence = float(calibration["confidence"]) * (0.6 + 0.4 * min(1.0, self.samples_seen / max(1, self.config.warmup_samples + 2)))
        if self.samples_seen < self.config.warmup_samples:
            decision = "TRUSTED"
            self.samples_seen += 1
            self.ewma = 0.20 * base_anomaly + 0.80 * self.ewma
            self.recent_scores.append(self.ewma)
            self.state = decision
            trust_score = float(np.clip(100.0 - (self.ewma * 60.0), 70.0, 100.0))
            result = {
                "trust_score": round(trust_score, 1),
                "tier": "silent",
                "risk_state": "TRUSTED",
                "signal_agreement": round(signal_agreement, 3),
                "decision_confidence": round(float(np.clip(confidence, 0.0, 1.0)), 3),
                "behavioral_anomaly": round(base_anomaly, 3),
                "calibration_quality": calibration["status"],
                "reasons": explain(z.tolist()),
                "automation_likelihood": 0.0,
                "context_confidence": 0.8,
                "overall_trust": round(trust_score, 1),
            }
            return type("DecisionResult", (), result)()

        self.ewma = self.config.smoothing_alpha * base_anomaly + (1.0 - self.config.smoothing_alpha) * self.ewma
        self.recent_scores.append(self.ewma)
        if self.ewma >= self.config.entry_threshold:
            self.consecutive_above += 1
            self.consecutive_stable = 0
        else:
            self.consecutive_above = 0
            self.consecutive_stable += 1

        if self.ewma <= self.config.exit_threshold:
            decision = "TRUSTED"
        elif self.ewma >= self.config.lock_threshold and self.consecutive_above >= 3 and signal_agreement >= 0.5 and confidence >= self.config.min_confidence:
            decision = "RESTRICTED"
        elif self.ewma >= self.config.challenge_threshold and self.consecutive_above >= 2 and signal_agreement >= 0.45 and confidence >= self.config.min_confidence:
            decision = "CHALLENGE"
        elif self.ewma >= self.config.watch_threshold and self.consecutive_above >= 2 and signal_agreement >= self.config.signal_agreement_min:
            decision = "WATCH"
        elif self.ewma >= self.config.entry_threshold and self.consecutive_above >= 1:
            decision = "OBSERVING"
        else:
            decision = "TRUSTED"

        if decision == "TRUSTED" and self.consecutive_stable >= 3:
            self.state = "TRUSTED"
        elif decision in {"OBSERVING", "WATCH", "CHALLENGE", "RESTRICTED"}:
            self.state = decision

        trust_score = float(np.clip(100.0 * (1.0 - min(1.0, self.ewma * 0.8 + max(0.0, 1.0 - confidence) * 0.2)), 0.0, 100.0))
        if decision == "TRUSTED":
            trust_score = max(trust_score, 80.0)
        if decision == "OBSERVING":
            trust_score = max(trust_score, 70.0)
        if decision == "WATCH":
            trust_score = max(trust_score, 55.0)
        if decision == "CHALLENGE":
            trust_score = max(trust_score, 42.0)
        tier = {
            "TRUSTED": "silent",
            "OBSERVING": "silent",
            "WATCH": "challenge",
            "CHALLENGE": "challenge",
            "RESTRICTED": "lock",
        }[decision]
        result = {
            "trust_score": round(trust_score, 1),
            "tier": tier,
            "risk_state": decision,
            "signal_agreement": round(signal_agreement, 3),
            "decision_confidence": round(float(np.clip(confidence, 0.0, 1.0)), 3),
            "behavioral_anomaly": round(float(base_anomaly), 3),
            "calibration_quality": calibration["status"],
            "reasons": explain(z.tolist()),
            "automation_likelihood": round(float(np.clip(np.mean(np.abs(z[::3])) / 4.0, 0.0, 1.0)), 3),
            "context_confidence": round(float(np.clip(confidence * (1.0 - 0.35 * (1.0 - signal_agreement)), 0.0, 1.0)), 3),
            "overall_trust": round(trust_score, 1),
        }
        self.samples_seen += 1
        return type("DecisionResult", (), result)()
