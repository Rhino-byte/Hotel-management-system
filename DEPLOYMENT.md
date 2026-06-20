# Deployment Guide

## Backend (Render)

1. Create a **Web Service** on [Render](https://render.com) connected to this repo.
2. Set **Root Directory** to `backend` (or use [`backend/render.yaml`](backend/render.yaml) Blueprint).
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Set environment variables:
   - `DATABASE_URL` — Neon PostgreSQL connection string
   - `JWT_SECRET` — long random secret
   - `CORS_ORIGINS` — your Vercel frontend URL(s), comma-separated

### First-time DB setup

```bash
cd backend
export DATABASE_URL="your-neon-url"
pip install -r requirements.txt
python scripts/run_migrations.py
python scripts/seed_items_and_prices.py
python scripts/introspect_neon.py
```

## Frontend (Vercel)

1. Import the repo with **Root Directory** set to `frontend`.
2. Set `NEXT_PUBLIC_API_BASE` to your Render API URL (e.g. `https://hotel-api.onrender.com`).

## Local development

**API:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Ensure `frontend/.env` has `NEXT_PUBLIC_API_BASE=http://localhost:8000` and the API has `CORS_ORIGINS=http://localhost:3000`.

## User roles

Users must exist in Neon with bcrypt `password_hash` and one of:
`admin`, `snacks_clerk`, `food_clerk`, `stock_clerk`

Hash a password for seeding:
```bash
cd backend
python scripts/hash_password.py "your-password"
```
