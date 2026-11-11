# BalanceVault – Threat Model

## 1. Assets to Protect

- Customer account balances
- User credentials and password hashes
- Authentication tokens
- Transaction and ledger records
- Customer and administrator permissions
- Audit trail records

## 2. Potential Threats and Mitigations

| Threat | Possible Impact | Mitigation Implemented |
|---|---|---|
| Unauthorized API access | Users access protected data or operations | JWT authentication middleware |
| Customer accessing admin APIs | Unauthorized deposits or customer approvals | Server-side ADMIN role authorization |
| Duplicate transfer request | Money transferred more than once | Idempotency key and request hash |
| Transfer exceeding available balance | Negative customer balance | Conditional database balance update |
| Concurrent transfer requests | Incorrect balances | Serializable database transactions and retry handling |
| Invalid request data | Unexpected or unsafe input | Zod request validation |
| Password exposure | Account compromise | Password hashing with bcrypt |
| Unauthorized customer transfers | Transfer to invalid or inactive accounts | Receiver account and user status validation |
| Missing transaction records | Difficulties investigating transactions | Database ledger entries and audit logs |

## 3. Security Tests Performed

| Test | Expected Result | Observed Result |
|---|---|---|
| Admin login | Successful authentication | Passed |
| Customer login | Successful authentication | Passed |
| Customer accessing admin API | HTTP 403 Forbidden | Passed |
| Deposit | Customer balance increases correctly | Passed |
| Repeated deposit with same idempotency key | No duplicate deposit | Passed |
| Successful transfer | Sender debited and receiver credited | Passed |
| Insufficient balance transfer | Transfer rejected | Passed |
| Repeated transfer with same idempotency key | No duplicate transfer | Passed |
| Ledger verification | Debit equals credit | Passed |
| Audit trail verification | Successful operations recorded | Passed |

## 4. Remaining Risks and Limitations

- Deposits are simulated through an internal system funding account. No real bank or payment gateway is connected.
- Failed login attempts and denied authorization attempts are not currently confirmed as audit-log events.
- Production deployment requires secure secret management, HTTPS, database access restrictions, and credential rotation.
- Automated test coverage and production-level security testing still need further work.

## 5. Security Goal

BalanceVault aims to ensure that only authorized users can perform permitted operations, transfers cannot exceed available balances, repeated requests do not duplicate transactions, and successful financial operations have balanced ledger entries and audit records.