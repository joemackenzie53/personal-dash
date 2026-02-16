import { NextResponse } from "next/server";
import crypto from "crypto";
import { getOAuthClient, SCOPES } from "@/lib/google";
import { setOAuthState } from "@/lib/session";

export async function GET() {
  const oauth2 = getOAuthClient();
  const state = crypto.randomBytes(16).toString("hex");
  setOAuthState(state);

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state
  });

  return NextResponse.redirect(url);
}
