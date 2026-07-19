import { NextResponse } from "next/server";
import { clearSession, setCurrentUserOffline } from "@/lib/auth";

export async function POST() {
  await setCurrentUserOffline();
  await clearSession();
  return NextResponse.json({ ok: true });
}
