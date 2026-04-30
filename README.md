# RoleMaster

> AI capability delivery platform — package AI products as reusable RolePacks of skills + knowledge + connections, and deploy them like hiring a role.

Three role-separated portals on one stack:

| Portal | Who | Color |
|---|---|---|
| **Supplier** | AI consulting firms packaging their products | green |
| **Curator** | RoleMaster review team that approves and publishes RolePacks | purple |
| **Sales** | Sales reps browsing the published catalog for customers | blue |

## Stack

- **Frontend** — React 18 + Vite, react-router-dom, no build chain beyond Vite. URL-based routing, role-gated portals, bilingual (zh / en).
- **Backend** — Hono on Node 22+ with the built-in `node:sqlite` (no native deps). REST API, opaque session-cookie auth, bcrypt-hashed passwords.
- **Database** — single SQLite file at `server/data/rolemaster.db`. Schema in [server/src/db.js](server/src/db.js).
- **AI Copilot** — Claude API via `@anthropic-ai/sdk`. Uses prompt caching on the field schema and structured output for field extraction. Falls back to a keyword matcher when `ANTHROPIC_API_KEY` is unset, so the demo runs out of the box.

## Project layout

```
RoleMaster/
├── app/                        Frontend (Vite + React)
│   ├── src/
│   │   ├── App.jsx             Router, role gates, theme
│   │   ├── main.jsx            Entry
│   │   ├── auth.jsx            Auth context (useAuth)
│   │   ├── api.js              Session-aware fetch wrapper
│   │   ├── chrome.jsx          PlatformHeader, AppHeader, CuratorHeader, ProcessStepper
│   │   ├── i18n.js             zh + en string table
│   │   ├── data.js             Sample data referenced by the form (PRODUCTS, FIELDS, LAYERS…)
│   │   ├── styles.css          Design tokens + components
│   │   ├── tweaks.jsx          Live-tweak panel (color, density, roundness, font)
│   │   └── screens/
│   │       ├── landing.jsx              /
│   │       ├── portal-login.jsx         /supplier, /curator, /sales (when logged out)
│   │       ├── supplier-home.jsx        /supplier (logged in)
│   │       ├── onboard.jsx              register / upload / identify
│   │       ├── form.jsx                 intake form + Copilot panel
│   │       ├── other.jsx                confirm / thanks / queue / publish
│   │       ├── workbench.jsx            curator workbench
│   │       └── sales.jsx                catalog + RolePack detail
│   ├── package.json
│   └── vite.config.js          Proxies /api → http://localhost:3001
│
├── server/                     Backend (Hono + node:sqlite)
│   ├── src/
│   │   ├── index.js            HTTP entry
│   │   ├── db.js               Schema + connection
│   │   ├── auth.js             bcrypt + sessions + middleware
│   │   ├── seed.js             `npm run seed` — wipes DB, creates 2 preset accounts
│   │   ├── lib/fields.js       Default field template
│   │   └── routes/
│   │       ├── auth.js         POST /register, /login, /logout · GET /me
│   │       ├── submissions.js  CRUD + field updates + submit
│   │       ├── curator.js      decision + publish
│   │       ├── catalog.js      published RolePack catalog
│   │       ├── copilot.js      Claude-powered field extraction
│   │       └── files.js        multipart upload + storage
│   └── package.json
│
└── handoff/                    Original Claude Design HTML/JSX prototype + spec
```

## Run locally

Two terminals:

```bash
# Terminal 1 — backend
cd server
npm install
npm run seed         # one-time: wipes DB, creates the two preset accounts
npm start            # listens on :3001

# Terminal 2 — frontend
cd app
npm install
npm run dev          # opens :5173, proxies /api → :3001
```

Open `http://localhost:5173/`.

### Preset accounts (password is `demo` for both)

| Role | Email |
|---|---|
| Curator | `grace@rolemaster.io` |
| Sales | `sales@rolemaster.io` |

Suppliers self-register at `/supplier/register`.

### Real Claude Copilot (optional)

Without an API key, the Copilot uses a keyword-based fallback so the demo still works. To use real Claude:

```bash
# Terminal 1
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

The default model is `claude-sonnet-4-6`. Override with `COPILOT_MODEL=claude-opus-4-7` if you want the most capable.

## End-to-end flow

1. Visit `/` → pick the supplier tile
2. Register a new supplier account at `/supplier/register`
3. Land on `/supplier` (empty dashboard) → "+ New submission"
4. Upload a file (anything works — parsing is mocked) → identify products → form auto-creates a real submission with a unique ID
5. Type freeform context to the Copilot — it extracts fields and persists them
6. Submit → confirm → thanks. Submission status flips from `draft` → `new` in the DB.
7. Sign out, sign in as `grace@rolemaster.io` at `/curator`
8. Queue shows the new submission. Click into the workbench, tick all checks, click "Approve and publish"
9. A RolePack is created and the submission is marked `published`
10. Sign out, sign in as `sales@rolemaster.io` at `/sales`
11. Catalog now shows the published RolePack

## Deploy

In production the **server** also serves the **built SPA** from the same port, so a single deploy covers both. Two recommended paths:

### Fly.io (recommended — true persistence on a free volume)

```bash
# one-time setup
brew install flyctl                       # or: https://fly.io/docs/hands-on/install-flyctl/
fly auth login

# from the repo root
fly launch --no-deploy                    # picks a unique app name; rewrites fly.toml
fly volumes create rm_data --size 1 --region iad
fly volumes create rm_uploads --size 1 --region iad
fly secrets set ANTHROPIC_API_KEY=sk-ant-...   # optional — for real Copilot
fly deploy
```

Your app is live at `https://<app-name>.fly.dev`. SQLite and uploads survive deploys via the mounted volumes.

### Render (one-click from the GitHub repo)

1. https://dashboard.render.com/blueprints → **New Blueprint Instance** → connect this repo
2. Render reads [render.yaml](render.yaml) and provisions a Docker service
3. In the service's Environment tab, set `ANTHROPIC_API_KEY` (optional)
4. Hit Deploy

Free tier note: persistent disks require a paid plan. On the free plan the SQLite DB resets on every redeploy.

### Self-hosted Docker

```bash
docker build -t rolemaster .
docker run -d -p 3001:3001 \
  -v rm-data:/data \
  -v rm-uploads:/uploads \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  rolemaster
```

### Production env vars

| Var | Purpose |
|---|---|
| `PORT` | Listen port (default `3001`) |
| `NODE_ENV` | Set to `production` to enable `Secure` cookies |
| `DATA_DIR` | Where to put `rolemaster.db` (default `server/data`) |
| `UPLOAD_DIR` | Where to write file uploads (default `server/uploads`) |
| `CORS_ORIGIN` | Restrict CORS (default reflects request origin — fine for same-origin deploys) |
| `ANTHROPIC_API_KEY` | Enables the real Claude Copilot. Without this, falls back to keyword extraction. |
| `COPILOT_MODEL` | Override the model (default `claude-sonnet-4-6`) |

## Design source

The original HTML/JSX prototype from Claude Design (claude.ai/design) is preserved under [handoff/](handoff/) for reference. The production app reimplements it in React + a real backend.

## License

Private — no license granted.
