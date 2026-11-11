import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const money = (v) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(Number(v || 0));

const makeKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

const getList = (data, fields) =>
  fields.map((f) => data?.[f]).find(Array.isArray) || [];

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('bv-session') || 'null');
    } catch {
      return null;
    }
  });

  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
  });

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pending, setPending] = useState([]);

  const [auditTransactions, setAuditTransactions] = useState([]);
  const [auditLedger, setAuditLedger] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTab, setAuditTab] = useState('transactions');

  const [transfer, setTransfer] = useState({
    toAccountNumber: '',
    amount: '',
    description: '',
  });

  const [withdrawal, setWithdrawal] = useState({
    amount: '',
    description: '',
  });

  const [deposit, setDeposit] = useState({
    accountNumber: '',
    amount: '',
    description: '',
  });

  const token = session?.token;
  const user = session?.user;
  const role = user?.role;

  const isAdmin = role === 'ADMIN';
  const isAuditor = role === 'AUDITOR';
  const isHolder = role === 'ACCOUNT_HOLDER';

  const call = useCallback(
    (path, options = {}) => request(path, { ...options, token }),
    [token]
  );

  // ACCOUNT HOLDER DATA
  const loadCustomer = useCallback(async () => {
    const data = await call('/api/accounts/me');

    setAccount(data.accounts?.[0] || null);

    const history = await call('/api/accounts/transactions');

    setTransactions(history.transactions || []);
  }, [call]);

  // ADMIN DATA
  const loadAdmin = useCallback(async () => {
    const data = await call('/api/admin/onboarding/pending');

    setPending(data.requests || []);
  }, [call]);

  // AUDITOR DATA
  const loadAuditor = useCallback(async () => {
    const [t, l, a] = await Promise.all([
      call('/api/auditor/transactions'),
      call('/api/auditor/ledger'),
      call('/api/auditor/logs'),
    ]);

    setAuditTransactions(
      getList(t, ['transactions', 'items', 'results'])
    );

    setAuditLedger(
      getList(l, ['entries', 'ledgerEntries', 'items', 'results'])
    );

    setAuditLogs(
      getList(a, ['logs', 'auditLogs', 'items', 'results'])
    );
  }, [call]);

  const refresh = useCallback(async () => {
    if (isAdmin) return loadAdmin();
    if (isAuditor) return loadAuditor();
    if (isHolder) return loadCustomer();
  }, [
    isAdmin,
    isAuditor,
    isHolder,
    loadAdmin,
    loadAuditor,
    loadCustomer,
  ]);

  useEffect(() => {
    if (!token) return;

    let active = true;

    refresh().catch((e) => {
      if (active) {
        setNotice({ type: 'error', text: e.message });
      }
    });

    return () => {
      active = false;
    };
  }, [token, refresh]);

  // LOGOUT
  const logout = () => {
    sessionStorage.removeItem('bv-session');

    setSession(null);
    setAccount(null);
    setTransactions([]);
    setPending([]);

    setAuditTransactions([]);
    setAuditLedger([]);
    setAuditLogs([]);

    setNotice({ type: '', text: '' });
  };

  // LOGIN AND REGISTRATION
  async function authenticate(e) {
    e.preventDefault();

    setBusy(true);
    setNotice({ type: '', text: '' });

    try {
      if (mode === 'register') {
        await request('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(form),
        });

        setMode('login');

        setForm({
          fullName: '',
          email: form.email,
          password: '',
        });

        setNotice({
          type: 'success',
          text: 'Registration submitted. Your account is awaiting administrator approval.',
        });
      } else {
        const data = await request('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: form.email,
            password: form.password,
          }),
        });

        const next = {
          token: data.token,
          user: data.user,
        };

        sessionStorage.setItem('bv-session', JSON.stringify(next));

        setSession(next);

        setNotice({
          type: 'success',
          text: `Welcome, ${data.user.fullName || data.user.email}.`,
        });
      }
    } catch (e2) {
      setNotice({
        type: 'error',
        text: e2.message,
      });
    } finally {
      setBusy(false);
    }
  }

  // MONEY TRANSFER
  async function sendTransfer(e) {
    e.preventDefault();

    setBusy(true);
    setNotice({ type: '', text: '' });

    try {
      const amountPaise = Math.round(Number(transfer.amount) * 100);

      if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
        throw new Error('Enter a valid transfer amount.');
      }

      const result = await call('/api/transfers', {
        method: 'POST',
        headers: {
          'Idempotency-Key': makeKey(),
        },
        body: JSON.stringify({
          toAccountNumber: transfer.toAccountNumber.trim(),
          amountPaise,
          description: transfer.description,
        }),
      });

      setTransfer({
        toAccountNumber: '',
        amount: '',
        description: '',
      });

      setNotice({
        type: 'success',
        text: result.message || 'Transfer completed.',
      });

      await loadCustomer();
    } catch (e2) {
      setNotice({
        type: 'error',
        text: e2.message,
      });

      await loadCustomer().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  // WITHDRAWAL
  async function makeWithdrawal(e) {
    e.preventDefault();

    setBusy(true);
    setNotice({ type: '', text: '' });

    try {
      const amountPaise = Math.round(Number(withdrawal.amount) * 100);

      if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
        throw new Error('Enter a valid withdrawal amount.');
      }

      if (
        account &&
        Number(withdrawal.amount) > Number(account.balanceRupees)
      ) {
        throw new Error('Withdrawal amount exceeds your available balance.');
      }

      const result = await call('/api/withdrawals', {
        method: 'POST',
        headers: {
          'Idempotency-Key': makeKey(),
        },
        body: JSON.stringify({
          amountPaise,
          description: withdrawal.description,
        }),
      });

      setWithdrawal({
        amount: '',
        description: '',
      });

      setNotice({
        type: 'success',
        text: result.message || 'Withdrawal completed successfully.',
      });

      await loadCustomer();
    } catch (e2) {
      setNotice({
        type: 'error',
        text: e2.message,
      });

      await loadCustomer().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  // ADMIN: APPROVE OR REJECT CUSTOMER
  async function review(userId, status) {
    setBusy(true);

    try {
      const result = await call(
        `/api/admin/onboarding/${userId}/review`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      );

      setNotice({
        type: 'success',
        text: result.message || `Application ${status.toLowerCase()}.`,
      });

      await loadAdmin();
    } catch (e) {
      setNotice({
        type: 'error',
        text: e.message,
      });
    } finally {
      setBusy(false);
    }
  }

  // ADMIN: SIMULATED DEPOSIT
  async function makeDeposit(e) {
    e.preventDefault();

    setBusy(true);
    setNotice({ type: '', text: '' });

    try {
      const amountPaise = Math.round(Number(deposit.amount) * 100);

      if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
        throw new Error('Enter a valid deposit amount.');
      }

      const result = await call('/api/admin/deposits', {
        method: 'POST',
        headers: {
          'Idempotency-Key': makeKey(),
        },
        body: JSON.stringify({
          accountNumber: deposit.accountNumber.trim(),
          amountPaise,
          description: deposit.description,
        }),
      });

      setDeposit({
        accountNumber: '',
        amount: '',
        description: '',
      });

      setNotice({
        type: 'success',
        text: result.message || 'Simulated deposit completed.',
      });
    } catch (e2) {
      setNotice({
        type: 'error',
        text: e2.message,
      });
    } finally {
      setBusy(false);
    }
  }

  const initials = useMemo(
    () => (user?.fullName || user?.email || 'B').slice(0, 1).toUpperCase(),
    [user]
  );

  // LOGIN SCREEN
  if (!session) {
    return (
      <main className="auth-shell">
        <aside className="brand-panel">
          <div className="brand brand-light">
            <span className="brand-mark">B</span>
            <span>BalanceVault</span>
          </div>

          <div className="brand-copy">
            <p className="eyebrow">MONEY, ACCOUNTED FOR.</p>

            <h1>
              Confidence in every <em>transaction.</em>
            </h1>

            <p>
              A clearer view of your accounts, built on a ledger where every
              entry has its place.
            </p>

            <div className="feature-pills">
              <span>Double-entry ledger</span>
              <span>Idempotent transfers</span>
              <span>Role-based security</span>
            </div>
          </div>

          <div className="vault-art">
            <div className="vault-top">BV / PRIVATE LEDGER</div>

            <div className="vault-bars">
              <i />
              <i />
              <i />
            </div>

            <div className="vault-bottom">✓ SECURE BY DESIGN</div>
          </div>

          <p className="brand-foot">Every entry accountable.</p>
        </aside>

        <section className="auth-main">
          <div className="auth-card">
            <p className="eyebrow">
              {mode === 'register' ? 'GET STARTED' : 'WELCOME BACK'}
            </p>

            <h2>
              {mode === 'register'
                ? 'Create your vault'
                : 'Sign in to your vault'}
            </h2>

            <p className="muted">
              {mode === 'register'
                ? 'Register to request an account.'
                : 'Your accounts, clearly in view.'}
            </p>

            {notice.text && (
              <div className={`notice ${notice.type}`}>
                {notice.text}
              </div>
            )}

            <form onSubmit={authenticate} className="stack-form">
              {mode === 'register' && (
                <label className="field">
                  Full name

                  <input
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                    minLength="2"
                    required
                    placeholder="Enter your full name"
                  />
                </label>
              )}

              <label className="field">
                Email address

                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  required
                  placeholder="you@example.com"
                />
              </label>

              <label className="field">
                Password

                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  minLength={mode === 'register' ? 8 : 1}
                  required
                  placeholder="Enter your password"
                />
              </label>

              <button className="primary-btn" disabled={busy}>
                {busy
                  ? 'Please wait…'
                  : mode === 'register'
                    ? 'Submit registration →'
                    : 'Sign in →'}
              </button>
            </form>

            <p className="switch-line">
              {mode === 'register'
                ? 'Already have an account?'
                : 'New to BalanceVault?'}

              <button
                className="text-btn"
                onClick={() => {
                  setMode(mode === 'register' ? 'login' : 'register');
                  setNotice({ type: '', text: '' });
                }}
              >
                {mode === 'register' ? 'Sign in' : 'Create an account'}
              </button>
            </p>

            <div className="security-note">
              Your credentials are securely processed by the BalanceVault
              backend.
            </div>
          </div>
        </section>
      </main>
    );
  }

  // MAIN APPLICATION
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">B</span>
          <span>BalanceVault</span>
        </div>

        <div className="top-user">
          <span className="avatar">{initials}</span>

          <span className="user-meta">
            <b>{user?.fullName || user?.email}</b>
            <small>{role?.replace('_', ' ')}</small>
          </span>

          <button className="outline-btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="dashboard">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              {isAdmin
                ? 'CONTROL CENTRE'
                : isAuditor
                  ? 'FINANCIAL OVERSIGHT'
                  : 'YOUR FINANCIAL OVERVIEW'}
            </p>

            <h1>
              {isAdmin
                ? 'Administrator dashboard'
                : isAuditor
                  ? 'Auditor workspace'
                  : 'Your dashboard'}
            </h1>

            <p className="muted">
              {isAdmin
                ? 'Review onboarding and manage simulated account funding.'
                : isAuditor
                  ? 'Inspect transactions, ledger entries, and audit events.'
                  : 'Welcome back. Here is your account at a glance.'}
            </p>
          </div>

          <span className="live-tag">
            <i /> Secure session
          </span>
        </div>

        {notice.text && (
          <div className={`notice ${notice.type}`}>
            <span>{notice.text}</span>

            <button
              className="notice-close"
              onClick={() => setNotice({ type: '', text: '' })}
            >
              ×
            </button>
          </div>
        )}

        {/* ADMIN DASHBOARD */}
        {isAdmin && (
          <div className="admin-grid">
            <section className="panel wide">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">CUSTOMER ONBOARDING</p>
                  <h2>Pending applications</h2>
                </div>

                <span className="count-badge">
                  {pending.length} pending
                </span>
              </div>

              {pending.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Email</th>
                        <th>Applied</th>
                        <th>Decision</th>
                      </tr>
                    </thead>

                    <tbody>
                      {pending.map((item) => (
                        <tr key={item.id}>
                          <td>{item.user?.fullName || '—'}</td>
                          <td>{item.user?.email || '—'}</td>

                          <td>
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleDateString(
                                  'en-IN'
                                )
                              : '—'}
                          </td>

                          <td className="actions">
                            <button
                              className="approve-btn"
                              disabled={busy}
                              onClick={() =>
                                review(item.user.id, 'APPROVED')
                              }
                            >
                              Approve
                            </button>

                            <button
                              className="reject-btn"
                              disabled={busy}
                              onClick={() =>
                                review(item.user.id, 'REJECTED')
                              }
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  No pending customer applications.
                </div>
              )}
            </section>

            <section className="panel">
              <p className="eyebrow">ACCOUNT FUNDING</p>
              <h2>Simulated deposit</h2>

              <p className="muted small-copy">
                Admin-only funding for an approved customer account.
              </p>

              <form
                className="stack-form compact"
                onSubmit={makeDeposit}
              >
                <label className="field">
                  Customer account number

                  <input
                    value={deposit.accountNumber}
                    onChange={(e) =>
                      setDeposit({
                        ...deposit,
                        accountNumber: e.target.value,
                      })
                    }
                    required
                    placeholder="BVxxxxxxxxxx"
                  />
                </label>

                <label className="field">
                  Amount (₹)

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={deposit.amount}
                    onChange={(e) =>
                      setDeposit({
                        ...deposit,
                        amount: e.target.value,
                      })
                    }
                    required
                    placeholder="1000.00"
                  />
                </label>

                <label className="field">
                  Description (optional)

                  <input
                    value={deposit.description}
                    onChange={(e) =>
                      setDeposit({
                        ...deposit,
                        description: e.target.value,
                      })
                    }
                    placeholder="Initial funding"
                  />
                </label>

                <button className="primary-btn" disabled={busy}>
                  {busy ? 'Processing…' : 'Create deposit'}
                </button>
              </form>

              <p className="helper">
                Simulated funding only. No real bank or payment network is
                connected.
              </p>
            </section>
          </div>
        )}

        {/* ACCOUNT HOLDER DASHBOARD */}
        {isHolder && (
          <>
            <section className="summary-grid">
              <div className="balance-card">
                <div className="balance-top">
                  <span>AVAILABLE BALANCE</span>
                  <span className="balance-icon">₹</span>
                </div>

                <strong>
                  {account ? money(account.balanceRupees) : '—'}
                </strong>

                <div className="balance-foot">
                  <span>
                    INR · {account?.status || 'Account status unavailable'}
                  </span>

                  <button
                    onClick={() =>
                      loadCustomer().catch((e) =>
                        setNotice({ type: 'error', text: e.message })
                      )
                    }
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>

              <div className="stat-card">
                <span>ACCOUNT NUMBER</span>
                <strong className="account-number">
                  {account?.accountNumber || 'Not available'}
                </strong>
                <small>Use this to receive transfers</small>
              </div>

              <div className="stat-card">
                <span>ACCOUNT STATUS</span>
                <strong>
                  <i className="status-dot" /> {account?.status || 'Pending'}
                </strong>
                <small>Customer account verification</small>
              </div>
            </section>

            <div className="customer-grid">
              {/* TRANSFER FORM */}
              <section className="panel">
                <div className="section-kicker">
                  <span className="icon-tile">↗</span>
                  <span className="eyebrow">SEND MONEY</span>
                </div>

                <h2>Make a transfer</h2>

                <p className="muted small-copy">
                  Transfer funds to another active BalanceVault customer.
                </p>

                <form
                  className="stack-form compact"
                  onSubmit={sendTransfer}
                >
                  <label className="field">
                    Recipient account number

                    <input
                      value={transfer.toAccountNumber}
                      onChange={(e) =>
                        setTransfer({
                          ...transfer,
                          toAccountNumber: e.target.value,
                        })
                      }
                      required
                      placeholder="Enter recipient account number"
                    />
                  </label>

                  <label className="field">
                    Amount (₹)

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={account?.balanceRupees || undefined}
                      value={transfer.amount}
                      onChange={(e) =>
                        setTransfer({
                          ...transfer,
                          amount: e.target.value,
                        })
                      }
                      required
                      placeholder="0.00"
                    />
                  </label>

                  <label className="field">
                    Note (optional)

                    <input
                      value={transfer.description}
                      onChange={(e) =>
                        setTransfer({
                          ...transfer,
                          description: e.target.value,
                        })
                      }
                      placeholder="What's this for?"
                    />
                  </label>

                  <button
                    className="primary-btn"
                    disabled={busy || !account}
                  >
                    {busy ? 'Processing…' : 'Review and transfer →'}
                  </button>
                </form>

                <p className="helper">
                  Check recipient details carefully before submitting.
                </p>
              </section>

              {/* WITHDRAWAL FORM */}
              <section className="panel">
                <div className="section-kicker">
                  <span className="icon-tile icon-tile-soft">↓</span>
                  <span className="eyebrow">WITHDRAW MONEY</span>
                </div>

                <h2>Withdraw funds</h2>

                <p className="muted small-copy">
                  Withdraw funds from your active BalanceVault wallet.
                </p>

                <form
                  className="stack-form compact"
                  onSubmit={makeWithdrawal}
                >
                  <label className="field">
                    Amount (₹)

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={account?.balanceRupees || undefined}
                      value={withdrawal.amount}
                      onChange={(e) =>
                        setWithdrawal({
                          ...withdrawal,
                          amount: e.target.value,
                        })
                      }
                      required
                      placeholder="0.00"
                    />
                  </label>

                  <label className="field">
                    Description (optional)

                    <input
                      value={withdrawal.description}
                      onChange={(e) =>
                        setWithdrawal({
                          ...withdrawal,
                          description: e.target.value,
                        })
                      }
                      placeholder="Withdrawal request"
                    />
                  </label>

                  <button
                    className="primary-btn"
                    disabled={
                      busy ||
                      !account ||
                      Number(withdrawal.amount) <= 0
                    }
                  >
                    {busy ? 'Processing…' : 'Withdraw money →'}
                  </button>
                </form>

                <p className="helper">
                  Simulated wallet withdrawal. Subject to available wallet
                  balance and system funding availability; no bank payout is
                  made.
                </p>
              </section>
            </div>

            {/* ACCOUNT DETAILS */}
            <section className="panel account-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">ACCOUNT DETAILS</p>
                  <h2>Your account</h2>
                </div>

                <span className="status-chip">
                  {account?.status || '—'}
                </span>
              </div>

              <div className="detail-grid">
                <div className="detail-row">
                  <span>Account holder</span>
                  <b>{user?.fullName || '—'}</b>
                </div>

                <div className="detail-row">
                  <span>Email</span>
                  <b>{user?.email || '—'}</b>
                </div>

                <div className="detail-row">
                  <span>Account number</span>
                  <b>{account?.accountNumber || '—'}</b>
                </div>

                <div className="detail-row">
                  <span>Currency</span>
                  <b>{account?.currency || 'INR'}</b>
                </div>
              </div>
            </section>

            {/* CUSTOMER STATEMENT */}
            <section className="panel history-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">ACTIVITY</p>
                  <h2>Account statement</h2>

                  <p className="muted small-copy">
                    Transactions and recorded refused attempts.
                  </p>
                </div>

                <button
                  className="outline-btn"
                  onClick={() =>
                    loadCustomer().catch((e) =>
                      setNotice({ type: 'error', text: e.message })
                    )
                  }
                >
                  Refresh activity
                </button>
              </div>

              {transactions.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Transaction</th>
                        <th>Reference</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Running balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {transactions.map((tx, i) => (
                        <tr key={tx.id || i}>
                          <td>
                            <b>{tx.type || tx.action || 'Activity'}</b>
                            <small>
                              {tx.description ||
                                tx.reason ||
                                'BalanceVault activity'}
                            </small>
                          </td>

                          <td className="reference">
                            {tx.id
                              ? String(tx.id).slice(0, 8).toUpperCase()
                              : '—'}
                          </td>

                          <td>
                            {tx.createdAt
                              ? new Date(tx.createdAt).toLocaleString('en-IN')
                              : '—'}
                          </td>

                          <td>
                            {tx.amountRupees != null
                              ? money(tx.amountRupees)
                              : tx.amountPaise != null
                                ? money(Number(tx.amountPaise) / 100)
                                : '—'}
                          </td>

                          <td>
                            {tx.runningBalancePaise != null
                              ? money(Number(tx.runningBalancePaise) / 100)
                              : '—'}
                          </td>

                          <td>
                            <span
                              className={`status-chip ${String(
                                tx.status || ''
                              ).toLowerCase()}`}
                            >
                              {tx.status ||
                                (tx.balanceAffected === false
                                  ? 'REFUSED'
                                  : 'RECORDED')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  No account activity yet. Deposits, transfers, withdrawals,
                  and refused attempts will appear here.
                </div>
              )}
            </section>
          </>
        )}

        {/* AUDITOR DASHBOARD */}
        {isAuditor && (
          <>
            <section className="audit-summary">
              <div className="stat-card">
                <span>TRANSACTIONS LOADED</span>
                <strong>{auditTransactions.length}</strong>
                <small>Financial records</small>
              </div>

              <div className="stat-card">
                <span>LEDGER ENTRIES LOADED</span>
                <strong>{auditLedger.length}</strong>
                <small>Debit and credit records</small>
              </div>

              <div className="stat-card">
                <span>AUDIT EVENTS LOADED</span>
                <strong>{auditLogs.length}</strong>
                <small>Recorded system events</small>
              </div>
            </section>

            <section className="panel history-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">READ-ONLY ACCESS</p>
                  <h2>Audit explorer</h2>

                  <p className="muted small-copy">
                    Inspect records without initiating money movement.
                  </p>
                </div>

                <button
                  className="outline-btn"
                  onClick={() =>
                    loadAuditor().catch((e) =>
                      setNotice({ type: 'error', text: e.message })
                    )
                  }
                >
                  Refresh data
                </button>
              </div>

              <div className="tab-bar">
                <button
                  className={auditTab === 'transactions' ? 'active' : ''}
                  onClick={() => setAuditTab('transactions')}
                >
                  Transactions
                </button>

                <button
                  className={auditTab === 'ledger' ? 'active' : ''}
                  onClick={() => setAuditTab('ledger')}
                >
                  Ledger
                </button>

                <button
                  className={auditTab === 'logs' ? 'active' : ''}
                  onClick={() => setAuditTab('logs')}
                >
                  Audit logs
                </button>
              </div>

              {auditTab === 'transactions' &&
                (auditTransactions.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Reference</th>
                          <th>Amount</th>
                          <th>Initiator</th>
                          <th>Ledger check</th>
                          <th>Date</th>
                        </tr>
                      </thead>

                      <tbody>
                        {auditTransactions.map((tx, i) => (
                          <tr key={tx.id || i}>
                            <td>
                              <b>{tx.type || '—'}</b>
                              <small>{tx.status || '—'}</small>
                            </td>

                            <td className="reference">
                              {tx.id ? String(tx.id).slice(0, 8) : '—'}
                            </td>

                            <td>
                              {tx.amountPaise != null
                                ? money(Number(tx.amountPaise) / 100)
                                : tx.amountRupees != null
                                  ? money(tx.amountRupees)
                                  : '—'}
                            </td>

                            <td>
                              {tx.initiatedBy?.email ||
                                tx.initiatedBy?.fullName ||
                                '—'}
                            </td>

                            <td>
                              <span
                                className={`status-chip ${
                                  tx.balanced ? 'passed' : 'pending'
                                }`}
                              >
                                {tx.balanced ? 'BALANCED' : 'CHECK'}
                              </span>
                            </td>

                            <td>
                              {tx.createdAt
                                ? new Date(tx.createdAt).toLocaleString('en-IN')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    No transaction records returned.
                  </div>
                ))}

              {auditTab === 'ledger' &&
                (auditLedger.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Direction</th>
                          <th>Account</th>
                          <th>Amount</th>
                          <th>Transaction</th>
                          <th>Date</th>
                        </tr>
                      </thead>

                      <tbody>
                        {auditLedger.map((entry, i) => (
                          <tr key={entry.id || i}>
                            <td>
                              <span
                                className={`direction-pill ${String(
                                  entry.direction
                                ).toLowerCase()}`}
                              >
                                {entry.direction || '—'}
                              </span>
                            </td>

                            <td>
                              {entry.account?.accountNumber ||
                                entry.accountId ||
                                '—'}
                            </td>

                            <td>
                              {entry.amountPaise != null
                                ? money(Number(entry.amountPaise) / 100)
                                : '—'}
                            </td>

                            <td className="reference">
                              {entry.transactionId
                                ? String(entry.transactionId).slice(0, 8)
                                : '—'}
                            </td>

                            <td>
                              {entry.createdAt
                                ? new Date(entry.createdAt).toLocaleString('en-IN')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    No ledger entries returned.
                  </div>
                ))}

              {auditTab === 'logs' &&
                (auditLogs.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Actor</th>
                          <th>Entity</th>
                          <th>Details</th>
                          <th>Date</th>
                        </tr>
                      </thead>

                      <tbody>
                        {auditLogs.map((log, i) => (
                          <tr key={log.id || i}>
                            <td>
                              <b>{log.action || '—'}</b>
                            </td>

                            <td>
                              {log.actor?.email || log.actorId || 'System'}
                            </td>

                            <td>{log.entityType || '—'}</td>

                            <td className="log-details">
                              {log.metadata
                                ? JSON.stringify(log.metadata)
                                : '—'}
                            </td>

                            <td>
                              {log.createdAt
                                ? new Date(log.createdAt).toLocaleString('en-IN')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    No audit events returned.
                  </div>
                ))}
            </section>
          </>
        )}

        {!isAdmin && !isAuditor && !isHolder && (
          <section className="panel">
            <h2>Role not supported</h2>
            <p className="muted">
              This account role has no matching frontend workspace.
            </p>
          </section>
        )}

        <footer className="footer">
          <span>BalanceVault · Every entry accountable.</span>
          <span>
            Secure ledger prototype · Simulated financial operations only
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;