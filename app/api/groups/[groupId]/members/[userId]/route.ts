import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { groupScopeKey, scheduleFullySeenGroupMessagesForExpiry } from "@/lib/chat";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ groupId: string; userId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const { groupId, userId } = await context.params;

    const ownerMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: currentUser.id } },
      select: { role: true }
    });
    if (!ownerMembership) return jsonError("You are not a member of this group", 403);
    if (ownerMembership.role !== "OWNER") return jsonError("Only the group owner can remove members", 403);
    if (userId === currentUser.id) return jsonError("The owner cannot remove themselves. Transfer ownership by leaving, or delete the group.", 400);

    const targetMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true, role: true, user: { select: { username: true } } }
    });
    if (!targetMembership) return jsonError("Member not found", 404);
    if (targetMembership.role === "OWNER") return jsonError("The group owner cannot be removed", 400);

    await prisma.$transaction([
      prisma.groupMessageReceipt.deleteMany({
        where: { userId, message: { groupId } }
      }),
      prisma.typingStatus.deleteMany({
        where: { userId, scopeKey: groupScopeKey(groupId) }
      }),
      prisma.groupInvite.deleteMany({
        where: { groupId, inviteeId: userId }
      }),
      prisma.groupMember.delete({ where: { id: targetMembership.id } })
    ]);

    await scheduleFullySeenGroupMessagesForExpiry(groupId);
    const memberCount = await prisma.groupMember.count({ where: { groupId } });

    return NextResponse.json({
      ok: true,
      removedUser: { id: userId, username: targetMembership.user.username },
      memberCount
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
