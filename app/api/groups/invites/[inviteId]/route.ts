import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { inviteResponseSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ inviteId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const { inviteId } = await context.params;
    const input = inviteResponseSchema.parse(await request.json());

    const invite = await prisma.groupInvite.findFirst({
      where: { id: inviteId, inviteeId: currentUser.id, status: "PENDING" },
      select: { id: true, groupId: true }
    });
    if (!invite) return jsonError("Invitation not found", 404);

    if (input.action === "decline") {
      await prisma.groupInvite.update({
        where: { id: invite.id },
        data: { status: "DECLINED", respondedAt: new Date() }
      });
      return NextResponse.json({ ok: true, joined: false });
    }

    await prisma.$transaction([
      prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: invite.groupId, userId: currentUser.id } },
        create: { groupId: invite.groupId, userId: currentUser.id, role: "MEMBER" },
        update: {}
      }),
      prisma.groupInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", respondedAt: new Date() }
      })
    ]);

    return NextResponse.json({ ok: true, joined: true, groupId: invite.groupId });
  } catch (error) {
    return handleRouteError(error);
  }
}
