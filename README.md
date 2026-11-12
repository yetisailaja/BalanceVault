# BalanceVault – Secure Digital Wallet

**Snovasys Fresher Hiring Challenge 2026**

BalanceVault is a full-stack digital wallet prototype demonstrating secure account management, role-based authorization, financial transactions, double-entry bookkeeping, idempotency, concurrency protection, and auditability.

🌐 **Live Application:** https://balance-vault-two.vercel.app/  
⚙️ **Backend API:** https://balancevault-api-74yg.onrender.com  
💻 **GitHub Repository:** https://github.com/yetisailaja/BalanceVault

**Project Status:** Deployed application with successful live Admin and Customer login verification. Selected financial-integrity and authorization scenarios have been tested locally. Remaining verification items are documented below.

---

## 1. Project Overview

BalanceVault demonstrates how a digital wallet can securely manage users, accounts, and simulated financial operations while maintaining transaction integrity and an auditable financial ledger.

The application supports three user roles:

- **ADMIN:** Reviews onboarding requests and performs authorized administrative operations.
- **ACCOUNT_HOLDER:** Accesses personal account information, transactions, transfers, and withdrawals.
- **AUDITOR:** Has read-only access to financial transactions, ledger records, and audit logs.

The main objective is to demonstrate secure financial transaction processing while preventing unauthorized access, duplicate requests, and inconsistent account balances.

BalanceVault is a hiring-challenge prototype and is not connected to real banking infrastructure.

## 2. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 19, Vite, JavaScript, CSS |
| Backend | Node.js, Express 5 |
| ORM | Prisma 6 |
| Database | PostgreSQL 18 |
| Authentication | JSON Web Tokens (JWT) |
| Password Security | bcryptjs |
| Request Validation | Zod |
| Security Middleware | Helmet, express-rate-limit |
| API Communication | REST API |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |

## 3. System Architecture

```text
                 React + Vite Frontend
                           |
                           | REST API / JWT
                           |
                           v
                  Node.js + Express
                           |
                 Authentication Middleware
                           |
                 Role-Based Authorization
                           |
              +------------+------------+
              |            |            |
            ADMIN    ACCOUNT_HOLDER   AUDITOR
              |            |            |
              +------------+------------+
                           |
                       Prisma ORM
                           |
                     PostgreSQL
                           |
             +-------------+-------------+
             |             |             |
           Users        Accounts     Transactions
                                         |
                                   Ledger Entries
                                         |
                                     Audit Logs
                                         |
                                   Idempotency Keys
```

The frontend communicates with the backend through REST APIs. Authentication and role-based authorization are enforced on the backend.

## 4. Features Implemented

### Authentication and Account Management

- User registration and login.
- JWT-based authentication.
- Password hashing using bcrypt.
- Three backend-enforced user roles.
- Administrator-controlled account onboarding.
- Account-holder account isolation.
- Account status and balance information.

### Financial Operations

- Simulated administrator deposits.
- Account-to-account money transfers.
- Withdrawal functionality with balance validation.
- Double-entry financial ledger.
- Account-wise transaction statements.
- Running balance calculations.

### Financial Integrity

- Idempotency keys to prevent duplicate financial requests.
- Request-hash validation.
- Serializable database transactions.
- Conditional balance updates.
- Concurrency protection and retry handling.
- Integer-based currency representation in paise.

### Auditability

- Financial transaction records.
- Debit and credit ledger entries.
- Audit logs for successful operations.
- Audit records for handled refused financial attempts.
- Read-only auditor APIs.

## 5. Role-Based Access Control

| Role | Permissions |
|---|---|
| ADMIN | Review onboarding requests and perform authorized simulated deposits |
| ACCOUNT_HOLDER | Access own account, statements, transfers, and withdrawals |
| AUDITOR | Inspect transactions, ledger entries, and audit logs |

Authorization is enforced through backend middleware. Frontend visibility alone is not considered a security boundary.

Account holders are restricted to their own account information. Auditors have read-only access to the auditor endpoints.

## 6. Project Structure

```text
BalanceVault/
|
+-- backend/
|   +-- prisma/
|   |   +-- migrations/
|   |   +-- schema.prisma
|   |
|   +-- src/
|   |   +-- config/
|   |   +-- controllers/
|   |   +-- middleware/
|   |   +-- routes/
|   |   +-- scripts/
|   |   +-- server.js
|   |
|   +-- .env.example
|   +-- package.json
|   +-- prisma.config.ts
|
+-- frontend/
|   +-- src/
|   +-- package.json
|   +-- index.html
|
+-- README.md
+-- PROMPTS.md
+-- THREATS.md
+-- render.yaml
```

