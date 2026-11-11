# BalanceVault – AI Usage Documentation

## Entry 1 – Backend Setup

**Date:** 2026-11-10

**Prompt:** Help me set up an Express backend with PostgreSQL and Prisma for a banking application.

**AI output:** Suggested the backend structure, Express server setup, Prisma configuration, and database connection.

**What was wrong:** The initial setup needed adjustments to match the installed Prisma version and project structure.

**What I did instead:** I configured the Prisma schema, database connection, migrations, and generated Prisma client, then verified the database connection.

Commit link: https://github.com/yetisailaja/BalanceVault/commit/5dbe067

## Entry 2 – Authentication and Password Security

**Date:** 2026-11-10

**Prompt:** Help implement secure customer registration and login using bcrypt and JWT in Express.

**AI output:** Suggested password hashing, login validation, JWT generation, and authentication middleware.

**What was wrong:** The code needed to match my existing routes, database models, and role structure.

**What I did instead:** I adapted the implementation to my project and tested admin and customer login.

**Commit link:** To be added after Git commit.

## Entry 3 – Authorization and Role-Based Access Control

**Date:** 2026-11-11

**Prompt:** Help protect administrator endpoints so customers cannot access administrative operations.

**AI output:** Suggested JWT authentication middleware and role-based authorization middleware.

**What was wrong:** Authentication alone does not establish whether a user has permission to access an admin endpoint.

**What I did instead:** I applied server-side ADMIN role authorization to admin routes and tested access using a customer token. The server rejected the request with a permission error.

**Commit link:** To be added after Git commit.

## Entry 4 – Idempotency and Transaction Safety

**Date:** 2026-11-11

**Prompt:** Help implement money transfers with idempotency, balance checks, and database transaction safety.

**AI output:** Suggested request hashing, idempotency keys, serializable transactions, and conditional balance updates.

**What was wrong:** A repeated request must not create another transfer, and concurrent requests must not allow an invalid balance.

**What I did instead:** I implemented the transfer flow and tested successful transfer, insufficient balance, and repeated requests using the same idempotency key.

**Commit link:** To be added after Git commit.

## Entry 5 – Audit Trail and Ledger Verification

**Date:** 2026-11-11

**Prompt:** Help record financial operations in an audit trail and verify that each transaction has balanced debit and credit entries.

**AI output:** Suggested audit log records and a script to inspect ledger entries.

**What was wrong:** I needed to verify actual database records instead of assuming that the implementation was correct.

**What I did instead:** I queried the audit logs and wrote a ledger verification script. I confirmed that the tested deposit and transfer each had two entries with equal debit and credit amounts.

**Commit link:** To be added after Git commit.

## AI Usage Declaration

AI tools were used as development assistance for understanding concepts, debugging, and reviewing implementation ideas. I reviewed, adapted, executed, and tested the code in my own project environment. I am responsible for the final implementation and its limitations.