# Elleven — Competitive Intelligence Dashboard

Elleven is a competitive-intelligence monitoring dashboard for a Brazilian bicycle
company. It scrapes competitor websites and Instagram profiles, analyzes the content
with Google Gemini AI, and surfaces actionable insights (product launches, pricing,
marketing, partnerships) in a clean news-feed interface.

## Architecture

| Layer            | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| Frontend         | React 19 + Vite 6 + Tailwind CSS 4 (`src/`)             |
| Backend (local)  | Express.js — `server.ts` (port 3001)                    |
| Backend (prod)   | Vercel serverless functions (`api/`)                    |
| Database         | Supabase PostgreSQL (`@supabase/supabase-js`)           |
| AI               | Google Gemini 2.5 Flash (`@google/genai`)               |
| Scraping         | Direct HTTP / WordPress REST + Apify (Instagram)        |
| Auth             | None — internal tool using the Supabase anon key        |

### Data flow
1. `POST /api/news/refresh` → scrapes competitors + Instagram handles → Gemini
   analyzes the content → parses into structured insights → de-duplicates →
   inserts into the Supabase `news_items` table.
2. `GET /api/news` → returns stored items to the React feed.

### Project structure
```
.
├── src/                    # React frontend
│   ├── App.tsx             # Main state + news loading/refresh
│   ├── main.tsx            # Entry point
│   ├── components/
│   │   ├── NewsFeed.tsx    # List view: tabs, search, tag filters
│   │   ├── DeepDive.tsx    # Detailed single-item view
│   │   └── Settings.tsx    # Manage monitored Instagram handles
│   └── lib/gemini.ts       # Gemini AI utilities
├── api/                    # Vercel serverless functions (production)
│   ├── health.js           # GET  /api/health
│   └── news/
│       ├── index.ts        # GET  /api/news
│       └── refresh.ts      # POST /api/news/refresh
├── server.ts               # Express backend for local dev
├── vite.config.ts          # Vite config (proxies /api → :3001 in dev)
├── vercel.json             # Vercel build + function timeouts
└── .env.example            # Environment variable template
```

### API routes
| Method | Endpoint             | Purpose                                        |
| ------ | -------------------- | ---------------------------------------------- |
| GET    | `/api/health`        | Verify required env vars are set               |
| GET    | `/api/news`          | Fetch all stored news items                    |
| POST   | `/api/news/refresh`  | Scrape competitors, analyze, save new items    |
| GET    | `/api/handles`       | List monitored Instagram handles               |
| POST   | `/api/handles`       | Add a handle to monitor                        |
| DELETE | `/api/handles/:id`   | Remove a monitored handle                      |

## Run locally

**Prerequisites:** Node.js 18+ (built/tested on Node 22).

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your environment file from the template and fill in the values:
   ```bash
   cp .env.example .env
   ```
   | Variable             | Required | Description                                  |
   | -------------------- | -------- | -------------------------------------------- |
   | `GEMINI_API_KEY`     | yes      | Google AI (Gemini) API key                   |
   | `SUPABASE_URL`       | yes      | Supabase project URL                         |
   | `SUPABASE_ANON_KEY`  | yes      | Supabase public anon key                     |
   | `APIFY_API_KEY`      | optional | Apify token for Instagram scraping           |
3. Start the dev servers (frontend on :3000, backend on :3001):
   ```bash
   npm run dev
   ```
   Then open http://localhost:3000.

## Scripts
| Command              | Description                                        |
| -------------------- | -------------------------------------------------- |
| `npm run dev`        | Run frontend (Vite) + backend (Express) together   |
| `npm run dev:client` | Run only the Vite frontend                         |
| `npm run dev:server` | Run only the Express backend                        |
| `npm run build`      | Build the production frontend into `dist/`          |
| `npm start`          | Run the backend in production mode                  |
| `npm run lint`       | Type-check with `tsc --noEmit`                      |

## Build
```bash
npm run build      # outputs static assets to dist/
```

## Deploy (Vercel)
The repo is configured for Vercel via `vercel.json`:
- Build command `npm run build`, output directory `dist/`.
- Serverless functions with timeouts: `health` 10s, `news` 30s, `refresh` 300s.
- SPA rewrites send all non-`/api` routes to `index.html`.

Set the same environment variables (`GEMINI_API_KEY`, `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `APIFY_API_KEY`) in the Vercel project settings, then deploy
by connecting the Git repo or running `vercel`.

## Notes
- No user authentication is implemented; this is intended as an internal tool.
- The list of monitored competitors is defined in `server.ts`.
- A pre-built `dist/` folder is included in this archive for convenience; you can
  regenerate it any time with `npm run build`.