Local `.env` files contain secrets and must never be committed to GitHub.

## 7. Local Installation and Setup

### Prerequisites

Install the following:

- Node.js and npm
- PostgreSQL
- Git
- Visual Studio Code (recommended)

### Step 1: Clone the Repository

```bash
git clone https://github.com/yetisailaja/BalanceVault.git

cd BalanceVault
```

### Step 2: Backend Setup

```bash
cd backend

npm install
```

Create a `.env` file using `.env.example` as a reference.

Configure the required environment variables:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/balancevault?schema=public"

JWT_SECRET="YOUR_LONG_RANDOM_SECRET"
JWT_EXPIRES_IN=1d

ADMIN_EMAIL=admin@balancevault.local
ADMIN_PASSWORD="YOUR_STRONG_ADMIN_PASSWORD"
```

Replace the database credentials and secrets with your own local values.

Generate Prisma Client and apply database migrations:

```bash
npm run db:generate

npm run db:migrate
```

Create the initial administrator:

```bash
npm run admin:create
```

Start the backend:

```bash
npm run dev
```

Backend local URL:

```text
http://localhost:5000
```

### Step 3: Frontend Setup

Open another terminal:

```bash
cd frontend

npm install
```

Create a frontend `.env` file:

```env
VITE_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

Frontend local URL:

```text
http://localhost:5173
```

## 8. Live Deployment

### Frontend – Vercel

https://balance-vault-two.vercel.app/

### Backend – Render

https://balancevault-api-74yg.onrender.com

### Backend Health Check

https://balancevault-api-74yg.onrender.com/api/health

The frontend communicates with the deployed backend through the `VITE_API_URL` environment variable.

The backend uses environment variables for database connectivity, authentication, and the allowed frontend origin.

**Deployment verification:**

- Live website accessible.
- Backend health endpoint available.
- Admin login successfully verified.
- Customer login successfully verified.
- Admin dashboard successfully opened.
- Customer dashboard successfully opened.

Note: Free hosting services may sleep after inactivity. The first backend request may take additional time while the service starts.

## 9. Demo Login Credentials

Evaluators can use the following dedicated demonstration accounts to access BalanceVault.

**Live Application:**

https://balance-vault-two.vercel.app/

### Administrator Demo Account

| Field | Details |
|---|---|
| Role | ADMIN |
| Email | adminbalancevalut@gmail.com |
| Password | AdminBalanace@9392 |
| Dashboard | Administrator Dashboard |

### Customer Demo Account

| Field | Details |
|---|---|
| Role | ACCOUNT_HOLDER |
| Email | yetisailaja@gmail.com |
| Password | Sailaja@9392 |
| Dashboard | Customer Dashboard |

### Login Instructions

1. Open the BalanceVault live application.
2. Navigate to the login page.
3. Enter the demo email address and password for the required role.
4. Click the Login button.
5. The application opens the dashboard corresponding to the authenticated user's role.

### Important Notes for Evaluators

- The Admin and Customer accounts have been successfully tested on the live application.
- Each account provides access according to its assigned role.
- The demo accounts are intended for evaluation and demonstration purposes.
- The application uses simulated wallet transactions and does not process real money.

**Security:** These credentials are for dedicated demo accounts only. Do not use personal passwords or production secrets. Rotate previously exposed passwords before publishing this README.

## 10. API Documentation

All protected endpoints require JWT authentication:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

Financial operations requiring idempotency also use:

```http
Idempotency-Key: YOUR_UNIQUE_REQUEST_KEY
```

### Authentication APIs

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/api/auth/register` | Register an account holder | Public |
| POST | `/api/auth/login` | Authenticate a user | Public |
| GET | `/api/auth/me` | Retrieve authenticated user information | Authenticated |

### Administrator APIs

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/api/admin/onboarding/pending` | View pending onboarding requests | ADMIN |
| PATCH | `/api/admin/onboarding/:userId/review` | Review an onboarding request | ADMIN |
| POST | `/api/admin/deposits` | Create a simulated deposit | ADMIN |

### Account Holder APIs

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/api/accounts/me` | Retrieve own account information | ACCOUNT_HOLDER |
| GET | `/api/accounts/transactions` | Retrieve own transaction statement | ACCOUNT_HOLDER |
| POST | `/api/transfers` | Transfer money to another account | ACCOUNT_HOLDER |
| POST | `/api/withdrawals` | Withdraw money from own account | ACCOUNT_HOLDER |

### Auditor APIs

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/api/auditor/transactions` | Inspect financial transactions | AUDITOR |
| GET | `/api/auditor/ledger` | Inspect ledger entries | AUDITOR |
| GET | `/api/auditor/logs` | Inspect audit records | AUDITOR |

