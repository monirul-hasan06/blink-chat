import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";

export async function POST() {
  try {
    const userId = await refreshSession();
    if (!userId) return jsonError("Unauthorized", 401);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
