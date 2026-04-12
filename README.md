# 🗺️ OpenTimeline

OpenTimeline is a self-hosted drop-in replacement for Google Maps Timeline, built with Next.js and PostgreSQL.
After Google moved Timeline to on-device storage in 2024, OpenTimeline gives you back a server-side timeline you own and control.
It ingests location points (OwnTracks webhook or GPX import), renders them on a map, and helps you turn dwell periods into meaningful places and visit history.

## ✨ Features

**🔒 Your data, your server**
- Full timeline history across day / week / month / year / custom / all ranges
- Interactive map with location tracks and daily stats
- Live ingestion via OwnTracks webhook — or bulk import from GPX files

**📍 Smart place & visit tracking**
- Define places with a custom radius; OpenTimeline does the rest
- Automatic visit detection from dwell clusters — confirm or reject suggestions
- Unknown-visit suggestions for dwell periods outside any known place

**🔌 Integrations**
- 📷 Immich photo overlay — see your photos in context on the map
- 🤖 Built-in MCP server — AI agents (Claude, etc.) can query your timeline directly

## 🛠️ Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- PostgreSQL + Prisma ORM
- Tailwind CSS 4
- Leaflet / react-leaflet

## 📋 Requirements

- Node.js 20+
- pnpm
- PostgreSQL 14+

## 🚀 Quick Start

### 1) Install dependencies

```bash
pnpm install
```

### 2) Start PostgreSQL (optional helper)

If you want to run Postgres via Docker:

```bash
docker compose up -d postgres
```

This exposes Postgres on `localhost:54231` with user `postgres` and password `postgres`.

### 3) Create `.env`

Create `.env` in the project root with:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:54231/postgres?schema=public"

# Optional: periodic Postgres dump backup schedule/retention
POSTGRES_BACKUP_SCHEDULE="@daily"
POSTGRES_BACKUP_KEEP_DAYS="7"
POSTGRES_BACKUP_KEEP_WEEKS="4"
POSTGRES_BACKUP_KEEP_MONTHS="6"

# Optional: Immich integration
IMMICH_BASE_URL="http://localhost:2283"
IMMICH_API_KEY="your_api_key"
```

### 4) Run migrations

```bash
pnpm prisma migrate deploy
```

For local schema iteration during development:

```bash
pnpm prisma migrate dev
```

### 5) Start the app

```bash
pnpm dev
```

Open `http://localhost:3000`. The root route redirects to `/timeline/YYYY-MM-DD` for today.

## 💾 Database Backups

Docker Compose includes a `postgres-backup` sidecar that runs `pg_dump` on a schedule.

- Schedule is controlled by `POSTGRES_BACKUP_SCHEDULE` (default `@daily`).
- Retention is controlled by:
  - `POSTGRES_BACKUP_KEEP_DAYS`
  - `POSTGRES_BACKUP_KEEP_WEEKS`
  - `POSTGRES_BACKUP_KEEP_MONTHS`
- Backup files are written to the `postgres_backups` Docker volume.

### Restore from backup

1. List backup files:

	```bash
	docker compose run --rm postgres-backup ls -la /backups
	```

2. Restore a selected dump (replace `<backup-file.sql.gz>`):

	```bash
	docker compose run --rm postgres-backup sh -c "gunzip -c /backups/<backup-file.sql.gz> | psql -h postgres -U postgres -d postgres"
	```

If you are using production compose, replace `docker compose` with:

```bash
docker compose -f docker-compose.prod.yml
```

## 📡 Data Ingestion

### Option A: OwnTracks webhook (live)

Endpoint: `POST /api/owntracks?u=<username>&d=<deviceId>`

- Only `_type: "location"` events are stored.
- Required payload fields: `lat`, `lon`, `tst`.
- Duplicate points are skipped (idempotent by `tst` + `tid`).

### Option B: GPX import (manual)

1. Open a timeline date page (`/timeline/YYYY-MM-DD`).
2. Click **Import GPX** in the sidebar.
3. Select a `.gpx` file.

The app parses trackpoints/waypoints in-browser, posts them to `POST /api/import`, deduplicates by timestamp (`tst`), and inserts only new points.

