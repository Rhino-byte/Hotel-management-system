# Hotel Management System

Daily stock and sales tracking for hotel operations, backed by **Neon PostgreSQL**, with a **FastAPI** backend on **Render** and a **Next.js** frontend on **Vercel**.

## Architecture

```
Hotel-management-system/
├── backend/          # FastAPI API, db layer, migrations, scripts
└── frontend/         # Next.js UI
```

- **Frontend (Vercel):** `frontend/` — role-gated daily entry UI
- **API (Render):** `backend/app/` — JWT auth, CRUD for three modules
- **Database (Neon):** existing `users` table + items, prices, daily records, audit log

## Modules

| Module | Role | Data collected |
|--------|------|----------------|
| Snacks & Drinks | `snacks_clerk`, `admin` | Closing stock + added stock per item/day |
| Food & Kuku | `food_clerk`, `admin` | Quantity sold per dish/day |
| Stock Items | `stock_clerk`, `admin` | Raw material closing + added stock |
| Admin | `admin` | Prices, stock catalog, audit views |

## Quick start (local)

### 1. Database

```bash
cd backend
cp .env.example .env
# Set DATABASE_URL to your Neon connection string

pip install -r requirements.txt
python scripts/run_migrations.py
python scripts/seed_items_and_prices.py
```

See [backend/docs/NEON_SCHEMA.md](backend/docs/NEON_SCHEMA.md) for user table requirements.

### 2. API

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for Render + Vercel setup.

## Project structure

```
backend/
├── app/
│   ├── main.py           # FastAPI entrypoint
│   ├── security.py       # JWT + bcrypt
│   ├── deps.py           # Auth dependencies
│   ├── routers/          # Route handlers by domain
│   └── schemas/          # Pydantic request/response models
├── db/                   # PostgreSQL access layer
├── core/                 # Catalog, roles, pricing helpers
├── migrations/
├── scripts/
└── render.yaml

frontend/
├── app/                  # Next.js routes
├── components/           # Shared UI
└── lib/
    ├── api/              # API client by domain
    ├── auth.tsx          # Auth context
    └── types.ts
```

## User roles

Login uses **first name + PIN** from existing `user_auth` (payroll unchanged).

Hotel access is controlled by `employee.hotel_role`, except payroll `ADMIN` which gets full hotel access automatically.

Assign roles via **Admin → Employees** in the UI, or `scripts/seed_hotel_roles.py`.
