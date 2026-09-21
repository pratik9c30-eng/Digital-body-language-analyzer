from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base

def now(): return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    baseline: Mapped["BaselineProfile | None"] = relationship(back_populates="user", uselist=False)

class BaselineProfile(Base):
    __tablename__ = "baseline_profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    mean: Mapped[list] = mapped_column(JSON, default=list)
    std: Mapped[list] = mapped_column(JSON, default=list)
    samples: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    model_state: Mapped[dict] = mapped_column(JSON, default=dict)
    user: Mapped[User] = relationship(back_populates="baseline")

class SessionEvent(Base):
    __tablename__ = "session_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    trust_score: Mapped[float] = mapped_column(Float)
    tier: Mapped[str] = mapped_column(String(32))
    vector: Mapped[list] = mapped_column(JSON)  # derived values only; raw input never enters this table
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class CalibrationSample(Base):
    __tablename__ = "calibration_samples"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    vector: Mapped[list] = mapped_column(JSON)  # derived values only; raw input never enters this table
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
