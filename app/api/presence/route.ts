import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { onlineUntilFromNow } from "@/lib/presence";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: now, onlineUntil: onlineUntilFromNow(now) }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: now, onlineUntil: now }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
