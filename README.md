# StayNest — Apartment Booking Website

A full-stack apartment discovery and booking application built with React, Vite, Express, PostgreSQL and JWT.

## Features

- Responsive branded apartment discovery interface with search and filters
- Apartment details, amenities, availability and nightly pricing
- User registration/login with hashed passwords and JWT authentication
- Create bookings with date validation, Paystack checkout and payment verification
- Customer dashboard: view and cancel pending bookings
- Admin dashboard: create, edit and delete apartment listings; view bookings
- Server-side validation, parameterized SQL, security headers and rate limiting
- Seeded demo apartments and admin account

## Requirements

Node.js 20+ and npm.
PostgreSQL 14+ (local or hosted).

## Run locally

Open two terminals:

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
# Create a PostgreSQL login and database (choose your own password)
sudo -u postgres psql -c "CREATE ROLE staynest LOGIN PASSWORD 'change-this-password';"
sudo -u postgres psql -c "CREATE DATABASE staynest OWNER staynest;"
npm run seed
npm run dev
```

The example `.env` already uses that role/password in `DATABASE_URL`. If you choose a different password, update both the SQL command and the connection string.

API: http://localhost:5000

Demo admin:

- Email: admin@staynest.local
- Password: StayNest@2026

### Move the backend database to Aiven

The backend uses PostgreSQL. To copy an existing local database, keep
`DATABASE_URL` pointed at the source and fill in `AIVEN_HOST`, `AIVEN_PORT`,
`AIVEN_DATABASE`, `AIVEN_USER`, `AIVEN_PASSWORD`, and `AIVEN_SSL_CA` in
`backend/.env` using the connection details and CA certificate from the Aiven
Console. Alternatively, set `AIVEN_DATABASE_URL` instead of the five connection
fields. Run `cd backend && npm run db:migrate:aiven`. The command only restores
into an Aiven database with no public tables and compares the important table
row counts before it finishes. After it succeeds, change `DATABASE_URL` to the
Aiven connection URL and set `PGSSL=true` and `PGSSL_CA` to the Aiven CA path for
the running backend.

For Render, do not use a workstation-only `PGSSL_CA` path. Create a one-line
base64 value from the downloaded CA certificate with
`base64 -w0 backend/ca.pem`, then set it as `PGSSL_CA_BASE64` in the Render
service environment. Keep `PGSSL=true`; the backend decodes the certificate
and verifies the Aiven TLS connection.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

The frontend proxies `/api` to the backend. Set `DATABASE_URL` to your PostgreSQL connection string. For hosted PostgreSQL providers that require TLS, set `PGSSL=true`. Add your Paystack test secret as `PAYSTACK_SECRET_KEY`; set `API_URL` to the publicly reachable backend base URL for Paystack's return callback. Payment-link and enquiry emails use Resend: create a Resend API key, verify the sender domain, and set `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (for example, `StayNest <bookings@your-verified-domain.com>`), and `INQUIRY_NOTIFY_EMAIL` in `backend/.env`. Booking checkout is unavailable until the Resend key and sender are configured, so the payment link can be emailed before checkout opens. Resend must authorize the sender domain before delivery; do not expose the API key in frontend variables. For deployment, set `VITE_API_URL` to your backend URL and configure backend `DATABASE_URL`, `PGSSL` as needed, `CLIENT_URL`, `JWT_SECRET`, `PAYSTACK_SECRET_KEY`, `API_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `INQUIRY_NOTIFY_EMAIL`, and `PORT`.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/apartments`, `GET /api/apartments/:id`
- `POST /api/newsletter/subscribe` (public, explicit email consent required)
- `POST /api/apartments` (admin), `PUT /api/apartments/:id` (admin), `DELETE /api/apartments/:id` (admin)
- `POST /api/payments/initialize` (optional authentication; guest name/email required without an account), `GET /api/payments/verify/:reference` (authenticated)
- `GET /api/payments/callback` (Paystack return URL), `GET /api/bookings/mine`, `PATCH /api/bookings/:id/cancel`
- `GET /api/admin/bookings` (admin)
- `GET /api/health`

## Version control (5 marks)

```bash
git init
git add .
git commit -m "feat: build StayNest apartment booking platform"
git branch -M main
```

Suggested additional commits: `feat: add authentication`, `feat: implement apartment listings`, `feat: add booking workflow`, `style: create responsive StayNest UI`.

## Important

The backend creates the PostgreSQL tables automatically on startup. Existing SQLite data is not automatically copied; export and import it separately before switching an existing installation. Use Paystack test keys for testing and live keys only over HTTPS. Payment confirmation is verified server-to-server with Paystack before a booking is marked confirmed. Use a strong unique JWT secret and managed database backups before deployment.

# booking-apartment
