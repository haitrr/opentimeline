# OpenTimeline

OpenTimeline is a self-hosted location timeline built with Next.js and PostgreSQL.
It ingests location points (OwnTracks webhook or GPX import), renders them on a map, and helps you turn dwell periods into meaningful places and visit history.

## Features

- Timeline views by day/week/month/year/custom/all.
- Interactive map with location points and daily stats.
- OwnTracks webhook ingestion (`POST /api/owntracks`).
- GPX file import from the timeline UI.
- Place management (create, update radius/name, delete).
- Automatic visit suggestion detection for known places.
- Automatic unknown-visit suggestion detection for dwell clusters outside known places.
- Optional Immich photo overlay for selected date/time ranges.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- PostgreSQL + Prisma ORM
- Tailwind CSS 4
- Leaflet / react-leaflet

## Requirements

- Node.js 20+
- pnpm
- PostgreSQL 14+

## Quick Start

### 1) Install dependencies

```bash
pnpm install
```

### 2) Start PostgreSQL (optional helper)

If you want to run Postgres via Docker:

```bash
docker compose up -d postgres
```

This exposes Postgres on `localhost:54324` with user `postgres` and password `postgres`.

### 3) Create `.env`

Create `.env` in the project root with:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:54324/postgres?schema=public"

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

## Database Backups

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

## Data Ingestion

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

## Places, Visits, and Unknown Visits

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

## Immich Integration (Optional)

Set both:

- `IMMICH_BASE_URL`
- `IMMICH_API_KEY`

When configured, photos in the selected time range can be displayed on the map and inside visit/suggestion contexts.

Relevant endpoints:

- `GET /api/immich?start=<ISO>&end=<ISO>`
- `GET /api/immich/thumbnail?id=<assetId>&size=thumbnail|preview`

## Key Routes

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

## Scripts

- `pnpm dev` – run development server
- `pnpm build` – production build
- `pnpm start` – run production server
- `pnpm lint` – run ESLint

## Project Docs

- [GPX Import](docs/gpx-import.md)
- [Places and Visits](docs/places-and-visits.md)
- [Immich Integration](docs/immich-integration.md)
