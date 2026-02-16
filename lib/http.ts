import { NextResponse } from "next/server";

export function ok(data: any, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...(init || {}) });
}

export function bad(status: number, message: string, extra?: any) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}

export function handleError(e: any) {
  const status = e?.status || e?.code || 500;
  const msg = typeof e?.message === "string" ? e.message : "Unknown error";
  return bad(status >= 400 && status < 600 ? status : 500, msg);
}
