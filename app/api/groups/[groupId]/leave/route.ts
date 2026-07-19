import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { markGroupMessagesSeen } from "@/lib/chat";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const { groupId } = await context.params;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: currentUser.id } },
      select: { id: true, role: true }
    });
    if (!membership) return jsonError("You are not a member of this group", 404);

    await markGroupMessagesSeen(groupId, currentUser.id);

    if (membership.role === "OWNER") {
      const nextOwner = await prisma.groupMember.findFirst({
        where: { groupId, userId: { not: currentUser.id } },
        orderBy: { joinedAt: "asc" },
        select: { id: true, userId: true }
      });

      if (!nextOwner) {
        await prisma.group.delete({ where: { id: groupId } });
        return NextResponse.json({ ok: true, groupDeleted: true });
      }

      await prisma.$transaction([
        prisma.groupMember.update({ where: { id: nextOwner.id }, data: { role: "OWNER" } }),
        prisma.group.update({ where: { id: groupId }, data: { createdById: nextOwner.userId } }),
        prisma.groupMember.delete({ where: { id: membership.id } })
      ]);
    } else {
      await prisma.groupMember.delete({ where: { id: membership.id } });
    }

    return NextResponse.json({ ok: true, groupDeleted: false });
  } catch (error) {
    return handleRouteError(error);
  }
}
