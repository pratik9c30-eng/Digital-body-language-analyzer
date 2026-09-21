from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    db_url: str = "sqlite+aiosqlite:///./data/dbla.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    alert_webhook_url: str = ""
    aws_region: str = ""
    aws_s3_bucket: str = ""
    aws_dynamodb_table: str = ""
    aws_api_gateway_endpoint: str = ""
    aws_sns_topic_arn: str = ""
    aws_sagemaker_endpoint: str = ""
    aws_sagemaker_role_arn: str = ""
    calibration_min_quality: float = 0.55
    calibration_min_signal_quality: float = 0.5
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
