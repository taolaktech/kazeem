# finoptions-dashboard

Read-only React dashboard for the NestJS intraday options intelligence API. It renders the
aggregated `GET /trade-decision/:symbol?maxBudget=` response and never computes signals,
regimes, scores or orders of its own.

## Stack

React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui-style primitives (Radix), Recharts,
Lucide icons.

## Run

```bash
# backend (repository root)
source ~/.nvm/nvm.sh && nvm use 22
npm ci && npm run build
MASSIVE_API_KEY=<key> node dist/main.js        # http://localhost:3000

# frontend
cd finoptions-dashboard
cp .env.example .env
npm install
npm run dev                                    # http://localhost:5173
```

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Base URL of the NestJS API |

Vite resolves this at **build time**, per mode:

- `npm run dev` reads `.env` (copied from `.env.example`) → local API.
- `npm run build` reads `.env.production` → the deployed API.

Either can be overridden by exporting `VITE_API_BASE_URL` in the build
environment. A dashboard served over https must point at an https API, or the
browser blocks the request as mixed content.

The backend reads `CORS_ORIGINS` (comma-separated) and allows the dev server
plus the deployed dashboard origins by default.

## Scripts

```bash
npm run dev
npm run build      # tsc -b && vite build
npm run lint       # oxlint
```
