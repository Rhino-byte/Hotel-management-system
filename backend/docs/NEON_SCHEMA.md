# Neon Database Schema (Hotel + Payroll integration)

## Existing payroll tables (unchanged by hotel app)

### `user_auth` — login credentials

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (PK) | Shared with `employee.id` |
| `pin` | integer | Numeric PIN |
| `first_name` | varchar | Used with PIN for login |
| `created_at` | timestamp | |

Hotel login: **first_name + pin** (PIN alone is not unique).

### `employee` — staff records

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (PK) | Same id as `user_auth` |
| `first_name`, `last_name` | varchar | |
| `role` | enum | Payroll: `STAFF`, `MANAGER`, `ADMIN` — **never modified by hotel app** |
| `hotel_role` | enum (nullable) | Hotel: `snacks_clerk`, `food_clerk`, `stock_clerk`, `bar_clerk`, `admin` |

Added by migration `002_employee_hotel_role.sql`.

## Effective hotel access

| Condition | Hotel modules |
|-----------|----------------|
| `employee.role = ADMIN` | Full hotel admin (automatic) |
| `employee.hotel_role = snacks_clerk` | Snacks & Drinks |
| `employee.hotel_role = food_clerk` | Food & Kuku |
| `employee.hotel_role = stock_clerk` | Stock Items |
| `employee.hotel_role = bar_clerk` | Bar Stock |
| `employee.hotel_role = admin` | Full hotel admin |
| No `hotel_role` and not payroll ADMIN | No hotel access — login blocked |

## Clerk onboarding

Before a clerk can use the hotel app, assign `employee.hotel_role`:

1. **UI:** Admin → Employees → select role → Save (see project [README](../../README.md#assigning-clerk-roles-required-before-login)).
2. **Script:** `python scripts/seed_hotel_roles.py` with a first-name → role map.

Clerks see only their module tab plus **Audit** (scoped to their module). Payroll `ADMIN` users get full hotel admin without setting `hotel_role`.

## Hotel tables (migration 001)

FKs reference `employee(id)` for `updated_by`, `submitted_by`, `changed_by`:

- `items`, `item_prices`
- `snacks_drinks_daily`, `food_kuku_daily`, `stock_items_daily`, `bar_daily`
- `inventory_audit_log`

## Setup commands

```bash
cd backend
python scripts/run_migrations.py
python scripts/seed_items_and_prices.py
python scripts/seed_hotel_roles.py   # optional
python scripts/introspect_neon.py
```

## Environment

```env
DATABASE_URL=postgresql://...?sslmode=require
TRANSACTION_DATABASE_URL=postgresql://...?sslmode=require
PHONE_NUMBER=0766106345
JWT_SECRET=...
CORS_ORIGINS=http://localhost:3000
```

`DATABASE_URL` must be a raw PostgreSQL URL (not a `psql '...'` command).

`TRANSACTION_DATABASE_URL` and `PHONE_NUMBER` power Admin → Tills (`transactions.phone_number`, `value_date`, `credit`). If unset, the hotel API still starts; tills endpoints return 503.

### Keeping both Neons awake

`GET /api/health/ready` runs `SELECT 1` on the hotel DB and, when `TRANSACTION_DATABASE_URL` is set, on the transactions DB. The Render cron (`HEALTH_PING_URL` → every 5 minutes) hits this endpoint so **both** projects stay warm on free tier.

Connection pools use health checks, `max_idle`, and TCP keepalives to drop dead SSL sockets; that reduces intermittent errors but does **not** replace keep-warm after scale-to-zero.

On paid Neon plans, for **both** projects (hotel + transactions), prefer disabling scale-to-zero or raising compute idle timeout so the cron is only a backup.
