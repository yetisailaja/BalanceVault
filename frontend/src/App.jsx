import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
const key = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('bv-session') || 'null'); } catch { return null; }
  });
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pending, setPending] = useState([]);
  const [transfer, setTransfer] = useState({ toAccountNumber: '', amount: '', description: '' });
  const [deposit, setDeposit] = useState({ accountNumber: '', amount: '', description: '' });

  const token = session?.token;
  const user = session?.user;
  const isAdmin = user?.role === 'ADMIN';

  const call = useCallback((path, options = {}) => request(path, { ...options, token }), [token]);
  const loadCustomer = useCallback(async () => {
    const data = await call('/api/accounts/me');
    setAccount(data.accounts?.[0] || null);
    const history = await call('/api/accounts/transactions');
    setTransactions(history.transactions || []);
  }, [call]);
  const loadAdmin = useCallback(async () => {
    const data = await call('/api/admin/onboarding/pending');
    setPending(data.requests || []);
  }, [call]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        if (isAdmin) await loadAdmin();
        else await loadCustomer();
      } catch (error) {
        if (active) setNotice({ type: 'error', text: error.message });
      }
    })();
    return () => { active = false; };
  }, [token, isAdmin, loadAdmin, loadCustomer]);

  const updateForm = (field, value) => setForm((old) => ({ ...old, [field]: value }));
  const logout = () => {
    sessionStorage.removeItem('bv-session');
    setSession(null); setAccount(null); setTransactions([]); setPending([]); setNotice({ type: '', text: '' });
  };

  async function authenticate(event) {
    event.preventDefault(); setBusy(true); setNotice({ type: '', text: '' });
    try {
      if (mode === 'register') {
        await request('/api/auth/register', { method: 'POST', body: JSON.stringify(form) });
        setMode('login'); setForm({ fullName: '', email: form.email, password: '' });
        setNotice({ type: 'success', text: 'Registration submitted. Your account is awaiting administrator approval. You can sign in after approval.' });
      } else {
        const data = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }) });
        const next = { token: data.token, user: data.user };
        sessionStorage.setItem('bv-session', JSON.stringify(next)); setSession(next);
        setNotice({ type: 'success', text: `Welcome, ${data.user.fullName || data.user.email}.` });
      }
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  }

  async function sendTransfer(event) {
    event.preventDefault(); setBusy(true); setNotice({ type: '', text: '' });
    try {
      const amountPaise = Math.round(Number(transfer.amount) * 100);
      if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new Error('Enter a valid transfer amount.');
      const result = await call('/api/transfers', { method: 'POST', headers: { 'Idempotency-Key': key() }, body: JSON.stringify({ toAccountNumber: transfer.toAccountNumber.trim(), amountPaise, description: transfer.description }) });
      setTransfer({ toAccountNumber: '', amount: '', description: '' });
      setNotice({ type: 'success', text: result.message || 'Transfer completed.' });
      await loadCustomer();
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  }

  async function review(userId, status) {
    setBusy(true);
    try {
      const result = await call(`/api/admin/onboarding/${userId}/review`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice({ type: 'success', text: result.message }); await loadAdmin();
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  }

  async function makeDeposit(event) {
    event.preventDefault(); setBusy(true); setNotice({ type: '', text: '' });
    try {
      const amountPaise = Math.round(Number(deposit.amount) * 100);
      if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new Error('Enter a valid deposit amount.');
      const result = await call('/api/admin/deposits', { method: 'POST', headers: { 'Idempotency-Key': key() }, body: JSON.stringify({ accountNumber: deposit.accountNumber.trim(), amountPaise, description: deposit.description }) });
      setDeposit({ accountNumber: '', amount: '', description: '' });
      setNotice({ type: 'success', text: result.message || 'Simulated deposit completed.' });
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  }

  const initials = useMemo(() => (user?.fullName || user?.email || 'B').slice(0, 1).toUpperCase(), [user]);

  if (!session) return <main className="auth-shell">
    <aside className="brand-panel"><div className="brand"><span className="brand-mark">B</span><span>BalanceVault</span><span className="secure-pill">● Secure ledger platform</span></div><div className="brand-copy"><p className="eyebrow">MONEY, ACCOUNTED FOR.</p><h1>Confidence in every <em>transaction.</em></h1><p>A clearer view of your accounts, built on a ledger where every entry has its place.</p><div className="feature-pills"><span>Double-entry ledger</span><span>Idempotent transfers</span><span>Role-based security</span></div></div><div className="vault-art"><div className="vault-top">BV / PRIVATE LEDGER</div><div className="vault-bars"><i/><i/><i/></div><div className="vault-bottom">✓ SECURE BY DESIGN</div></div><p className="brand-foot">Every entry accountable.</p></aside>
    <section className="auth-main"><div className="auth-card"><p className="eyebrow">{mode === 'register' ? 'GET STARTED' : 'WELCOME BACK'}</p><h2>{mode === 'register' ? 'Create your vault' : 'Sign in to your vault'}</h2><p className="muted">{mode === 'register' ? 'Register to request a customer account.' : 'Your accounts, clearly in view.'}</p>
      {notice.text && <div className={`notice ${notice.type}`}>{notice.text}</div>}
      <form onSubmit={authenticate} className="stack-form">{mode === 'register' && <label>Full name<input value={form.fullName} onChange={(e) => updateForm('fullName', e.target.value)} autoComplete="name" minLength="2" required placeholder="Enter your full name"/></label>}<label>Email address<input type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} autoComplete="email" required placeholder="you@example.com"/></label><label>Password<input type="password" value={form.password} onChange={(e) => updateForm('password', e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : 1} required placeholder="Enter your password"/></label><button className="primary-btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Submit registration →' : 'Sign in →'}</button></form>
      <p className="switch-line">{mode === 'register' ? 'Already have an account?' : 'New to BalanceVault?'} <button className="text-btn" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setNotice({ type: '', text: '' }); }}>{mode === 'register' ? 'Sign in' : 'Create an account'}</button></p><div className="security-note">Your credentials are securely processed by the BalanceVault backend.</div></div></section>
  </main>;

  return <div className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark small">B</span><span>BalanceVault</span></div><div className="top-user"><span className="avatar">{initials}</span><span><b>{user?.fullName || user?.email}</b><small>{user?.role}</small></span><button className="outline-btn" onClick={logout}>Sign out</button></div></header>
    <main className="dashboard"><div className="page-heading"><div><p className="eyebrow">{isAdmin ? 'CONTROL CENTRE' : 'YOUR FINANCIAL OVERVIEW'}</p><h1>{isAdmin ? 'Administrator dashboard' : 'Your dashboard'}</h1><p className="muted">{isAdmin ? 'Review onboarding and manage simulated account funding.' : 'Welcome back. Here is your account at a glance.'}</p></div><span className="live-tag"><i/> Secure session</span></div>
      {notice.text && <div className={`notice ${notice.type}`}>{notice.text}<button onClick={() => setNotice({ type: '', text: '' })}>×</button></div>}
      {isAdmin ? <div className="admin-grid"><section className="panel wide"><div className="panel-heading"><div><p className="eyebrow">CUSTOMER ONBOARDING</p><h2>Pending applications</h2></div><span className="count-badge">{pending.length} pending</span></div>{pending.length ? <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Email</th><th>Applied</th><th>Decision</th></tr></thead><tbody>{pending.map((item) => <tr key={item.id}><td>{item.user.fullName}</td><td>{item.user.email}</td><td>{new Date(item.createdAt).toLocaleDateString('en-IN')}</td><td className="actions"><button className="approve-btn" disabled={busy} onClick={() => review(item.user.id, 'APPROVED')}>Approve</button><button className="reject-btn" disabled={busy} onClick={() => review(item.user.id, 'REJECTED')}>Reject</button></td></tr>)}</tbody></table></div> : <div className="empty-state">No pending customer applications.</div>}</section><section className="panel"><p className="eyebrow">ACCOUNT FUNDING</p><h2>Simulated deposit</h2><p className="muted small-copy">Admin-only funding for an approved customer account.</p><form className="stack-form compact" onSubmit={makeDeposit}><label>Customer account number<input value={deposit.accountNumber} onChange={(e) => setDeposit({ ...deposit, accountNumber: e.target.value })} required placeholder="BVxxxxxxxxxx"/></label><label>Amount (₹)<input type="number" min="0.01" step="0.01" value={deposit.amount} onChange={(e) => setDeposit({ ...deposit, amount: e.target.value })} required placeholder="1000.00"/></label><label>Description (optional)<input value={deposit.description} onChange={(e) => setDeposit({ ...deposit, description: e.target.value })} placeholder="Initial funding"/></label><button className="primary-btn" disabled={busy}>{busy ? 'Processing…' : 'Create deposit'}</button></form><p className="helper">This is simulated funding. No real bank or payment network is connected.</p></section></div> : <><section className="summary-grid"><div className="balance-card"><div className="balance-top"><span>AVAILABLE BALANCE</span><span className="balance-icon">₹</span></div><strong>{account ? money(account.balanceRupees) : '—'}</strong><div className="balance-foot"><span>INR · Active account</span><button onClick={() => loadCustomer().catch((e) => setNotice({ type: 'error', text: e.message }))}>↻ Refresh</button></div></div><div className="stat-card"><span>ACCOUNT NUMBER</span><strong className="account-number">{account?.accountNumber || 'Not available'}</strong><small>Use this to receive transfers</small></div><div className="stat-card"><span>ACCOUNT STATUS</span><strong><i className="status-dot"/> {account?.status || 'Pending'}</strong><small>Customer account verification</small></div></section>
      <div className="customer-grid"><section className="panel"><p className="eyebrow">SEND MONEY</p><h2>Make a transfer</h2><p className="muted small-copy">Transfer funds to another active BalanceVault customer.</p><form className="stack-form compact" onSubmit={sendTransfer}><label>Recipient account number<input value={transfer.toAccountNumber} onChange={(e) => setTransfer({ ...transfer, toAccountNumber: e.target.value })} required placeholder="Enter recipient account number"/></label><label>Amount (₹)<input type="number" min="0.01" step="0.01" value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} required placeholder="0.00"/></label><label>Note (optional)<input value={transfer.description} onChange={(e) => setTransfer({ ...transfer, description: e.target.value })} placeholder="What's this for?"/></label><button className="primary-btn" disabled={busy || !account}>{busy ? 'Processing…' : 'Review and transfer →'}</button></form><p className="helper">Transfers are processed securely and cannot be reversed from this screen. Check the recipient details.</p></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">ACCOUNT DETAILS</p><h2>Your account</h2></div><span className="status-chip">{account?.status || '—'}</span></div><div className="detail-row"><span>Account holder</span><b>{user?.fullName || '—'}</b></div><div className="detail-row"><span>Email</span><b>{user?.email}</b></div><div className="detail-row"><span>Account number</span><b>{account?.accountNumber || '—'}</b></div><div className="detail-row"><span>Currency</span><b>{account?.currency || 'INR'}</b></div></section></div>
      <section className="panel history-panel"><div className="panel-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Recent transactions</h2></div><button className="outline-btn" onClick={() => loadCustomer().catch((e) => setNotice({ type: 'error', text: e.message }))}>Refresh activity</button></div>{transactions.length ? <div className="table-wrap"><table><thead><tr><th>Transaction</th><th>Reference</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{transactions.map((tx) => <tr key={tx.id}><td><b>{tx.type}</b><small>{tx.description || 'BalanceVault transaction'}</small></td><td className="reference">{tx.id.slice(0, 8).toUpperCase()}</td><td>{new Date(tx.createdAt).toLocaleString('en-IN')}</td><td>{money(tx.amountRupees)}</td><td><span className="status-chip">{tx.status}</span></td></tr>)}</tbody></table></div> : <div className="empty-state">No transactions yet. Completed transfers will appear here.</div>}</section></>}
      <footer className="footer">BalanceVault · Every entry accountable. <span>Secure ledger prototype · Simulated deposits only</span></footer>
    </main></div>;
}

export default App;
