import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { directScopeKey } from "@/lib/chat";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);

    const { userId } = await context.params;
    if (userId === currentUser.id) return jsonError("You cannot block yourself", 400);

    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) return jsonError("User not found", 404);

    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: currentUser.id, blockedId: userId } },
      create: { blockerId: currentUser.id, blockedId: userId },
      update: {}
    });

    await prisma.typingStatus.deleteMany({
      where: { scopeKey: directScopeKey(currentUser.id, userId), userId: { in: [currentUser.id, userId] } }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const { userId } = await context.params;

    await prisma.block.deleteMany({
      where: { blockerId: currentUser.id, blockedId: userId }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
