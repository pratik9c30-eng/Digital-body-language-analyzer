import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1] / 'server'))
from ml.anomaly_scorer import AnomalyScorer
from ml.baseline_trainer import BaselineModel

BASELINE = [[(index + offset) / 100 for index in range(15)] for offset in range(30)]

def scorer():
    return AnomalyScorer(BaselineModel(BASELINE))

def test_scorer_returns_valid_tier_and_score():
    result = scorer().score(BASELINE[0])
    assert 0 <= result.trust_score <= 100
    assert result.tier in {'silent', 'challenge', 'lock'}

def test_extreme_vector_explains_drift():
    result = scorer().score([1.0] * 15)
    assert result.reasons
