# BalanceVault – Secure Digital Wallet



**Snovasys Fresher Hiring Challenge 2026**



BalanceVault is a secure digital wallet prototype demonstrating authenticated account management, role-based authorization, financial transactions, double-entry bookkeeping, idempotency, concurrency protection, and auditability.



**Project status:** Local development and testing. Production deployment and final demonstration are pending.



## 1. Key Features



- User registration and JWT-based authentication.

- Three backend-enforced roles: ADMIN, ACCOUNT_HOLDER, and AUDITOR.

- Administrator-controlled account onboarding and approval.

- Customer wallet account management and account isolation.

- Administrator-controlled simulated deposits.

- Account-to-account money transfers.

- Withdrawal functionality with balance validation.

- Double-entry financial ledger.

- Idempotency protection against duplicate financial requests.

- Serializable database transactions and conditional balance updates.

- Account-wise transaction statements with running balances.

- Audit logs for successful operations and handled refused financial attempts.

- Read-only auditor APIs for transactions, ledger entries, and audit logs.



## 2. Technology Stack



| Component | Technology |

|---|---|

| Frontend | React 19, Vite, JavaScript, CSS |

| Backend | Node.js, Express 5 |

| ORM | Prisma 6 |

| Database | PostgreSQL 18 |

| Authentication | JWT |

| Password security | bcryptjs |

| Validation | Zod |

| Security middleware | Helmet, express-rate-limit |

| API communication | HTTP/REST |



## 3. System Architecture



```text

React + Vite Frontend

&#x20;       |

&#x20;       | REST API / JWT

&#x20;       v

Node.js + Express Backend

&#x20;       |

&#x20;       +-- Authentication Middleware

&#x20;       |

&#x20;       +-- Role-Based Authorization

&#x20;       |

&#x20;       +-- Account Management

&#x20;       |

&#x20;       +-- Deposit / Transfer / Withdrawal

&#x20;       |

&#x20;       +-- Auditor APIs

&#x20;       |

&#x20;       v

Prisma ORM

&#x20;       |

&#x20;       v

PostgreSQL Database

&#x20;       |

&#x20;       +-- Users

&#x20;       +-- Accounts

&#x20;       +-- Transactions

&#x20;       +-- Ledger Entries

&#x20;       +-- Audit Logs

&#x20;       +-- Idempotency Keys

```



## 4. Role-Based Access Control



| Role | Permissions |

|---|---|

| ADMIN | Review onboarding requests and perform authorized simulated deposits |

| ACCOUNT_HOLDER | Access own account information, statements, transfers, and withdrawals |

| AUDITOR | Read transaction records, ledger entries, and audit logs |



Authorization is enforced by backend middleware. Hiding frontend controls is not treated as a security boundary.



Account holders are restricted to their own account data. Auditors have read-only access to the audit endpoints.



## 5. Project Structure



```text

BalanceVault/

|

+-- backend/

|   +-- prisma/

|   |   +-- migrations/

|   |   +-- schema.prisma

|   +-- src/

|   |   +-- config/

|   |   +-- controllers/

|   |   +-- middleware/

|   |   +-- routes/

|   |   +-- scripts/

|   |   +-- server.js

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



Local `.env` files contain secrets and must never be committed.



## 6. Prerequisites



Install:



- Node.js and npm

- PostgreSQL

- Git

- Visual Studio Code (recommended)



## 7. Local Installation and Setup



Clone the repository:



```bash

git clone https://github.com/yetisailaja/BalanceVault.git

cd BalanceVault

```



### Backend



```bash

cd backend

npm install

```



Create a local `.env` file using `.env.example` as a reference.



Configure the required environment variables:



```env

PORT=5000

FRONTEND_URL=http://localhost:5173

DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/balancevault"

JWT_SECRET=YOUR_LONG_RANDOM_SECRET

JWT_EXPIRES_IN=1d

ADMIN_EMAIL=admin@balancevault.local

ADMIN_PASSWORD=CHANGE_THIS_PASSWORD

```



Use your own database credentials and a strong random JWT secret. Never commit actual credentials.



Generate Prisma Client and apply database migrations:



```bash

npm run db:generate

npm run db:migrate

```



Create the initial administrator using the project's administrator setup script:



```bash

npm run admin:create

```



Start the backend using the available development script:



```bash

npm run dev

```



Backend local URL:



```text

http://localhost:5000

```



### Frontend



Open another terminal:



```bash

cd frontend

npm install

```



Create a frontend `.env` file and configure:



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



## 8. API Documentation



All protected endpoints require:



```http

Authorization: Bearer YOUR_JWT_TOKEN

```



Financial operations requiring idempotency also require:



```http

Idempotency-Key: YOUR_UNIQUE_REQUEST_KEY

