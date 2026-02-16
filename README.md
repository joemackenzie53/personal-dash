# Personal Dash

A lightweight, calendar-driven personal admin dashboard.

- **Now**: action queue + next 14 days of events
- **Horizon**: grouped-by-month horizon view
- **Triage**: classify “unknown” events so they show up correctly
- **Projects**: a small index of projects and Drive links
- **Settings**: connect Google, choose calendars, run sync

This is designed for **personal use** (single user).

---

## 1) Setup (local)

1. Install deps:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Initialize DB (optional; app auto-inits on first run):

```bash
npm run db:init
```

4. Run:

```bash
npm run dev
```

App runs on `http://localhost:3000`.

---

## 2) Google OAuth setup

In **Google Cloud Console**:

1. Create an **OAuth consent screen** (External is fine for personal use).
2. Create **OAuth client ID** (Web application).
3. Add **Authorized redirect URI**:

- Local: `http://localhost:3000/api/auth/google/callback`
- Replit: `https://<your-replit-domain>/api/auth/google/callback`
- Vercel: `https://<your-domain>/api/auth/google/callback`

Then set:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (must match the redirect URI exactly)

Scopes used:

- `calendar.readonly`
- `calendar.calendarlist.readonly`

---

## 3) Notes on sync

- The app stores a **per-calendar sync token** and uses it for incremental sync.
- It keeps a stable rolling window (default: **-30 days → +horizon days**) and periodically rolls the window to keep it fresh.
- If Google returns `410 Gone` for a sync token, the app automatically falls back to a full sync.

---


### Optional app password

If you set `APP_PASSWORD`, the app will require you to log in at `/login` (recommended if you deploy on a public URL).

## 4) Deploy notes

This repo is a standard Next.js App Router project and works on common hosts:

- Replit
- Vercel
- Any Node host

Make sure the environment variables are set on the host (see `.env.example`).

---

## Security disclaimer

This is intended for a private, single-user setup.

If you deploy publicly, add real authentication, CSRF protection, and encrypt stored tokens.
