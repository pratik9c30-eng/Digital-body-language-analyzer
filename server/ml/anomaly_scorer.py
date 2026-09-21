from datetime import datetime

import numpy as np

from ml.baseline_trainer import BaselineModel
from ml.bot_detector import bot_probability
from ml.decision_engine import DecisionConfig, DecisionEngine
from ml.explainability import explain


class ScoreResult:
    def __init__(self, score, tier, reasons, bot_score, **extra):
        self.trust_score = score
        self.tier = tier
        self.reasons = reasons
        self.bot_score = bot_score
        self.extra = extra

    def as_dict(self):
        payload = {
            "trust_score": self.trust_score,
            "tier": self.tier,
            "trust": self.trust_score,
            "risk_tier": "verify" if self.tier == "lock" else "watch" if self.tier == "challenge" else "silent",
            "reasons": self.reasons,
            "bot_probability": self.bot_score,
            "timestamp": datetime.now().isoformat(),
        }
        payload.update(self.extra)
        return payload


class AnomalyScorer:
    def __init__(self, model: BaselineModel, config: DecisionConfig | None = None):
        self.model = model
        self.engine = DecisionEngine(model, config)

    def score(self, vector: list[float]) -> ScoreResult:
        result = self.engine.score(vector)
        bot = bot_probability(vector)
        tier = result.tier
        reasons = getattr(result, "reasons", explain(self.model.score(vector)[1].tolist()))
        score = float(getattr(result, "trust_score", 100.0))
        payload = {
            "signal_agreement": getattr(result, "signal_agreement", 0.0),
            "decision_confidence": getattr(result, "decision_confidence", 0.5),
            "risk_state": getattr(result, "risk_state", "TRUSTED"),
            "calibration_quality": getattr(result, "calibration_quality", "Calibration quality: Good"),
            "behavioral_anomaly": getattr(result, "behavioral_anomaly", 0.0),
        }
        return ScoreResult(score, tier, reasons, bot, **payload)
