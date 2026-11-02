# StayNest — Apartment Booking Website

A full-stack apartment discovery and booking application built with React, Vite, Express, SQLite and JWT.

## Features
- Responsive branded apartment discovery interface with search and filters
- Apartment details, amenities, availability and nightly pricing
- User registration/login with hashed passwords and JWT authentication
- Create bookings with date validation and overlap prevention
- Customer dashboard: view and cancel pending bookings
- Admin dashboard: create, edit and delete apartment listings; view bookings
- Server-side validation, parameterized SQL, security headers and rate limiting
- Seeded demo apartments and admin account

## Requirements
Node.js 20+ and npm.

## Run locally
Open two terminals:

### 1. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev
```
API: http://localhost:5000

Demo admin:
- Email: admin@staynest.local
- Password: StayNest@2026

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

The frontend proxies `/api` to the backend. For deployment, set `VITE_API_URL` to your backend URL and configure backend `CLIENT_URL`, `JWT_SECRET`, and `PORT`.

## API overview
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/apartments`, `GET /api/apartments/:id`
- `POST /api/apartments` (admin), `PUT /api/apartments/:id` (admin), `DELETE /api/apartments/:id` (admin)
- `POST /api/bookings` (authenticated), `GET /api/bookings/mine`, `PATCH /api/bookings/:id/cancel`
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
This is a coursework-ready demonstration, not a production payment system. Payments are intentionally not collected. Before real deployment, use HTTPS, a strong unique JWT secret, managed database backups, email verification, and a payment provider.
# booking-apartment
