import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { inviteSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const { groupId } = await context.params;
    const input = inviteSchema.parse(await request.json());
    if (input.userId === currentUser.id) return jsonError("You are already in this group", 400);

    const [membership, group, invitee, existingMember] = await Promise.all([
      prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: currentUser.id } } }),
      prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } }),
      prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: input.userId } } })
    ]);

    if (!membership) return jsonError("You are not a member of this group", 403);
    if (!group) return jsonError("Group not found", 404);
    if (!invitee) return jsonError("User not found", 404);
    if (existingMember) return jsonError("That user is already in the group", 409);

    const invite = await prisma.groupInvite.upsert({
      where: { groupId_inviteeId: { groupId, inviteeId: input.userId } },
      create: {
        groupId,
        inviterId: currentUser.id,
        inviteeId: input.userId,
        status: "PENDING"
      },
      update: {
        inviterId: currentUser.id,
        status: "PENDING",
        respondedAt: null,
        createdAt: new Date()
      },
      select: { id: true }
    });

    await sendPushToUser(input.userId, {
      title: "Blink group invitation",
      body: `@${currentUser.username} invited you to ${group.name}`,
      url: "/chat?tab=invites",
      tag: `invite-${invite.id}`
    });

    return NextResponse.json({ ok: true, inviteId: invite.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
