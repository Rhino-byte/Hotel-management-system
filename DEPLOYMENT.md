# Deployment Guide

## Backend (Render)

1. Create a **Web Service** on [Render](https://render.com) connected to this repo.
2. Set **Root Directory** to `backend` (or use [`backend/render.yaml`](backend/render.yaml) Blueprint).
3. **Build command:** `pip install -r requirements.txt && python scripts/run_migrations.py`
4. **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Set environment variables:
   - `DATABASE_URL` — Neon PostgreSQL connection string (`?sslmode=require`)
   - `JWT_SECRET` — long random secret (at least 32 characters; app refuses to start in production without it)
   - `APP_ENV` — set to `production` on Render
   - `CORS_ORIGINS` — your Vercel frontend URL(s) only, comma-separated (https)
   - `LOGIN_RATE_LIMIT_MAX` — optional, default `5` failed attempts
   - `LOGIN_RATE_LIMIT_WINDOW_SEC` — optional, default `900` (15 minutes)

### First-time DB setup

```bash
cd backend
export DATABASE_URL="your-neon-url"
pip install -r requirements.txt
python scripts/run_migrations.py
python scripts/seed_items_and_prices.py
python scripts/introspect_neon.py
```

Migration `003_admin_action_log.sql` creates the admin action audit table (price changes, role assignments, catalog updates).

### Production security checklist

- `APP_ENV=production` disables FastAPI `/docs` and validates secrets on startup
- Login is rate-limited per IP + first name
- Only payroll `ADMIN` can assign `hotel_role = admin`
- Admin mutations are logged to `admin_action_log` (`GET /api/admin/actions` for review)

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
`admin`, `snacks_clerk`, `food_clerk`, `stock_clerk`, `bar_clerk`

Hash a password for seeding:
```bash
cd backend
python scripts/hash_password.py "your-password"
```

## Troubleshooting

### Symptom: all API routes return 500 or 502 on Vercel

1. In Vercel → Project → Settings → Environment Variables, set `NEXT_PUBLIC_API_BASE` to your Render API URL (e.g. `https://hotel-api.onrender.com`, no trailing slash).
2. **Redeploy** the frontend — `NEXT_PUBLIC_API_BASE` is baked in at build time for Next.js rewrites and direct API calls.
3. Confirm the API is up:
   ```bash
   curl https://YOUR-RENDER-URL/api/health
   curl https://YOUR-RENDER-URL/api/health/ready
   ```
   `/health` returns `{"status":"ok"}`. `/health/ready` returns 200 only when the database is reachable.

### Symptom: one module returns 500 after a deploy (e.g. `/api/snacks-drinks`)

1. Open Render → your web service → **Logs** and reproduce the request. Look for SQL errors (e.g. `column "subcategory" does not exist`).
2. Run pending migrations against production Neon:
   ```bash
   cd backend
   export DATABASE_URL="postgresql://..."
   python scripts/run_migrations.py
   ```
3. Redeploy the backend if the Render build did not run migrations automatically.

### Symptom: 401 on login or unexpected logouts

- Ensure `JWT_SECRET` on Render is set and **unchanged** across redeploys (changing it invalidates all tokens).
- Confirm the user has a `hotel_role` assigned in Neon.

### Symptom: first request after idle is very slow or times out

- Render free tier **cold starts** can take 30–60 seconds. Retry or upgrade the plan.
- Ping `/api/health` periodically if you need the service warm.

### Symptom: CORS errors in the browser (not HTTP 500)

- Set Render `CORS_ORIGINS` to your exact Vercel URL, e.g. `https://hotel-management-system-x4z7.vercel.app` (comma-separated if multiple).
- After enabling direct browser → Render API calls, CORS must include the frontend origin.

### Quick health checks

| Endpoint | Expected |
|----------|----------|
| `GET /api/health` | `200` `{"status":"ok"}` |
| `GET /api/health/ready` | `200` `{"status":"ok","database":"ok"}` or `503` if DB down |

Render logs are the source of truth for 500 errors — the frontend may only show `HTTP 500 for https://your-vercel-app.vercel.app` because that is the request origin in the browser.
