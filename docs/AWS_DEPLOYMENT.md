# Optional AWS Integration

The local WebSocket remains the latency-sensitive scoring path. AWS receives periodic batches of canonical derived features and security metadata only.

```text
Browser SensorFusion -> local WebSocket scoring -> batch of derived vectors
                                               -> API Gateway -> Lambda
                                                  -> DynamoDB
                                                  -> SNS for challenge/lock
Calibration vectors -> S3 -> SageMaker training -> model artifact
```

Raw keys, characters, text, passwords, pointer paths, page content, and raw event streams are rejected by the Lambda contract and are never uploaded.

## Resources

`infra/template.yaml` creates:

- S3 encrypted training bucket
- DynamoDB on-demand session-events table keyed by `user_id` and `timestamp`
- SNS risk topic
- API Gateway HTTP entrypoint
- Lambda function with DynamoDB, S3, and SNS permissions

SageMaker is intentionally optional because training is asynchronous and does not belong in the request path. A training job can read the JSONL files under `calibration/` from S3, fit the same `StandardScaler + IsolationForest` approach used locally, and write a versioned artifact back to S3. Deploy that artifact behind a SageMaker endpoint only if a cloud scorer is needed later; the current browser WebSocket does not call it.

## Environment

Server `.env` values are optional:

```dotenv
AWS_REGION=us-east-1
AWS_S3_BUCKET=dbla-training-<account>
AWS_DYNAMODB_TABLE=DBLA-SessionEvents
AWS_API_GATEWAY_ENDPOINT=https://<api-id>.execute-api.<region>.amazonaws.com/v1/events
AWS_SNS_TOPIC_ARN=arn:aws:sns:<region>:<account>:dbla-risk-events
AWS_SAGEMAKER_ENDPOINT=
AWS_SAGEMAKER_ROLE_ARN=
```

For the frontend, set `VITE_API_GATEWAY_ENDPOINT` to the API Gateway `/events` URL. Leave it empty for local-only development. The client sends one request per five 1.5-second snapshots, not one request per browser event.

## Deploy

Prerequisites: AWS CLI, AWS SAM CLI, and configured AWS credentials in the shell or an instance role. Credentials are never stored in this repository.

```bash
sam build --template-file infra/template.yaml
sam deploy --guided --template-file .aws-sam/build/template.yaml
```

Copy the `ApiEndpoint`, `TrainingBucket`, `SessionEventsTable`, and `RiskTopicArn` outputs into the server `.env` and frontend `VITE_API_GATEWAY_ENDPOINT`. Restart both processes.

## Local development

No AWS credentials or AWS SDK are required locally unless AWS variables are configured. The local API continues to use SQLite and shows `not configured` in the dashboard.

```bash
cd server
uvicorn main:app --reload

cd ../client
npm install
npm run dev
```

## Security notes

Use authenticated API Gateway routes, TLS, restrictive IAM policies, S3 lifecycle/retention rules, DynamoDB TTL, CloudWatch alarms, and encryption keys before production use. The current anonymous session identifier is a demo identifier, not an authentication credential.
