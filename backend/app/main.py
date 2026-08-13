import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import engine
from app.models import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto create tables on server startup
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Signal Clone API", version="1.0.0", lifespan=lifespan)

# Enable CORS for frontend requests
allowed_origins_env = os.getenv("CORS_ALLOWED_ORIGINS") or os.getenv("CORS_ORIGIN") or "http://localhost:3000"
# Parse and clean brackets/quotes/spaces from the raw configuration string
raw_origins = allowed_origins_env.split(",")
allowed_origins = []
for origin in raw_origins:
    cleaned = origin.strip().strip("[]'\"")
    if cleaned:
        allowed_origins.append(cleaned)

print(f"CORS raw environment configuration string: {allowed_origins_env}", flush=True)
print(f"CORS parsed and cleaned allow_origins list: {allowed_origins}", flush=True)

if "*" in allowed_origins:
    # Starlette raises RuntimeError if allow_origins=['*'] when allow_credentials=True.
    # We solve this by using allow_origin_regex matching all origins while enabling credentials.
    print("CORS wildcard detected with credentials enabled. Configuring via allow_origin_regex.", flush=True)
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex="https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    print("CORS middleware configured with allow_origins=*", flush=True)
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    print(f"CORS middleware configured with allow_origins={allowed_origins}", flush=True)

from app.routers.auth import router as auth_router
from app.routers.conversations import router as conversations_router
from app.routers.contacts import router as contacts_router
from app.routers.messages import router as messages_router
from app.routers.groups import router as groups_router
from app.ws.routes import router as ws_router

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(auth_router, prefix="/auth")
app.include_router(conversations_router, prefix="/conversations")
app.include_router(contacts_router, prefix="/contacts")
app.include_router(groups_router, prefix="/groups")
app.include_router(messages_router)
app.include_router(ws_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True, reload_dirs=["app"])
