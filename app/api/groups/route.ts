import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { groupSchema } from "@/lib/validation";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);

    const now = new Date();
    const memberships = await prisma.groupMember.findMany({
      where: { userId: currentUser.id },
      include: {
        group: {
          include: {
            members: { select: { id: true } },
            messages: {
              where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { sender: { select: { username: true } } }
            }
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    });

    const groups = await Promise.all(memberships.map(async (membership: any) => {
      const unreadCount = await prisma.groupMessageReceipt.count({
        where: {
          userId: currentUser.id,
          seenAt: null,
          message: {
            groupId: membership.groupId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
          }
        }
      });
      const last = membership.group.messages[0];
      return {
        id: membership.group.id,
        name: membership.group.name,
        role: membership.role,
        memberCount: membership.group.members.length,
        unreadCount,
        lastMessage: last?.body ?? "No messages yet",
        lastMessageAt: last?.createdAt ?? membership.group.createdAt,
        lastSender: last?.sender.username ?? null
      };
    }));

    groups.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    const invites = await prisma.groupInvite.findMany({
      where: { inviteeId: currentUser.id, status: "PENDING" },
      include: {
        group: { select: { id: true, name: true } },
        inviter: { select: { username: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      groups,
      invites: invites.map((invite: any) => ({
        id: invite.id,
        group: invite.group,
        inviterUsername: invite.inviter.username,
        createdAt: invite.createdAt
      }))
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const input = groupSchema.parse(await request.json());

    const group = await prisma.group.create({
      data: {
        name: input.name,
        createdById: currentUser.id,
        members: {
          create: { userId: currentUser.id, role: "OWNER" }
        }
      },
      select: { id: true, name: true, createdAt: true }
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
