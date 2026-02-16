import { google } from "googleapis";
import { getDb } from "@/lib/db";

export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly"
];

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI env vars");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  const db = await getDb();
  const row = await db.get<{ refresh_token: string | null }>("SELECT refresh_token FROM oauth_tokens WHERE id = 1");
  return row?.refresh_token ?? null;
}

export async function upsertTokens(opts: {
  refreshToken?: string | null;
  accessToken?: string | null;
  accessTokenExpiry?: string | null;
}) {
  const db = await getDb();
  const existing = await db.get("SELECT id FROM oauth_tokens WHERE id = 1");
  const now = new Date().toISOString();
  const refreshToken = opts.refreshToken ?? null;
  const accessToken = opts.accessToken ?? null;
  const accessTokenExpiry = opts.accessTokenExpiry ?? null;

  if (existing) {
    // Keep existing refresh token if not provided
    const current = await db.get<{ refresh_token: string | null }>("SELECT refresh_token FROM oauth_tokens WHERE id = 1");
    const finalRefresh = refreshToken || current?.refresh_token || null;
    await db.run(
      `UPDATE oauth_tokens SET refresh_token = ?, access_token = ?, access_token_expiry = ?, updated_at = ? WHERE id = 1`,
      finalRefresh,
      accessToken,
      accessTokenExpiry,
      now
    );
  } else {
    await db.run(
      `INSERT INTO oauth_tokens (id, refresh_token, access_token, access_token_expiry, updated_at)
       VALUES (1, ?, ?, ?, ?)`,
      refreshToken,
      accessToken,
      accessTokenExpiry,
      now
    );
  }
}

export async function getCalendarClient() {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) throw new Error("Not connected to Google");
  const oauth2 = getOAuthClient();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2 });
}
