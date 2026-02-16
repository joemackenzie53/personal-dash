import { NextResponse } from "next/server";
import { getOAuthClient, upsertTokens } from "@/lib/google";
import { clearOAuthState, readOAuthState, setSessionCookie } from "@/lib/session";
import { ensureCalendarsFromGoogle } from "@/lib/sync";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?oauth=error&reason=${encodeURIComponent(error)}`, url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/settings?oauth=error&reason=missing_code`, url.origin));
  }

  const expectedState = readOAuthState();
  if (!expectedState || !state || state !== expectedState) {
    return NextResponse.redirect(new URL(`/settings?oauth=error&reason=bad_state`, url.origin));
  }

  const oauth2 = getOAuthClient();
  const tokenRes = await oauth2.getToken(code);
  const tokens = tokenRes.tokens;

  await upsertTokens({
    refreshToken: tokens.refresh_token || null,
    accessToken: tokens.access_token || null,
    accessTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
  });

  clearOAuthState();
  setSessionCookie();

  // Discover calendars + default selection
  await ensureCalendarsFromGoogle();

  return NextResponse.redirect(new URL("/settings?oauth=ok", url.origin));
}
