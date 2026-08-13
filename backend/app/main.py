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
# Typically frontend runs on localhost:3000, but we also allow other origins for robustness.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers.auth import router as auth_router
from app.routers.conversations import router as conversations_router
from app.routers.contacts import router as contacts_router
from app.routers.messages import router as messages_router
from app.ws.routes import router as ws_router

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(auth_router, prefix="/auth")
app.include_router(conversations_router, prefix="/conversations")
app.include_router(contacts_router, prefix="/contacts")
app.include_router(messages_router)
app.include_router(ws_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
