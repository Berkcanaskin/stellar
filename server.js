#!/usr/bin/env node
const express = require('express');
const path = require('path');
const bodyParser = require('express').json;
require('dotenv').config();

const { getBalance, sendPayment } = require('./index.js');
const StellarSdk = require('stellar-sdk');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const store = require('./campaign-store');
const users = require('./users-store');
const crypto = require('crypto');

// Horizon server instance for querying operations
const horizon = new StellarSdk.Server('https://horizon-testnet.stellar.org');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());

// CORS: allow the frontend to call the API and send/receive cookies
// Accept a comma-separated list in FRONTEND_ORIGINS or a single FRONTEND_ORIGIN
const rawOrigins = process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || 'https://denemeberkcan.netlify.app';
const ALLOWED_ORIGINS = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: (origin, cb) => {
  // allow requests with no origin (curl/postman, server-side requests)
  if (!origin) return cb(null, true);
  // allow localhost for development
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return cb(null, true);
  if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
  console.warn('CORS blocked origin:', origin);
  return cb(new Error('Not allowed by CORS'));
}, credentials: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser());

// simple in-memory sessions: token -> username
const sessions = {};

function hashPassword(password){
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash: derived };
}

function verifyPassword(password, salt, hash){
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  try { return crypto.timingSafeEqual(Buffer.from(derived,'hex'), Buffer.from(hash,'hex')); }
  catch(e){ return false; }
}

function createSession(username){
  const token = crypto.randomBytes(18).toString('hex');
  sessions[token] = { username, ts: Date.now() };
  return token;
}

function getUserFromReq(req){
  const t = req.cookies && req.cookies.__nf_user;
  if(!t) return null;
  const s = sessions[t];
  if(!s) return null;
  const u = users.getByUsername(s.username);
  return u ? { username: s.username, user: u } : null;
}

// User registration
app.post('/api/users/register', express.json(), (req, res) => {
  const { username, password, password2 } = req.body || {};
  if(!username || !password || !password2) return res.status(400).json({ error: 'username and passwords required' });
  if(password !== password2) return res.status(400).json({ error: 'passwords do not match' });
  if(users.getByUsername(username)) return res.status(400).json({ error: 'username taken' });
  const p = hashPassword(password);
  const user = { username, passSalt: p.salt, passHash: p.hash, wallets: [], createdAt: new Date().toISOString() };
  users.addUser(user);
  const token = createSession(username);
  res.cookie('__nf_user', token, { httpOnly: true, maxAge: 24*60*60*1000 });
  res.json({ ok: true, username });
});

// User login
app.post('/api/users/login', express.json(), (req, res) => {
  const { username, password } = req.body || {};
  if(!username || !password) return res.status(400).json({ error: 'username and password required' });
  const u = users.getByUsername(username);
  if(!u) return res.status(401).json({ error: 'invalid credentials' });
  if(!verifyPassword(password, u.passSalt, u.passHash)) return res.status(401).json({ error: 'invalid credentials' });
  const token = createSession(username);
  res.cookie('__nf_user', token, { httpOnly: true, maxAge: 24*60*60*1000 });
  res.json({ ok: true, username });
});

app.post('/api/users/logout', (req, res) => {
  const t = req.cookies && req.cookies.__nf_user;
  if(t) delete sessions[t];
  res.clearCookie('__nf_user');
  res.json({ ok: true });
});

app.get('/api/users/me', (req, res) => {
  const s = getUserFromReq(req);
  if(!s) return res.status(401).json({ error: 'not logged in' });
  const u = s.user;
  res.json({ username: s.username, createdAt: u.createdAt || null, wallets: (u.wallets||[]).map(w=>({ publicKey: w.publicKey })) });
});

