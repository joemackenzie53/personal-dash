# Personal Dash

## Overview
A personal dashboard built with Next.js 15, React 19, and PostgreSQL. It integrates with Google Calendar to show upcoming events, manage projects, and track action items.

## Recent Changes
- 2026-02-17: Event category auto-classification rules are now database-driven. Categories table has a `pattern` column for regex keyword matching. The classify function (lib/classify.ts) loads rules from the database instead of hardcoded list. Settings page shows and allows editing of auto-match patterns per category. Deleting a category removes its auto-match rule.
- 2026-02-17: Added "Actions needing triage" section to the Triage page — shows actions without a due date for quick assignment.
- 2026-02-17: Due dates now shown on action rows in EventDetailModal and Projects page.
- 2026-02-17: Event categories are now customizable via Settings page with full CRUD. EventDetailModal fetches categories dynamically from the API.
- 2026-02-17: Added dedicated Actions page showing all actions grouped by status (overdue, due soon, upcoming, unscheduled, completed).
- 2026-02-17: Actions can now be linked to events and projects. EventDetailModal has an actions section for inline add/toggle. Projects page has expandable per-project action lists. Now page Quick Add has a parent picker dropdown to link new actions to a project or upcoming event.
- 2026-02-17: Added recurring event support — events table has recurring_event_id column, sync captures it from Google Calendar, triage propagates classification to all instances in a series. Recurring events show a repeat icon in all views and an info banner in the modal.
- 2026-02-17: Created test data seed script (scripts/seed-test-events.ts) with --clean flag. Test events use `test-seed-` prefix for safe cleanup.
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
PostgreSQL database accessed via DATABASE_URL environment variable. Schema defined in `scripts/schema.sql` and auto-initialized on first connection via `lib/db.ts`. Tables: user_config, oauth_tokens, calendars, calendar_sync_state, events, event_meta, projects, actions, categories. Categories have a `pattern` column for auto-classification regex rules used during sync.

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `GOOGLE_REDIRECT_URI` — Google OAuth redirect URI (differs between dev and prod)
- `APP_PASSWORD` — Optional password to protect the dashboard
- `SESSION_SECRET` — Secret for signing session cookies (required if APP_PASSWORD is set)

## User Preferences
- None recorded yet
