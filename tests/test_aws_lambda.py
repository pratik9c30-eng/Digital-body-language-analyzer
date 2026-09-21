import json
import sys
from pathlib import Path
from unittest.mock import Mock

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "server"))

from aws.lambda_handler import handler
from aws.s3_training import upload_calibration_batch


FEATURES = {name: 0.5 for name in [
    "typing_speed", "dwell_mean", "flight_mean", "digraph_mean", "typing_variance",
    "mouse_velocity", "mouse_acceleration", "mouse_curvature", "mouse_jitter", "click_dwell",
    "scroll_speed", "scroll_reversals", "touch_pressure", "touch_radius", "timing_entropy",
]}


def event(tier="silent"):
    return {"user_id": "anon-session", "timestamp": "2026-09-18T00:00:00Z", "trust_score": 82 if tier == "silent" else 35, "tier": tier, "bot_probability": 0.1, "vector": FEATURES}


def test_lambda_rejects_raw_input_without_aws_clients():
    response = handler({"body": json.dumps({**event(), "vector": {**FEATURES, "text": "secret"}})}, None, dynamodb=Mock(), sns=Mock())
    assert response["statusCode"] == 400


def test_lambda_writes_derived_event_and_notifies_high_risk(monkeypatch):
    monkeypatch.setenv("SNS_TOPIC_ARN", "arn:aws:sns:us-east-1:123456789012:dbla-risk")
    table = Mock()
    dynamodb = Mock()
    dynamodb.Table.return_value = table
    sns = Mock()
    response = handler({"body": json.dumps({"events": [event("silent"), event("lock")]})}, None, dynamodb=dynamodb, sns=sns)
    assert response["statusCode"] == 202
    assert table.put_item.call_count == 2
    assert sns.publish.call_count == 1
    stored = table.put_item.call_args_list[0].kwargs["Item"]
    assert "text" not in stored and len(stored["vector"]) == 15


def test_s3_training_upload_contains_only_supplied_derived_vectors():
    client = Mock()
    key = upload_calibration_batch("dbla-training", "anon-session", [FEATURES], client=client)
    assert key.startswith("calibration/anon-session/")
    body = client.put_object.call_args.kwargs["Body"].decode()
    assert "text" not in body