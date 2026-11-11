# BalanceVault – AI Usage Documentation



## Entry 1 – Backend Setup



**Date:** 2026-11-10



**Prompt:** Help me set up an Express backend with PostgreSQL and Prisma for a banking application.



**AI output:** Suggested the backend structure, Express server setup, Prisma configuration, and database connection.



**What was wrong:** The initial setup needed adjustments to match the installed Prisma version and project structure.



**What I did instead:** I configured the Prisma schema, database connection, migrations, and generated Prisma client, then verified the database connection.



**Commit link:** https://github.com/yetisailaja/BalanceVault/commit/5d440cb



## Entry 2 – Authentication and Password Security



**Date:** 2026-11-10



**Prompt:** Help implement secure customer registration and login using bcrypt and JWT in Express.



**AI output:** Suggested password hashing, login validation, JWT generation, and authentication middleware.



**What was wrong:** The code needed to match my existing routes, database models, and role structure.



**What I did instead:** I adapted the implementation to my project and tested administrator and account-holder login.



**Commit link:** https://github.com/yetisailaja/BalanceVault/commit/5d440cb



## Entry 3 – Authorization and Role-Based Access Control



**Date:** 2026-11-11



**Prompt:** Help protect administrator endpoints so unauthorized users cannot access administrative operations.



**AI output:** Suggested JWT authentication middleware and server-side role-based authorization.



**What was wrong:** Authentication alone does not establish whether a user has permission to access an administrative endpoint.



**What I did instead:** I applied server-side ADMIN role authorization to administrative routes and tested access using an account-holder token. The server rejected the unauthorized request.



**Commit link:** https://github.com/yetisailaja/BalanceVault/commit/5d440cb



## Entry 4 – Idempotency and Transaction Safety



**Date:** 2026-11-11



**Prompt:** Help implement money transfers with idempotency, balance checks, and database transaction safety.



**AI output:** Suggested request hashing, idempotency keys, serializable transactions, and conditional balance updates.



**What was wrong:** A repeated request must not create another transfer, and concurrent requests must not allow an invalid balance.



**What I did instead:** I implemented the transfer flow and tested successful transfers, insufficient balance handling, repeated requests using the same idempotency key, and concurrent transfer requests. The repeated request returned the original transaction, while a conflicting payload was rejected.



**Commit link:** https://github.com/yetisailaja/BalanceVault/commit/282c048



## Entry 5 – Audit Trail and Ledger Verification



**Date:** 2026-11-11



**Prompt:** Help record financial operations in an audit trail and verify that each transaction has balanced debit and credit entries.



**AI output:** Suggested audit log records and ledger verification techniques.



**What was wrong:** I needed to verify actual database records instead of assuming that the implementation was correct.



**What I did instead:** I queried audit logs and ledger entries and verified tested deposits and transfers for matching debit and credit amounts.



**Commit link:** https://github.com/yetisailaja/BalanceVault/commit/282c048



## Entry 6 – Account Holder and Auditor Authorization



**Date:** 2026-11-12



**Prompt:** Help implement separate ACCOUNT_HOLDER and AUDITOR roles with backend-enforced permissions and read-only audit APIs.



**AI output:** Suggested database role migration, authorization middleware, auditor endpoints, and role-isolation checks.



**What was wrong:** Users with different roles must not gain access to operations outside their permissions, even when they have valid authentication tokens.



**What I did instead:** I implemented the account-holder and auditor roles, created auditor transaction, ledger, and audit-log endpoints, and tested that an account holder could not access auditor endpoints and an auditor could not perform transfers or withdrawals. These unauthorized requests returned HTTP 403.



**Commit link:** https://github.com/yetisailaja/BalanceVault/commit/282c048



## Entry 7 – Withdrawal and Refused Transaction Auditing



**Date:** 2026-11-12



**Prompt:** Help implement secure withdrawals with idempotency, balance validation, transaction safety, and audit logging.



**AI output:** Suggested conditional balance updates, serializable transactions, idempotency handling, and refusal audit records.



**What was wrong:** A withdrawal must not create a financial transaction or ledger movement when the account does not have sufficient funds.



**What I did instead:** I implemented the withdrawal controller and route, including balance validation, idempotency handling, and audit logging. I tested an insufficient-balance withdrawal and verified that it was rejected without changing the account balance or creating ledger entries, while a refusal audit record was created.



**Commit link:** https://github.com/yetisailaja/BalanceVault/commit/282c048



## Entry 8 – Account Statements and Concurrency Verification



**Date:** 2026-11-12



**Prompt:** Help provide account-wise transaction statements with running balances and verify that concurrent transfers cannot overspend an account.



**AI output:** Suggested ledger-based statement retrieval, running-balance calculations, pagination, and serializable transaction handling.



**What was wrong:** Account holders need transaction history with accurate running balances, and simultaneous requests must not bypass balance checks.



**What I did instead:** I implemented account-wise transaction history with running balances and refused-attempt records. I tested concurrent ₹500 transfers from an account with insufficient combined funds for both requests. One transfer succeeded and the other was rejected. I verified the successful transaction's two balanced ledger entries and restored the test balances afterward.



**Commit link:** https://github.com/yetisailaja/BalanceVault/commit/282c048



## AI Usage Declaration



AI tools were used as development assistance for understanding concepts, debugging, and reviewing implementation ideas. I reviewed, adapted, executed, and tested the code in my own project environment. I am responsible for the final implementation and its limitations.



**Testing and deployment note:** The implementation and selected financial and authorization scenarios have been tested locally. Successful withdrawal execution, production deployment, and the final demonstration video remain pending verification.
