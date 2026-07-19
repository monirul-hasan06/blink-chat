import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { directScopeKey, getBlockState, groupScopeKey } from "@/lib/chat";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { typingSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const input = typingSchema.parse(await request.json());

    let scopeKey: string;
    if (input.scopeType === "direct") {
      if (input.targetId === currentUser.id) return jsonError("Invalid target", 400);
      const user = await prisma.user.findUnique({ where: { id: input.targetId }, select: { id: true } });
      if (!user) return jsonError("User not found", 404);
      const blockState = await getBlockState(currentUser.id, input.targetId);
      if (blockState.blocked) return jsonError("Messaging is blocked", 403);
      scopeKey = directScopeKey(currentUser.id, input.targetId);
    } else {
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: input.targetId, userId: currentUser.id } },
        select: { id: true }
      });
      if (!member) return jsonError("You are not a member of this group", 403);
      scopeKey = groupScopeKey(input.targetId);
    }

    if (!input.isTyping) {
      await prisma.typingStatus.deleteMany({ where: { scopeKey, userId: currentUser.id } });
      return NextResponse.json({ ok: true });
    }

    await prisma.typingStatus.upsert({
      where: { scopeKey_userId: { scopeKey, userId: currentUser.id } },
      create: {
        scopeKey,
        userId: currentUser.id,
        expiresAt: new Date(Date.now() + 6_000)
      },
      update: { expiresAt: new Date(Date.now() + 6_000) }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