### Common API Behavior

- Authentication failures return HTTP 401.
- Unauthorized role access returns HTTP 403.
- Invalid request data is rejected through validation.
- Conflicting idempotency requests return HTTP 409.
- Insufficient-balance requests are rejected without successful financial movement.
- Pagination is supported by statement and auditor listing endpoints.

## 11. Security and Financial Integrity

### Double-Entry Ledger

Every successful financial operation is designed to create corresponding debit and credit ledger entries.

The accounting invariant is:

```text
Total Debits = Total Credits
```

### Idempotency

Financial requests use an `Idempotency-Key` and request hash.

- Same key and same payload: return the original transaction.
- Same key and different payload: reject the request.
- Repeated requests must not duplicate financial movement.

### Concurrency Protection

Financial operations use database transactions, serializable isolation, conditional balance updates, and retry handling to protect account balances.

### Currency Precision

Amounts are represented in integer paise rather than floating-point currency calculations.

### Authentication and API Security

- Password hashing with bcrypt.
- JWT-based authentication.
- Backend-enforced role checks.
- Request validation using Zod.
- Helmet security middleware.
- Rate limiting using express-rate-limit.

For additional details, see [THREATS.md](THREATS.md).

## 12. Testing and Verification

The project documentation records the following local test scenarios:

- Administrator, account-holder, and auditor authentication.
- Account-holder access to auditor APIs rejected with HTTP 403.
- Auditor transfer and withdrawal attempts rejected with HTTP 403.
- Successful transfers and matching ledger entries.
- Insufficient-balance transfer rejection.
- Same-key idempotent transfer replay.
- Different-payload idempotency conflict.
- Concurrent transfer requests with no overspending.
- Database balance reconciliation for tested accounts.
- Account statement and running-balance verification.
- Insufficient-balance withdrawal rejection.
- Withdrawal refusal audit record verification.
- Auditor transaction, ledger, and audit-log API access.

### Live Application Verification

| Verification | Result |
|---|---|
| Live frontend access | Verified |
| Backend health endpoint | Verified |
| Admin login | Verified |
| Customer login | Verified |
| Admin dashboard | Verified |
| Customer dashboard | Verified |
| Successful withdrawal in production | Requires further verification |

**Testing limitation:** Local tests do not replace complete production testing or an independent security audit. Successful withdrawal execution still requires end-to-end verification.

## 13. Screenshots

Screenshots of the actual application can be added to a `screenshots/` directory.

Recommended structure:

```text
screenshots/
|
+-- login.png
+-- admin-dashboard.png
+-- customer-dashboard.png
+-- account-details.png
+-- transaction-history.png
+-- auditor-dashboard.png
```

Embed screenshots in this README after uploading them:

### Login Page

![BalanceVault Login](screenshots/login.png)

### Admin Dashboard

![Admin Dashboard](screenshots/admin-dashboard.png)

### Customer Dashboard

![Customer Dashboard](screenshots/customer-dashboard.png)

### Transaction History

![Transaction History](screenshots/transaction-history.png)

Only include screenshots that actually exist in the repository and correspond to implemented screens.

## 14. Known Limitations

- Deposits use an internal simulated funding account; no real bank or payment gateway is connected.
- Successful withdrawal execution still requires end-to-end verification.
- Failed login and denied authorization events are not confirmed as centralized audit events.
- Production deployment does not replace an independent security audit.
- Additional automated security and financial-integrity testing is required.
- Auditor demo access must be verified before providing evaluator credentials.

BalanceVault is a hiring-challenge prototype, not a real banking or payment service. Do not use real customer funds or real financial data.

## 15. Additional Documentation

- [THREATS.md](THREATS.md) – Threat model, security controls, test evidence, and remaining risks.
- [PROMPTS.md](PROMPTS.md) – AI development prompts, corrections, implementation references, and AI usage declaration.

## 16. Challenge Deliverables

| Deliverable | Status |
|---|---|
| Public GitHub repository | Available |
| Backend implementation | Implemented |
| Frontend implementation | Implemented |
| PostgreSQL integration | Implemented |
| Authentication and role-based access | Implemented |
| Financial transaction and ledger logic | Implemented; selected local scenarios tested |
| PROMPTS.md | Available |
| THREATS.md | Available |
| API documentation | Included |
| Live frontend deployment | Available |
| Live backend deployment | Available |
| Admin and Customer login | Verified |
| Successful production withdrawal | Further verification required |
| Screenshots | Add actual screenshots before claiming they are included |

---

## Author

Developed for the **Snovasys Fresher Hiring Challenge 2026**.