## 🏙️ Places, Visits, and Unknown Visits

### Places

- Create places by clicking on the map and providing `name` and optional `radius` (default 50m).
- Places are global and visible across all date ranges.

### Visit suggestions (known places)

- The system groups nearby points into dwell sessions and creates `suggested` visits.
- Confirm/reject suggestions in the sidebar.
- Background detection runs on app load and then hourly.

### Unknown-visit suggestions

- The system clusters dwell sessions that are **not** within any known place radius.
- Suggestions can be confirmed/rejected.
- Background detection runs on app load and then hourly.

## 📷 Immich Integration (Optional)

Set both:

- `IMMICH_BASE_URL`
- `IMMICH_API_KEY`

When configured, photos in the selected time range can be displayed on the map and inside visit/suggestion contexts.

Relevant endpoints:

- `GET /api/immich?start=<ISO>&end=<ISO>`
- `GET /api/immich/thumbnail?id=<assetId>&size=thumbnail|preview`

## 🔗 Key Routes

### Pages

- `/timeline/[date]`

### API

- `GET /api/locations?date=YYYY-MM-DD`
- `POST /api/owntracks`
- `POST /api/import`
- `GET /api/places`
- `POST /api/places`
- `PUT /api/places/:id`
- `DELETE /api/places/:id`
- `GET /api/visits?status=suggested|confirmed|rejected&placeId=<id>&start=<ISO>&end=<ISO>`
- `PUT /api/visits/:id`
- `POST /api/visits/detect`
- `GET /api/unknown-visits?status=suggested|confirmed|rejected&start=<ISO>&end=<ISO>`
- `PUT /api/unknown-visits/:id`
- `POST /api/unknown-visits/detect`

## 🤖 MCP Server

OpenTimeline ships an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that lets AI agents interact with your timeline directly.

### Embedded in the web server (HTTP)

The MCP HTTP server starts automatically alongside the Next.js web server on port `3001` (Streamable HTTP transport, endpoint `/mcp`). No extra process needed.

Set `MCP_PORT` in `.env` to change the port, or set it to `0` to disable the embedded server:

```env
MCP_PORT=3001   # default; set to 0 to disable
```

Point an MCP client at `http://localhost:3001/mcp`.

### Standalone MCP server (stdio)

```bash
pnpm mcp
```

Communicates over stdio — use this for Claude Desktop / Claude Code config. The server reads `DATABASE_URL` (and optionally `IMMICH_BASE_URL` / `IMMICH_API_KEY`) from `.env`.

### Standalone MCP server (HTTP)

```bash
MCP_PORT=3001 pnpm mcp
# or
pnpm mcp --http
```

### Configuring Claude Desktop / Claude Code