// Add a wallet for the logged-in user (stores secret server-side for demo)
app.post('/api/users/wallets', express.json(), (req, res) => {
  const s = getUserFromReq(req);
  if(!s) return res.status(401).json({ error: 'not logged in' });
  const { secret, name } = req.body || {};
  if(!secret) return res.status(400).json({ error: 'secret required' });
  const label = (name || '').toString().trim() || null;
  try {
    const kp = require('./index.js').getKeypair(secret);
    const publicKey = kp.publicKey();
    const u = users.getByUsername(s.username);
    if(!u) return res.status(500).json({ error: 'user not found' });
    u.wallets = u.wallets || [];
    if(u.wallets.find(w => w.publicKey === publicKey)) return res.status(400).json({ error: 'wallet already added' });
    u.wallets.push({ publicKey, secret, name: label });
    users.updateUser(s.username, { wallets: u.wallets });
    return res.json({ ok: true, publicKey, name: label });
  } catch (e) {
    return res.status(400).json({ error: e.message || String(e) });
  }
});

// List wallets for logged-in user with balances (uses secret if available, otherwise horizon query)
app.get('/api/users/wallets', async (req, res) => {
  const s = getUserFromReq(req);
  if(!s) return res.status(401).json({ error: 'not logged in' });
  try {
    const u = users.getByUsername(s.username);
    const list = (u.wallets || []).map(w => ({ publicKey: w.publicKey, hasSecret: !!w.secret, name: w.name || null }));
    // fetch balances for each wallet (best-effort)
    const out = await Promise.all(list.map(async (w) => {
      try {
        if (w.hasSecret) {
          const info = await require('./index.js').getBalance(u.wallets.find(x=>x.publicKey===w.publicKey).secret);
          const xlm = info.balances.find(b => b.asset === 'XLM');
          return { publicKey: w.publicKey, balance: xlm ? Number(xlm.balance) : 0, name: w.name };
        } else {
          try {
            const acc = await horizon.loadAccount(w.publicKey);
            const x = acc.balances.find(b => b.asset_type === 'native');
            return { publicKey: w.publicKey, balance: x ? Number(x.balance) : 0, name: w.name };
          } catch (e) { return { publicKey: w.publicKey, balance: 0 }; }
        }
      } catch (e) { return { publicKey: w.publicKey, balance: 0 }; }
    }));
    res.json({ wallets: out });
  } catch (e) { res.status(500).json({ error: e.message || String(e) }); }
});

// Remove a wallet for the logged-in user
app.delete('/api/users/wallets', express.json(), (req, res) => {
  const s = getUserFromReq(req);
  if(!s) return res.status(401).json({ error: 'not logged in' });
  const { publicKey } = req.body || {};
  if(!publicKey) return res.status(400).json({ error: 'publicKey required' });
  const u = users.getByUsername(s.username);
  if(!u) return res.status(500).json({ error: 'user not found' });
  const newlist = (u.wallets || []).filter(w => w.publicKey !== publicKey);
  users.updateUser(s.username, { wallets: newlist });
  res.json({ ok: true });
});

// Donate using a stored wallet for the logged-in user
app.post('/api/users/donate', express.json(), async (req, res) => {
  const s = getUserFromReq(req);
  if(!s) return res.status(401).json({ error: 'not logged in' });
  const { publicKey, to, amount } = req.body || {};
  if(!publicKey || !to || !amount) return res.status(400).json({ error: 'publicKey, to and amount required' });
  try {
    const u = users.getByUsername(s.username);
    const w = (u.wallets || []).find(x => x.publicKey === publicKey && x.secret);
    if(!w) return res.status(400).json({ error: 'stored secret not found for the given publicKey' });
    const tx = await require('./index.js').sendPayment(w.secret, to, amount);
    res.json({ ok: true, hash: tx.hash });
  } catch (e) { res.status(500).json({ error: e.message || String(e) }); }
});

