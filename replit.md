# Personal Dash

## Overview
A personal dashboard built with Next.js 15, React 19, and PostgreSQL. It integrates with Google Calendar to show upcoming events, manage projects, and track action items.

## Recent Changes
- 2026-02-16: Migrated database from SQLite to PostgreSQL (Replit built-in). Removed sqlite3/sqlite packages, added pg. Updated all API routes and lib files for PostgreSQL syntax.
- 2026-02-16: Initial Replit setup — configured Next.js for Replit proxy (allowedDevOrigins, cache headers), set up dev workflow on port 5000.

## Project Architecture
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + PostCSS
- **Database**: PostgreSQL (Replit built-in, via DATABASE_URL)
- **External APIs**: Google Calendar (via googleapis)

### Key Directories
- `app/` — Next.js App Router pages and API routes
- `components/` — Reusable React components
- `lib/` — Shared utilities (database, auth, sync, etc.)
- `scripts/` — Database schema and initialization scripts

### Database
PostgreSQL database accessed via DATABASE_URL environment variable. Schema defined in `scripts/schema.sql` and auto-initialized on first connection via `lib/db.ts`. Tables: user_config, oauth_tokens, calendars, calendar_sync_state, events, event_meta, projects, actions.

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `GOOGLE_REDIRECT_URI` — Google OAuth redirect URI (differs between dev and prod)
- `APP_PASSWORD` — Optional password to protect the dashboard
- `SESSION_SECRET` — Secret for signing session cookies (required if APP_PASSWORD is set)

## User Preferences
- None recorded yet
