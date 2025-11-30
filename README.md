# Neighborhood Fund (Testnet) — README

This repository is a small demo web application that showcases using the Stellar Testnet for community micro-donations. It includes a Node.js backend (Express), a simple client-side UI served from static files, and a small CLI helper for interacting with Stellar.

## Technology stack

- Node.js (JavaScript)
- Express.js for the HTTP server and API
- Stellar SDK (`stellar-sdk`) to interact with the Stellar Testnet (Horizon)
- Vanilla client-side JavaScript served from `public/` (no framework)
- Simple JSON-backed "stores" (`users.json`, `campaigns.json`) via `users-store.js` and `campaign-store.js` for demo persistence
- Dev/test utilities: Mocha + Chai for tests
- Environment variables via `dotenv`

## Architecture overview

- Single-process Node/Express server (`server.js`) that:
  - Serves the static frontend from `public/`
  - Exposes REST API endpoints under `/api/*` for user, campaign and Stellar interactions
  - Uses `index.js` for core Stellar helper functions (get balance, send payment, keypair handling)
  - Uses in-memory session tokens (cookie `__nf_user`) for demo authentication and stores sessions in a server-side object
  - Allows a simple admin flow using an `ADMIN_TOKEN` header or an admin cookie (demo-only)
- Frontend (`public/`) is a static app that talks to the server API (fetch + cookies credentials)
- Data persistence is file-based JSON (demo): `users.json`, `campaigns.json`. Helper modules `users-store.js` and `campaign-store.js` abstract reading/writing these files.
- Stellar interaction always targets the Testnet Horizon endpoint: `https://horizon-testnet.stellar.org` (see `index.js` and `server.js`)

## Security / Production notes (important)

- This project is a demo and is NOT production-ready. Known insecure/demo choices:
  - Secrets (private keys) may be stored in JSON files for demo convenience. Do NOT do this in production.
  - Sessions are kept in-memory (process memory), not a proper session store. This will lose sessions on restart and is not scalable.
  - No CSRF protection is implemented beyond simple SameSite cookie attributes for some flows.
  - Admin token and admin credentials are configured via environment variables but default to insecure values if not set.

For production, you should:
- Remove any server-side storage of private keys and use a secure vault or never accept secrets on the server.
- Use a proper database (Postgres, MySQL, or managed DB) for users and campaigns.
- Use a production session store (Redis, database) or a proper auth system (JWT/OAuth) as required.
- Harden CORS, cookies, and TLS configuration.
- Move to Stellar Mainnet only after careful auditing and secure key handling.

## Quick start (development)

1. Install dependencies:

```bash
cd /path/to/repo
npm install
```

2. Start the server (defaults to PORT=3000):

```bash
npm start
```

3. Open the web UI in your browser: http://localhost:3000

4. Run tests (if you want to run the small Mocha suite):

```bash
npm test
```

## Environment variables

- PORT — server port (default 3000)
- ADMIN_TOKEN — admin token required for creating/deleting campaigns via API (default `devtoken` in demo)
- ADMIN_USER, ADMIN_PASS — credentials for the simple admin login (demo defaults: `admin` / `password`)
- FRONTEND_ORIGIN or FRONTEND_ORIGINS — comma-separated list of allowed origins for CORS (the server will also allow localhost)
- STELLAR_SECRET — optional: used by the CLI in `index.js` when running balance/pay commands

## CLI helper (index.js)

`index.js` exports and implements a tiny CLI to interact with Stellar Testnet. Examples:

```bash
# Show balance using an env secret
STELLAR_SECRET=SB... node index.js balance

# Or pass secret argument
node index.js balance --secret SB...

# Send payment
node index.js pay --secret SB... --to GD... --amount 1.5
```

The same helper functions (`getBalance`, `sendPayment`, `getKeypair`) are used by `server.js` for the web API.

## API overview (selected endpoints)

- POST /api/users/register — register a demo user (returns a cookie session)
- POST /api/users/login — login and set session cookie
- POST /api/users/logout — clear session
- GET /api/users/me — get current user info (requires cookie)
- POST /api/users/wallets — add a wallet (stores secret in demo store)
- GET /api/users/wallets — list user's wallets with balances
- POST /api/users/donate — donate using a stored wallet (server performs the payment)

- POST /api/campaigns — create a campaign (admin only; requires `x-admin-token` or admin cookie)
- GET /api/campaigns — list campaigns with balances
- GET /api/campaigns/:id/txs — list recent transactions for a campaign

- POST /api/balance — returns balance for provided secret
- POST /api/pay — submit a payment when provided secret, to, amount

Refer to `server.js` for full behavior and implementation details (simple, well-commented code).

## Files of interest

- `server.js` — main web server, API endpoints, static file serving
- `index.js` — Stellar helper functions and small CLI wrapper
- `users-store.js`, `campaign-store.js` — simple JSON-backed stores
- `public/` — frontend static files (HTML, CSS, JS)
- `package.json` — scripts and dependencies

## Deployment

Two simple demo options are provided in `DEPLOY.md`:

- Deploy to Heroku / Railway / Render: push repository and configure environment variables.
- Docker: build image with `docker build -t neighborhood-fund:latest .` and run it with `docker run -p 3000:3000 neighborhood-fund:latest`.

Remember: for production you must secure secrets and use production-grade storage and key management.

## License

MIT

---

If you'd like, I can also:
- Add a short SECURITY.md explaining how to handle keys and secrets properly.
- Add a small smoke test that boots the server and hits `/api/campaigns` to confirm the server starts.

If you want any part of the README expanded or translated, tell me which section and I will update it.
