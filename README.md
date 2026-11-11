# BalanceVault – Secure Digital Wallet

## Project Overview

BalanceVault is a digital wallet application developed as part of the Snovasys Fresher Hiring Challenge 2026.

It demonstrates secure user authentication, customer onboarding, administrator-controlled deposits, money transfers, transaction idempotency, balanced ledger entries, and audit logging.

**Project Status:** Development / Testing

## Technology Stack

### Frontend
- React
- Vite
- JavaScript
- CSS

### Backend
- Node.js
- Express.js
- Prisma ORM

### Database
- PostgreSQL

### Security
- JWT authentication
- bcrypt password hashing
- Role-based access control
- Zod request validation
- Helmet security headers
- Express rate limiting

## Main Features

1. Customer registration and login.
2. Administrator authentication.
3. Customer onboarding approval by an administrator.
4. Customer account creation.
5. Administrator-controlled simulated deposits.
6. Money transfers between active customer accounts.
7. Idempotency keys to prevent duplicate financial operations.
8. Insufficient balance protection.
9. Serializable database transactions.
10. Double-entry ledger records.
11. Audit logging of successful operations.
12. Server-side role-based authorization.

## Project Structure

```text
BalanceVault/
│
├── backend/
│   ├── prisma/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── scripts/
│   ├── .env
│   ├── package.json
│   └── prisma.config.ts
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── index.html
│
├── README.md
├── THREATS.md
└── PROMPTS.md
```

## Prerequisites

Install the following:

- Node.js and npm
- PostgreSQL
- Git
- Visual Studio Code (recommended)

## Backend Setup

Open a terminal and navigate to the backend:

```bash
cd backend
npm install
```

Create a `.env` file inside the backend folder:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/balancevault"
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=1d
ADMIN_EMAIL=admin@balancevault.local
ADMIN_PASSWORD=CHANGE_THIS_PASSWORD
```

Replace the database credentials and secrets with your own values. URL-encode special characters in the database password when required.

Generate the Prisma client and apply migrations:

```bash
npm run db:generate
npm run db:migrate
npm run admin:create
```

Start the backend:

```bash
npm run dev
```

Backend URL:

```text
http://localhost:5000
```

## Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## Important API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Customer registration |
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/me` | Current authenticated user |
| GET | `/api/admin/onboarding/pending` | View pending customers |
| PATCH | `/api/admin/onboarding/:userId/review` | Review customer onboarding |
| POST | `/api/admin/deposits` | Create simulated deposit |
| POST | `/api/transfers` | Transfer money |

Protected endpoints require a valid JWT token.

Admin endpoints require the ADMIN role.

## Transaction Safety

BalanceVault uses idempotency keys for deposit and transfer requests.

Clients must provide an `Idempotency-Key` header for these operations.

The backend checks the request hash to prevent the same key from being reused for a different request.

Money transfers use database transactions, conditional balance updates, and serializable isolation to protect account balances.

Amounts are stored in paise using integer-based values rather than floating-point currency calculations.

## Verification Performed

The following manual tests have been performed:

- Admin and customer login.
- Customer onboarding approval.
- Successful simulated deposit.
- Duplicate deposit request.
- Successful customer-to-customer transfer.
- Duplicate transfer request.
- Insufficient balance rejection.
- Customer access to admin API rejected.
- Audit log verification.
- Debit and credit ledger verification.

The tested ₹200 transfer produced equal debit and credit entries. The tested ₹1,000 deposit also produced equal debit and credit entries.

## Security and Threat Model

See [THREATS.md](THREATS.md) for the identified threats, implemented mitigations, security tests, and known limitations.

## AI Usage Documentation

See [PROMPTS.md](PROMPTS.md) for development prompts, AI suggestions, corrections, and the AI usage declaration.

## Important Limitations

- Deposits are simulated using an internal system funding account. No real bank or payment gateway is connected.
- Production deployment and security hardening are still required.
- Automated test coverage and frontend integration require further verification.
- Failed login and denied-access audit events are not yet confirmed as implemented.

## Future Improvements

- Add comprehensive automated tests.
- Improve frontend transaction history and account dashboard.
- Add production deployment.
- Integrate a payment gateway.
- Expand audit monitoring and security testing.

## Author

Developed individually for the Snovasys Fresher Hiring Challenge 2026.
## Customer transaction history

`GET /api/accounts/transactions` returns the latest 50 transactions involving the authenticated customer's own accounts. The endpoint requires a JWT and an approved, active customer account.

## Deployment checklist

A starter Render Blueprint is included at `render.yaml`. Review the database/service plan and configure the prompted secrets and frontend origin before creating resources.

### Backend service (Render or equivalent)
- Root directory: `backend`
- Build command: `npm ci && npx prisma generate && npx prisma migrate deploy`
- Start command: `npm start`
- Add environment variables: `DATABASE_URL`, `JWT_SECRET` (long random value), `JWT_EXPIRES_IN=1d`, `FRONTEND_URL` (deployed frontend origin), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `NODE_ENV=production`.
- Use a managed PostgreSQL database and its provider's runtime connection string. Ensure the database is reachable from the backend service.
- After first deploy, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (minimum 12 characters), then run `npm run admin:create` from the backend service shell or a one-off command. This creates the first ADMIN user only if that email does not already exist.

### Frontend (Vercel or equivalent)
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL` set to the deployed backend base URL, without a trailing slash.

Set `FRONTEND_URL` on the backend to the exact deployed frontend origin, then redeploy the backend. Verify `/api/health`, `/api/db-health`, customer registration/login, admin approval, deposit, transfer, and transaction history on the deployed URLs.

**Important:** deposits are simulated internal ledger operations. This application is a challenge prototype, not a real bank or payment service. Do not use real customer funds or production financial data.
