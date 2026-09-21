import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'server'))

from ml.baseline_trainer import BaselineModel
from ml.decision_engine import DecisionConfig, DecisionEngine


def build_baseline(n=40):
    rows = []
    for i in range(n):
        row = [
            1.0 + (i % 7) * 0.02,
            0.85 + (i % 5) * 0.015,
            0.92 + (i % 4) * 0.012,
            0.9 + (i % 6) * 0.018,
            0.8 + (i % 8) * 0.016,
            1.1 + (i % 10) * 0.02,
            0.88 + (i % 9) * 0.017,
            0.95 + (i % 11) * 0.019,
            0.87 + (i % 6) * 0.018,
            0.81 + (i % 7) * 0.015,
            1.25 + (i % 5) * 0.02,
            0.7 + (i % 4) * 0.014,
            0.5 + (i % 3) * 0.01,
            0.6 + (i % 4) * 0.012,
            0.95 + (i % 7) * 0.02,
        ]
        rows.append(row)
    return rows


def test_decision_engine_keeps_normal_variation_trusted():
    baseline = build_baseline(50)
    engine = DecisionEngine(BaselineModel(baseline), DecisionConfig(warmup_samples=2, entry_threshold=0.56, exit_threshold=0.40))

    for i in range(40):
        sample = baseline[i % len(baseline)].copy()
        sample[0] += (i % 3 - 1) * 0.12
        sample[5] += (i % 2) * 0.09
        result = engine.score(sample)
        assert result.trust_score >= 75, f"unexpected alert on normal variation: {result.trust_score} {result.risk_state}"
        assert result.risk_state in {"TRUSTED", "OBSERVING"}


def test_single_signal_spike_does_not_lock():
    baseline = build_baseline(50)
    engine = DecisionEngine(BaselineModel(baseline), DecisionConfig(warmup_samples=1, entry_threshold=0.58, exit_threshold=0.42))
    spike = baseline[0].copy()
    spike[0] += 5.0
    result = engine.score(spike)
    assert result.risk_state in {"TRUSTED", "OBSERVING", "WATCH"}
    assert result.trust_score > 35
    assert not math.isnan(result.trust_score)


def test_warmup_waits_before_severe_actions():
    baseline = build_baseline(50)
    engine = DecisionEngine(BaselineModel(baseline), DecisionConfig(warmup_samples=4, entry_threshold=0.52, exit_threshold=0.35))
    for _ in range(3):
        result = engine.score([x * 1.8 for x in baseline[0]])
        assert result.risk_state in {"TRUSTED", "OBSERVING"}


def test_calibration_quality_detects_weak_samples():
    weak_vectors = [[1.0 for _ in range(15)] for _ in range(6)]
    quality = DecisionEngine.estimate_calibration_quality(weak_vectors)
    assert quality["limited"] is True
    assert quality["confidence"] < 0.7
