import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / 'server'))

from ml.anomaly_scorer import AnomalyScorer
from ml.baseline_trainer import BaselineModel
from privacy.vectorizer import sanitize_features
from routes.session_ws import scorer_for_user


def samples(count=30):
    return [[(index + offset) / 100 for index in range(15)] for offset in range(count)]


def test_calibration_creates_real_serializable_baseline():
    model = BaselineModel(samples())
    state = model.state()

    restored = BaselineModel.from_state(state)
    assert len(restored.mean) == 15
    assert len(restored.std) == 15
    assert len(restored.vectors) == 30
    assert AnomalyScorer(restored).score(samples()[0]).trust_score >= 0


def test_uncalibrated_model_cannot_score():
    with pytest.raises(ValueError):
        BaselineModel([])


def test_uncalibrated_user_has_no_live_scorer():
    class EmptySession:
        async def get(self, model, user_id):
            return None

    assert asyncio.run(scorer_for_user(EmptySession(), "uncalibrated")) is None


def test_calibrated_user_can_be_scored():
    result = AnomalyScorer(BaselineModel(samples())).score(samples()[10])
    assert result.tier in {'silent', 'challenge', 'lock'}


def test_session_vectors_are_derived_only():
    vector = sanitize_features({"typing_speed": 0.5, "mouse_velocity": 0.2})
    assert len(vector) == 15
    assert all(isinstance(value, float) for value in vector)


def test_raw_input_is_rejected():
    with pytest.raises(ValueError, match="raw input"):
        sanitize_features({"code": "KeyA", "typing_speed": 0.5})


def test_unknown_input_is_rejected():
    with pytest.raises(ValueError, match="canonical"):
        sanitize_features({"pointer_path": [[0, 0]], "typing_speed": 0.5})