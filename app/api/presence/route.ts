import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { onlineUntilFromNow } from "@/lib/presence";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: now, onlineUntil: onlineUntilFromNow(now) }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: now, onlineUntil: now }
  });
  return NextResponse.json({ ok: true });
}
