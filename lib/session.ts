import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pd_session";
const STATE_COOKIE = "pd_oauth_state";

type SessionPayload = {
  v: 1;
  iat: number; // unix seconds
};

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlToBuf(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function hmac(data: string, secret: string) {
  return b64url(crypto.createHmac("sha256", secret).update(data).digest());
}

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

export function authIsRequired() {
  return !!process.env.APP_PASSWORD;
}

export function setSessionCookie() {
  const payload: SessionPayload = { v: 1, iat: Math.floor(Date.now() / 1000) };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = hmac(body, getSecret());
  cookies().set(COOKIE_NAME, `${body}.${sig}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export function isAuthed(): boolean {
  if (!authIsRequired()) return true;

  const c = cookies().get(COOKIE_NAME)?.value;
  if (!c) return false;
  const [body, sig] = c.split(".");
  if (!body || !sig) return false;
  const expected = hmac(body, getSecret());
  // constant-time compare
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const json = JSON.parse(b64urlToBuf(body).toString("utf-8")) as SessionPayload;
    if (json.v !== 1) return false;
    return true;
  } catch {
    return false;
  }
}

export function requireAuth() {
  if (!isAuthed()) {
    const err = new Error("Unauthorized");
    // @ts-expect-error attach status
    err.status = 401;
    throw err;
  }
}

export function setOAuthState(state: string) {
  cookies().set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  });
}

export function readOAuthState(): string | null {
  return cookies().get(STATE_COOKIE)?.value ?? null;
}

export function clearOAuthState() {
  cookies().set(STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
