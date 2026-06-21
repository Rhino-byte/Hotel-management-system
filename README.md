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
| Bar Stock | `bar_clerk`, `admin` | Opening (carried), add, B.B.F closing; same-day sales |
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

### Assigning clerk roles (required before login)

Employees without a hotel role (and who are not payroll `ADMIN`) cannot log in. An admin must assign roles first:

1. Log in as payroll **ADMIN** or hotel **admin**.
2. Open **Admin → Employees**.
3. Search for the employee and choose a **Hotel role** from the dropdown:
   - **Snacks Clerk** → Snacks & Drinks daily entry only
   - **Food Clerk** → Food & Kuku daily entry only
   - **Stock Clerk** → Stock Items daily entry only
   - **Hotel Admin** → full access (prices, catalog, employees, audit)
4. Click **Save** on that row.

Alternatively, bulk-assign via `backend/scripts/seed_hotel_roles.py` (edit the mapping in the script first).

| Hotel role | Dashboard | Audit access |
|------------|-----------|--------------|
| `snacks_clerk` | `/snacks-drinks` | Snacks & Drinks module only |
| `food_clerk` | `/food-kuku` | Food & Kuku module only |
| `stock_clerk` | `/stock-items` | Stock Items module only |
| `bar_clerk` | `/bar` | Bar Stock module only |
| `admin` | All modules + admin tabs | All modules |
