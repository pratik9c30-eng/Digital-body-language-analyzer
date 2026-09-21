import json
from datetime import datetime, timezone


def upload_calibration_batch(bucket: str, user_id: str, vectors: list[dict], *, client=None) -> str:
    """Upload only canonical derived vectors as JSONL training data."""
    if client is None:
        import boto3
        client = boto3.client("s3")
    key = f"calibration/{user_id}/{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.jsonl"
    body = "".join(json.dumps(vector, separators=(",", ":")) + "\n" for vector in vectors)
    client.put_object(Bucket=bucket, Key=key, Body=body.encode("utf-8"), ContentType="application/jsonl")
    return key