```



### Authentication



| Method | Endpoint | Purpose | Access |

|---|---|---|---|

| POST | `/api/auth/register` | Register an account holder | Public |

| POST | `/api/auth/login` | Authenticate a user | Public |

| GET | `/api/auth/me` | Retrieve authenticated user information | Authenticated |



### Administrator



| Method | Endpoint | Purpose | Access |

|---|---|---|---|

| GET | `/api/admin/onboarding/pending` | View pending onboarding requests | ADMIN |

| PATCH | `/api/admin/onboarding/:userId/review` | Review an onboarding request | ADMIN |

| POST | `/api/admin/deposits` | Create a simulated deposit | ADMIN |



### Account Holder



| Method | Endpoint | Purpose | Access |

|---|---|---|---|

| GET | `/api/accounts/me` | Retrieve own account information | ACCOUNT_HOLDER |

| GET | `/api/accounts/transactions` | Retrieve own transaction statement | ACCOUNT_HOLDER |

| POST | `/api/transfers` | Transfer money to another account | ACCOUNT_HOLDER |

| POST | `/api/withdrawals` | Withdraw money from own account | ACCOUNT_HOLDER |



### Auditor



| Method | Endpoint | Purpose | Access |

|---|---|---|---|

| GET | `/api/auditor/transactions` | Inspect financial transactions | AUDITOR |

| GET | `/api/auditor/ledger` | Inspect ledger entries | AUDITOR |

| GET | `/api/auditor/logs` | Inspect audit records | AUDITOR |



### Common API behavior



- Authentication failures return HTTP 401.

- Unauthorized role access returns HTTP 403.

- Invalid request data is rejected through validation.

- Conflicting idempotency requests return HTTP 409.

- Insufficient balance requests are rejected without successful financial movement.

- Pagination is supported by statement and auditor listing endpoints.



## 9. Financial Integrity and Transaction Safety



### Double-entry ledger



Every successful deposit, transfer, and withdrawal is designed to produce corresponding debit and credit ledger entries.



The accounting invariant is:



```text

Total Debits = Total Credits

```



### Idempotency



Financial requests use an `Idempotency-Key` and request hash.



- Same key and same payload: return the original transaction.

- Same key and different payload: reject the request.

- Repeated requests must not duplicate financial movement.



### Concurrency protection



Financial operations use database transactions, serializable isolation, conditional balance updates, and retry handling to protect against concurrent balance changes.



### Currency precision



Amounts are represented in integer paise using database integer-based values rather than floating-point currency calculations.



### Account statements



The account statement API provides:



- Transaction details.

- Debit and credit direction.

- Transaction initiator.

- Transaction timestamps.

- Running balance.

- Handled refused transfer and withdrawal attempts.

- Pagination.



## 10. Testing and Verification



The following local scenarios have been executed:



- Administrator, account-holder, and auditor authentication.

- Account-holder access to auditor endpoints rejected with HTTP 403.

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



**Testing limitation:** A successful withdrawal has not yet been independently verified end to end. Local tests do not replace a full production security audit.



## 11. Security Documentation



See:



- [THREATS.md](THREATS.md) – Threats, impacts, mitigations, test evidence, and remaining risks.

- [PROMPTS.md](PROMPTS.md) – Dated AI development prompts, corrections, implementation references, and AI usage declaration.



## 12. Deployment



The repository includes a starter Render Blueprint in `render.yaml`.



### Backend – Render



Configure:



- Root directory: `backend`

- Build command: `npm ci \&\& npx prisma generate \&\& npx prisma migrate deploy`

- Start command: `npm start`

- Managed PostgreSQL database.

- Environment variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `NODE_ENV=production`.



Create the initial administrator using the project's setup script through an appropriate one-off command or service shell.



### Frontend – Vercel



Configure:



- Root directory: `frontend`

- Build command: `npm run build`

- Output directory: `dist`

- Environment variable: `VITE_API_URL` pointing to the deployed backend URL without a trailing slash.



Set the backend's `FRONTEND_URL` to the deployed frontend origin.



After deployment, verify health checks, authentication, authorization, onboarding, deposits, transfers, withdrawals, statements, and auditor APIs before treating the deployment as complete.



**Deployment status:** Instructions are provided; a live deployment has not yet been verified.



## 13. Known Limitations



- Deposits use an internal simulated system funding account; no real bank or payment gateway is connected.

- Successful withdrawal execution still requires end-to-end verification.

- Failed login and denied authorization events are not confirmed as centralized audit events.

- Production deployment and infrastructure hardening remain pending.

- Further automated security and financial-integrity testing is required.



BalanceVault is a hiring-challenge prototype, not a real banking or payment service. Do not use real customer funds or production financial data.



## 14. Challenge Deliverables



| Deliverable | Status |

|---|---|

| Public GitHub repository | Available |

| Backend implementation | Locally implemented and tested |

| Frontend implementation | Build and lint previously passed |

| PROMPTS.md | Updated |

| THREATS.md | Updated |

| API documentation | Included in this README |

| Demo accounts | Must be prepared and documented securely |

| Live deployed application | Pending |

| Five-minute demo video | Pending |



## Author



Developed for the Snovasys Fresher Hiring Challenge 2026.
