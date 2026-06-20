import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, auth, food_kuku, health, inventory, snacks_drinks, stock_items
from db.connection import close_pool, init_pool, load_env_file

load_env_file()


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_pool()
    yield
    close_pool()


app = FastAPI(title="Hotel Management API", version="2.0.0", lifespan=lifespan)


@app.get("/")
def root():
    return {"service": "Hotel Management API", "docs": "/docs", "health": "/api/health"}


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(snacks_drinks.router, prefix="/api")
app.include_router(food_kuku.router, prefix="/api")
app.include_router(stock_items.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