// Public account info lookup (balances) for any public key
app.get('/api/account/:pk', async (req, res) => {
  try {
    const pk = req.params.pk;
    if(!pk) return res.status(400).json({ error: 'public key required' });
    try {
      const acct = await horizon.loadAccount(pk);
      const balances = acct.balances.map(b => ({ asset: b.asset_type === 'native' ? 'XLM' : b.asset_code, balance: b.balance }));
      return res.json({ publicKey: pk, balances });
    } catch (e) {
      return res.status(404).json({ error: 'account not found' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// API: balance
app.post('/api/balance', async (req, res) => {
  const { secret } = req.body;
  if (!secret) return res.status(400).json({ error: 'secret required' });
  try {
    const info = await getBalance(secret);
    res.json({ publicKey: info.publicKey, balances: info.balances });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// API: pay
app.post('/api/pay', async (req, res) => {
  const { secret, to, amount } = req.body;
  if (!secret || !to || !amount) return res.status(400).json({ error: 'secret, to and amount required' });
  try {
    const tx = await sendPayment(secret, to, amount);
    res.json({ hash: tx.hash, result: tx });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Create a campaign: generates a keypair, funds it with friendbot, stores in-memory
// Create a campaign: generates a keypair, funds it with friendbot, stores in JSON file
app.post('/api/campaigns', async (req, res) => {
  // allow admin by header token OR cookie-based login
  const adminToken = req.header('x-admin-token') || req.query.admin_token;
  const required = process.env.ADMIN_TOKEN || 'devtoken';
  const isAdminCookie = req.cookies && req.cookies.__nf_admin === '1';
  if (adminToken !== required && !isAdminCookie) return res.status(401).json({ error: 'admin token required' });
  const { title, goal, publicKey: providedPublicKey, secret: providedSecret } = req.body;
  if (!title || !goal) return res.status(400).json({ error: 'title and goal required' });
  // For safety and clarity: require admin to provide a publicKey; do NOT accept or store secrets from the admin UI
  if (!providedPublicKey) return res.status(400).json({ error: 'publicKey is required' });
  try {
    // Do not accept/store secrets from admin UI. Use the provided publicKey as the campaign account.
    const publicKey = providedPublicKey;
    const list = store.all();
    const id = list.length + 1;
    const c = { id, title, goal: Number(goal), publicKey };
    store.addCampaign(c);
    res.json({ campaign: { id, title, goal, publicKey } });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Stats: per-key donation totals (sums payment amounts found in Horizon per campaign public key)
// Simple in-memory cache for per-key totals to avoid hammering Horizon on each UI refresh
const perKeyCache = { ts: 0, ttl: 60 * 1000, data: null };
app.get('/api/stats/per-key', async (req, res) => {
  try {
    const force = req.query.refresh === '1';
    const now = Date.now();
    if (!force && perKeyCache.data && (now - perKeyCache.ts) < perKeyCache.ttl) {
      return res.json({ totals: perKeyCache.data, cached: true, ageMs: now - perKeyCache.ts });
    }

    const campaigns = store.all();
    const totals = {};
    // Fetch payments for each campaign and sum amounts. Limit pages to avoid long blocking.
    await Promise.all(campaigns.map(async (c) => {
      try {
        // Use payments endpoint which returns payment-like records with an 'amount' field
        const page = await horizon.payments().forAccount(c.publicKey).limit(200).order('desc').call();
        const sum = (page.records || []).reduce((acc, r) => {
          const a = parseFloat(r.amount || 0);
          return acc + (isNaN(a) ? 0 : a);
        }, 0);
        totals[c.publicKey] = (totals[c.publicKey] || 0) + sum;
      } catch (e) {
        totals[c.publicKey] = totals[c.publicKey] || 0;
      }
    }));

    perKeyCache.data = totals;
    perKeyCache.ts = now;
    res.json({ totals, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Delete a campaign (admin only)
app.delete('/api/campaigns/:id', async (req, res) => {
  const adminToken = req.header('x-admin-token') || req.query.admin_token;
  const required = process.env.ADMIN_TOKEN || 'devtoken';
  const isAdminCookie = req.cookies && req.cookies.__nf_admin === '1';
  if (adminToken !== required && !isAdminCookie) return res.status(401).json({ error: 'admin token required' });
  try {
    const id = Number(req.params.id);
    const deleted = store.deleteCampaign(id);
    if (!deleted) return res.status(404).json({ error: 'campaign not found' });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// List campaigns with current balances
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = store.all();
    const list = await Promise.all(campaigns.map(async (c) => {
      try {
        // If we have the secret stored, use it to fetch balances; otherwise fetch by public key
        let balances = [];
        if (c.secret) {
          const info = await getBalance(c.secret);
          balances = info.balances;
        } else {
          // fetch account by public key
          try {
            const account = await horizon.loadAccount(c.publicKey);
            balances = account.balances.map(b => ({ asset: b.asset_type === 'native' ? 'XLM' : b.asset_code, balance: b.balance }));
          } catch (e) {
            balances = [];
          }
        }
        const xlm = balances.find(b => b.asset === 'XLM');
        return { id: c.id, title: c.title, goal: c.goal, publicKey: c.publicKey, balance: xlm ? Number(xlm.balance) : 0 };
      } catch (e) {
        return { id: c.id, title: c.title, goal: c.goal, publicKey: c.publicKey, balance: 0 };
      }
    }));
    res.json({ campaigns: list });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Get recent transactions for a campaign by id (uses public key)
app.get('/api/campaigns/:id/txs', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const campaigns = store.all();
    const c = campaigns.find(x => x.id === id);
    if (!c) return res.status(404).json({ error: 'campaign not found' });
    // fetch operations for account via Horizon
  const ops = await horizon.operations().forAccount(c.publicKey).limit(10).order('desc').call();
    const items = ops.records.map(r => ({ id: r.id, type: r.type, from: r.from, to: r.to, amount: r.amount, created_at: r.created_at }));
    res.json({ txs: items });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Admin login: simple username/password that sets a httpOnly admin cookie (demo only)
app.post('/api/admin/login', express.json(), (req, res) => {
  const { user, pass } = req.body || {};
  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'password';
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    // set simple admin cookie. For cross-site (frontend on Netlify) to receive this cookie
    // we must set SameSite=None and Secure, and the browser must send credentials on fetch.
    res.cookie('__nf_admin', '1', { httpOnly: true, maxAge: 60 * 60 * 1000, sameSite: 'None', secure: true });
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'invalid credentials' });
});

// Admin session check (safe endpoint): returns ok if admin cookie is present or x-admin-token matches
app.get('/api/admin/check', (req, res) => {
  const adminToken = req.header('x-admin-token') || req.query.admin_token;
  const required = process.env.ADMIN_TOKEN || 'devtoken';
  const isAdminCookie = req.cookies && req.cookies.__nf_admin === '1';
  if (isAdminCookie || (adminToken && adminToken === required)) return res.json({ ok: true });
  return res.status(401).json({ error: 'not admin' });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('__nf_admin');
  res.json({ ok: true });
});

// Try to bind to PORT, but if it's already in use, pick the next free port.
const net = require('net');

function startServerOnAvailablePort(startPort, maxTries = 10) {
  let port = Number(startPort) || 3000;
  let tries = 0;

  function tryPort(p) {
    const tester = net.createServer()
      .once('error', function (err) {
        tester.close?.();
        if (err && err.code === 'EADDRINUSE') {
          tries++;
          if (tries > maxTries) {
            console.error(`Port ${p} in use and no free ports found after ${maxTries} attempts.`);
            process.exit(1);
          }
          console.warn(`Port ${p} in use, trying ${p + 1}...`);
          tryPort(p + 1);
        } else {
          console.error('Port test error:', err);
          process.exit(1);
        }
      })
      .once('listening', function () {
        tester.close(() => {
          app.listen(p, () => {
            console.log(`Web UI running on http://localhost:${p}`);
          });
        });
      })
      .listen(p, '0.0.0.0');
  }

  tryPort(port);
}

startServerOnAvailablePort(PORT, 50);