**Option A — HTTP** (recommended when the web server is already running): use [`mcp-remote`](https://github.com/geelen/mcp-remote) to bridge the HTTP server to stdio:

```json
{
  "mcpServers": {
    "opentimeline": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3001/mcp"]
    }
  }
}
```

**Option B — stdio** (spawns a dedicated process, no web server required):

```json
{
  "mcpServers": {
    "opentimeline": {
      "command": "pnpm",
      "args": ["--prefix", "/absolute/path/to/opentimeline", "mcp"],
      "env": {}
    }
  }
}
```

Or with `tsx` directly:

```json
{
  "mcpServers": {
    "opentimeline": {
      "command": "node",
      "args": [
        "/absolute/path/to/opentimeline/node_modules/.bin/tsx",
        "--tsconfig", "/absolute/path/to/opentimeline/tsconfig.json",
        "/absolute/path/to/opentimeline/mcp/server.ts"
      ],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/opentimeline"
      }
    }
  }
}
```

### Available tools

| Tool | Description |
|------|-------------|
| `trigger_visit_detection` | Run visit detection for all known places (optional date range) |
| `trigger_unknown_visit_detection` | Detect dwell clusters at unknown locations (optional date range) |
| `get_pending_unknown_visits` | List unknown visit suggestions with coordinates and duration |
| `review_unknown_visit` | Get full details of a suggestion: coords, nearest places, Immich photos |
| `confirm_unknown_visit` | Mark a suggestion as confirmed or rejected |
| `create_place_from_unknown_visit` | Create a new named place from a suggestion and run visit detection |
| `get_current_location` | Get the most recent GPS point recorded |
| `get_location_history` | Get location points for a date or custom time range |
| `get_visits` | Get confirmed/suggested visits with place info for a time range |
| `get_places` | List all known places with coordinates and visit counts |

## 📜 Scripts

- `pnpm dev` – run development server
- `pnpm build` – production build
- `pnpm start` – run production server
- `pnpm lint` – run ESLint
- `pnpm mcp` – run the MCP server (stdio transport)

## ⚖️ Comparison: OpenTimeline vs Google Timeline vs Dawarich

| Feature | OpenTimeline | Google Maps Timeline | Dawarich |
|---|---|---|---|
| **Self-hosted** | Yes | No (Google cloud) | Yes |
| **Privacy** | Full — your data, your server | Google owns/processes your data | Full |
| **Data ingestion** | OwnTracks webhook, GPX import | Google apps, Android background location | OwnTracks, GPX, Google Takeout, Overland, Strava, Immich |
| **Map view** | Yes (Leaflet/OSM) | Yes (Google Maps) | Yes (Leaflet/OSM) |
| **Timeline granularity** | Day/week/month/year/custom/all | Day-based | Day/month/year |
| **Place management** | Manual create/edit/delete with radius | Automatic (Google AI) | Via Dawarich UI |
| **Visit detection** | Auto-detect from dwell clusters | Auto (Google AI + manual confirm) | Auto-detect |
| **Unknown visit suggestions** | Yes (dwell clusters outside known places) | Yes (Google suggests from POI database) | Yes |
| **Photo overlay** | Immich integration | Google Photos auto-overlay | Immich integration |
| **MCP / AI agent API** | Yes (built-in MCP server) | No | No |
| **Trips / routes** | Raw GPS tracks | Inferred trips with transport mode | Raw GPS tracks + stats |
| **Transport mode detection** | No | Yes (walk/drive/fly/transit) | No |
| **Reverse geocoding** | No (place names are manual) | Yes (automatic) | Yes (Photon/Nominatim) |
| **Stats & heatmaps** | Basic daily stats | Rich stats (distance, places visited) | Heatmaps, distance stats, country/city counts |
| **Export** | — | Google Takeout (JSON) | GPX, GeoJSON, CSV |
| **Mobile app** | Via OwnTracks (3rd party) | Native Google Maps app | Via OwnTracks/Overland (3rd party) |
| **Tech stack** | Next.js, PostgreSQL, Prisma | Proprietary | Ruby on Rails, PostgreSQL |

**Google Timeline** is the most polished — automatic transport detection, AI place inference, rich stats, photo overlay — but it's a cloud service with full Google data access.

**Dawarich** is the most feature-complete self-hosted alternative: reverse geocoding, heatmaps, country/city stats, multiple import sources. It's closer to a Google Takeout migration target.

### Why not Dawarich?

Dawarich is great for many use cases, but it didn't work well for my situation:

- **Inaccurate visit detection in dense cities** — In high-density urban areas common in Asia, places are packed close together. Automatic visit detection based on dwell clusters and proximity frequently misidentifies locations, making the visit history unreliable.
- **Reverse geocoding is unreliable in my country** — OpenStreetMap and Nominatim coverage is incomplete in many parts of Southeast Asia. Auto-assigned place names are often wrong or missing, so manually creating and naming places yields far more accurate results.
- **Slow to load** — Dawarich felt sluggish in practice, especially with a large dataset. OpenTimeline is leaner and loads faster.
- **Hard to review and manually create visits** — Dawarich's UI makes it cumbersome to review suggestions or manually create visits. For a workflow that relies on manual curation, this friction adds up quickly.

**OpenTimeline** is leaner and more developer-focused. Its standout differentiator is the built-in MCP server — AI agents can query your timeline directly. Best suited if you want a lightweight self-hosted tracker with OwnTracks, and don't need reverse geocoding, export, or rich stats.

## 📚 Project Docs

- [GPX Import](docs/gpx-import.md)
- [Places and Visits](docs/places-and-visits.md)
- [Immich Integration](docs/immich-integration.md)
