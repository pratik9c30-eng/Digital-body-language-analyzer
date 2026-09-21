from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from db.database import init_db
from routes.auth import router as auth_router
from routes.calibration import router as calibration_router
from routes.session_ws import router as ws_router
from routes.admin import router as admin_router, public_router as public_admin_router

cors_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]

app = FastAPI(title="Digital Body Language Analyzer", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True,
    expose_headers=["*"],
)
app.include_router(auth_router)
app.include_router(calibration_router)
app.include_router(admin_router)
app.include_router(public_admin_router)
app.include_router(ws_router)

@app.get("/")
async def root():
    return {"status": "ok", "service": "dbla"}

@app.on_event("startup")
async def startup(): await init_db()

@app.get("/health")
async def health():
    mode = "aws" if settings.aws_region and settings.aws_dynamodb_table else "local"
    return {"status": "ok", "mode": mode, "version": app.version, "privacy": "derived-vectors-only"}


@app.get("/api/health")
async def api_health():
    return await health()
