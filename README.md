# Let's Hang — friend hangout scheduler

Find a day when everyone's free. Someone creates a board, shares the link, each friend types
their name and clicks the days they can make it, and the board instantly shows every day the
whole group is free — then anyone can lock the date.

- Per-event boards (`/e/<code>`), link + join-code access, **no accounts**
- Whole-day availability (no time-of-day grid), range up to 60 days
- Group results: green = everyone, amber = some, ranked "Best days", lock a date with a banner
- Identity lives in the browser's localStorage — join again by typing the same name
- Next.js 16 App Router + Tailwind v4 + better-sqlite3 (raw SQL, schema auto-created)

## Repository layout

```
app/api/events/...       REST-ish JSON API (create, read, join, slots, pick)
app/e/[code]/            Board: calendar + results tabs
app/page.tsx             Home: create + join
lib/db.ts                better-sqlite3 singleton, auto-migrating schema
lib/dates.ts             Pure local-time date helpers (no npm date deps)
Dockerfile               Multi-stage build for Coolify / docker
```

## Local dev & run

```bash
npm run dev        # dev server
npm run build && npx next start -p 2180
```

SQLite database: `DB_PATH` env or default `./data/app.db` (auto-created). Server host deploys via
`systemctl restart hangout-scheduler` (unit on 10.1.1.35, port 2180). DB lives at
`/opt/apps/hangout-scheduler/data/app.db`.

## Deploy to Coolify

1. Push/link this repo, create resource from the **Dockerfile**.
2. Coolify fills the port automatically (`EXPOSE 3000`). Public domain: set an FQDN in the
   resource config — Coolify proxies HTTPS for you.
3. **Persistent storage**: add a volume mount at `/app/data` (the SQLite DB lives there —
   without it the DB resets on every deploy).
4. Deploy. That's it — no env vars or databases to configure.

Manual docker equivalent:

```bash
docker compose up -d --build
```