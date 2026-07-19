import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ groupId: string; messageId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);

    const { groupId, messageId } = await context.params;
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: currentUser.id } },
      select: { id: true }
    });
    if (!membership) return jsonError("You are not a member of this group", 403);

    const message = await prisma.groupMessage.findFirst({
      where: { id: messageId, groupId, senderId: currentUser.id },
      select: { id: true }
    });
    if (!message) return jsonError("You can only delete a group message you sent", 404);

    await prisma.groupMessage.delete({ where: { id: message.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
