import { NextResponse } from "next/server";
import { clearSession, setCurrentUserOffline } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";

export async function POST() {
  try {
    await setCurrentUserOffline();
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
