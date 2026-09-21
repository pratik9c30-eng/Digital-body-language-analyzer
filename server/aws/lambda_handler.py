import base64
import json
import os
from datetime import datetime, timezone

from aws.contract import RISK_TIERS, validate_event


def _clients():
    import boto3

    region = os.getenv("AWS_REGION", "us-east-1")
    return boto3.resource("dynamodb", region_name=region), boto3.client("sns", region_name=region)


def _body(event: dict) -> dict:
    body = event.get("body", event)
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    return json.loads(body) if isinstance(body, str) else body


def handler(event, context, *, dynamodb=None, sns=None):
    """API Gateway/Lambda entrypoint. Dependencies are injectable for local tests."""
    payload = _body(event)
    items = payload.get("events", [payload]) if isinstance(payload, dict) else payload
    if not isinstance(items, list) or not items:
        return {"statusCode": 400, "body": json.dumps({"error": "events must be a non-empty list"})}
    try:
        records = [validate_event(item) for item in items]
    except (TypeError, ValueError, KeyError, json.JSONDecodeError) as error:
        return {"statusCode": 400, "body": json.dumps({"error": str(error)})}
    table_name = os.getenv("DYNAMODB_TABLE", "")
    topic_arn = os.getenv("SNS_TOPIC_ARN", "")
    if dynamodb is None or sns is None:
        dynamodb, sns = _clients()
    table = dynamodb.Table(table_name)
    for record in records:
        table.put_item(Item={**record, "received_at": datetime.now(timezone.utc).isoformat()})
        if record["tier"] in RISK_TIERS and topic_arn:
            sns.publish(TopicArn=topic_arn, Subject="DBLA high-risk session", Message=json.dumps({"user_id": record["user_id"], "tier": record["tier"], "trust_score": record["trust_score"], "timestamp": record["timestamp"]}))
    return {"statusCode": 202, "body": json.dumps({"accepted": len(records)})}