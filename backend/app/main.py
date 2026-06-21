import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import cors_origins, is_production, validate_settings
from app.routers import admin, auth, bar, food_kuku, health, inventory, snacks_drinks, stock_items
from db.connection import close_pool, init_pool, load_env_file

load_env_file()
validate_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_pool()
    yield
    close_pool()


_prod = is_production()
app = FastAPI(
    title="Hotel Management API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None if _prod else "/docs",
    redoc_url=None if _prod else "/redoc",
    openapi_url=None if _prod else "/openapi.json",
)


@app.get("/")
def root():
    return {"service": "Hotel Management API", "health": "/api/health"}


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(snacks_drinks.router, prefix="/api")
app.include_router(food_kuku.router, prefix="/api")
app.include_router(stock_items.router, prefix="/api")
app.include_router(bar.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
