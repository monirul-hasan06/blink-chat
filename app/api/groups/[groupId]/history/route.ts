import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const { groupId } = await context.params;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: currentUser.id } },
      select: { role: true }
    });
    if (!membership) return jsonError("You are not a member of this group", 403);
    if (membership.role !== "OWNER") return jsonError("Only the group owner can clear group history", 403);

    const result = await prisma.groupMessage.deleteMany({ where: { groupId } });
    return NextResponse.json({ ok: true, deletedMessages: result.count });
  } catch (error) {
    return handleRouteError(error);
  }
}
