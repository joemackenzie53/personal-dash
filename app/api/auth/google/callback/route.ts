import { NextResponse } from "next/server";
import { getOAuthClient, upsertTokens } from "@/lib/google";
import { clearOAuthState, readOAuthState, setSessionCookie } from "@/lib/session";
import { ensureCalendarsFromGoogle } from "@/lib/sync";

function getOrigin(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = getOrigin(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?oauth=error&reason=${encodeURIComponent(error)}`, origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/settings?oauth=error&reason=missing_code`, origin));
  }

  const expectedState = await readOAuthState();
  if (!expectedState || !state || state !== expectedState) {
    return NextResponse.redirect(new URL(`/settings?oauth=error&reason=bad_state`, origin));
  }

  const oauth2 = getOAuthClient();
  const tokenRes = await oauth2.getToken(code);
  const tokens = tokenRes.tokens;

  await upsertTokens({
    refreshToken: tokens.refresh_token || null,
    accessToken: tokens.access_token || null,
    accessTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
  });

  await clearOAuthState();
  await setSessionCookie();

  await ensureCalendarsFromGoogle();

  return NextResponse.redirect(new URL("/settings?oauth=ok", origin));
}
