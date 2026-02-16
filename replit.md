# Personal Dash

## Overview
A personal dashboard built with Next.js 15, React 19, and SQLite. It integrates with Google Calendar to show upcoming events, manage projects, and track action items.

## Recent Changes
- 2026-02-16: Initial Replit setup — configured Next.js for Replit proxy (allowedDevOrigins, cache headers), set up dev workflow on port 5000.

## Project Architecture
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + PostCSS
- **Database**: SQLite (file-based, stored in `data/` directory)
- **External APIs**: Google Calendar (via googleapis)

### Key Directories
- `app/` — Next.js App Router pages and API routes
- `components/` — Reusable React components
- `lib/` — Shared utilities (database, auth, sync, etc.)
- `scripts/` — Database schema and initialization scripts

### Database
SQLite database at `data/personal-dash.sqlite`. Schema defined in `scripts/schema.sql`. Tables: user_config, oauth_tokens, calendars, calendar_sync_state, events, event_meta, projects, actions.

## User Preferences
- None recorded yet
