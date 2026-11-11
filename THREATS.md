# BalanceVault – Threat Model and Security Analysis



## 1. Assets to Protect



- Account balances and account ownership information.

- User credentials and password hashes.

- JWT authentication tokens.

- Financial transactions and double-entry ledger records.

- User roles and authorization permissions.

- Idempotency keys and request hashes.

- Audit logs and refused transaction records.

- Account statements and transaction history.



## 2. Potential Threats, Impact, and Mitigations



| Threat | Possible Impact | Mitigation Implemented |

|---|---|---|

| Unauthorized API access | Unauthorized users access protected resources | JWT authentication middleware validates tokens and retrieves current user information from the database. |

| Privilege escalation | Account holders or auditors perform administrator operations | Server-side role-based authorization restricts administrative routes to ADMIN users. |

| Unauthorized auditor access | Users access financial audit information without permission | AUDITOR role is enforced on auditor routes. |

| Unauthorized financial operations | Auditors or users without account-holder permissions perform transfers or withdrawals | ACCOUNT_HOLDER authorization is enforced on financial operation routes. |

| Account data exposure | One account holder accesses another user's financial information | Account queries are scoped to the authenticated user's account IDs. |

| Duplicate financial requests | Repeated requests cause duplicate money movement | Idempotency keys and request hashes ensure identical requests return the original result and conflicting payloads are rejected. |

| Insufficient balance | Account balance becomes negative | Conditional database balance updates verify available funds before debiting. |

| Concurrent transfers | Simultaneous requests cause inconsistent balances or overspending | Serializable database transactions and retry handling protect financial operations. |

| Invalid input | Malformed or unexpected data affects financial operations | Zod validation checks request fields and amounts. |

| Password exposure | Compromised credentials allow account access | Passwords are hashed using bcrypt. |

| Invalid or inactive receiver | Funds are transferred to an unavailable account | Receiver account status, user status, ownership, and onboarding approval are checked. |

| Missing financial evidence | Transactions become difficult to investigate | Successful financial operations create transaction records, ledger entries, and audit events. |

| Unrecorded refused operations | Failed financial attempts are difficult to investigate | Transfer and withdrawal refusal audit records are written for handled business-rule failures. |

| Unauthorized modification of audit information | Audit evidence loses reliability | Auditor endpoints provide read-only transaction, ledger, and audit-log access. |



## 3. Security and Functional Tests Performed



| Test | Expected Result | Observed Result |

|---|---|---|

| Administrator login | Valid administrator can authenticate | Passed |

| Account-holder login | Valid account holder can authenticate | Passed |

| Auditor login | Valid auditor can authenticate | Passed |

| Account holder accessing auditor APIs | HTTP 403 Forbidden | Passed |

| Auditor attempting a withdrawal | HTTP 403 Forbidden | Passed |

| Auditor attempting a transfer | HTTP 403 Forbidden | Passed |

| Account-holder transfer with insufficient funds | Request rejected without financial movement | Passed |

| Repeated transfer with the same idempotency key and payload | Original transaction returned without duplicate movement | Passed |

| Same idempotency key with a different payload | HTTP 409 Conflict | Passed |

| Concurrent ₹500 transfer requests | No overspending; only a valid transfer succeeds | Passed |

| Successful transfer ledger verification | Matching debit and credit entries | Passed |

| Account balance reconciliation | Stored balances match ledger-derived balances in the checked test data | Passed |

| Insufficient-balance withdrawal | Request rejected without balance change or ledger entries | Passed |

| Withdrawal refusal audit | Refused attempt recorded in audit logs | Passed |

| Account statement verification | Tested account statements show expected transaction amounts and running balances | Passed |

| Auditor transaction, ledger, and audit-log APIs | Authorized auditor receives read-only data | Passed |



**Testing scope:** These results represent the local test scenarios actually executed. They do not constitute a complete independent security audit or exhaustive production testing.



## 4. Threat Impact and Residual Risks



| Remaining Risk | Potential Impact | Recommended Future Mitigation |

|---|---|---|

| Simulated deposits | The system does not perform real bank settlements | Integrate a trusted payment gateway with verified payment callbacks. |

| Failed login and denied authorization auditing | Some security events may not be recorded in the audit trail | Add centralized security-event logging and alerting. |

| Successful withdrawal not independently verified | Withdrawal execution has not yet been confirmed through a successful end-to-end test | Test a successful withdrawal and verify account balances, transaction status, ledger entries, and audit records. |

| Production deployment not completed | Live infrastructure security has not yet been verified | Deploy using HTTPS, secure environment variables, restricted database access, and production monitoring. |

| Limited automated security coverage | Undetected defects may remain | Expand automated authorization, concurrency, idempotency, and financial-integrity tests. |

| Operational credential exposure | Leaked credentials could compromise accounts | Rotate development credentials before production and use secure secret management. |



## 5. Security Design Principles



BalanceVault follows these principles:



1\. **Least privilege:** Each role receives only the permissions required for its responsibilities.

2\. **Backend authorization:** Access restrictions are enforced by the backend rather than relying on frontend visibility.

3\. **Account isolation:** Account holders can access only their own account information.

4\. **Financial integrity:** Successful money movements create matching debit and credit ledger entries.

5\. **Idempotency:** Repeated financial requests do not create duplicate transactions.

6\. **Concurrency safety:** Database transactions and conditional balance updates protect account balances.

7\. **Auditability:** Successful and handled refused financial operations produce audit records.

8\. **Read-only auditing:** Auditors can inspect financial records without performing money movements.



## 6. Security Goal



BalanceVault aims to ensure that only authorized users can perform permitted operations, account holders cannot access other users' financial information, balances cannot be overdrawn through concurrent transfers, repeated requests cannot duplicate financial movements, and successful financial transactions maintain balanced ledger entries with an auditable history.
