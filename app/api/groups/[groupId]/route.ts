import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { groupScopeKey, markGroupMessagesSeen } from "@/lib/chat";
import { handleRouteError, jsonError } from "@/lib/http";
import { presenceFromDates } from "@/lib/presence";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { messageSchema } from "@/lib/validation";

async function requireMember(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true }
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const { groupId } = await context.params;
    const membership = await requireMember(groupId, currentUser.id);
    if (!membership) return jsonError("You are not a member of this group", 403);

    await markGroupMessagesSeen(groupId, currentUser.id);
    const now = new Date();

    const [group, typingStatuses] = await Promise.all([
      prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, lastActiveAt: true, onlineUntil: true }
              }
            },
            orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
          },
          messages: {
            where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            include: {
              sender: { select: { id: true, username: true } },
              receipts: { select: { seenAt: true } },
              replyTo: {
                select: {
                  id: true,
                  body: true,
                  senderId: true,
                  expiresAt: true,
                  sender: { select: { username: true } }
                }
              }
            },
            orderBy: { createdAt: "asc" },
            take: 250
          }
        }
      }),
      prisma.typingStatus.findMany({
        where: {
          scopeKey: groupScopeKey(groupId),
          userId: { not: currentUser.id },
          expiresAt: { gt: now }
        },
        include: { user: { select: { username: true } } }
      })
    ]);

    if (!group) return jsonError("Group not found", 404);

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        role: membership.role,
        members: group.members.map((member: any) => ({
          id: member.user.id,
          username: member.user.username,
          role: member.role,
          ...presenceFromDates(member.user.lastActiveAt, member.user.onlineUntil)
        }))
      },
      messages: group.messages.map((message: any) => ({
        id: message.id,
        body: message.body,
        senderId: message.senderId,
        senderUsername: message.sender.username,
        createdAt: message.createdAt,
        expiresAt: message.expiresAt,
        seenByAll: message.receipts.every((receipt: any) => receipt.seenAt !== null),
        replyTo: message.replyTo && (!message.replyTo.expiresAt || message.replyTo.expiresAt > now) ? {
          id: message.replyTo.id,
          body: message.replyTo.body,
          senderId: message.replyTo.senderId,
          senderUsername: message.replyTo.sender.username
        } : null
      })),
      typingUsers: typingStatuses.map((status: any) => status.user.username)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const { groupId } = await context.params;
    const membership = await requireMember(groupId, currentUser.id);
    if (!membership) return jsonError("You are not a member of this group", 403);

    const input = messageSchema.parse(await request.json());

    let replyToId: string | null = null;
    if (input.replyToId) {
      const replyTarget = await prisma.groupMessage.findFirst({
        where: {
          id: input.replyToId,
          groupId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        select: { id: true }
      });
      if (!replyTarget) return jsonError("The message you are replying to is no longer available", 404);
      replyToId = replyTarget.id;
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true }
    });
    const receiverIds = members.map((member: any) => member.userId).filter((id: string) => id !== currentUser.id);
    const expiresAt = receiverIds.length === 0
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : null;

    const message = await prisma.groupMessage.create({
      data: {
        body: input.body,
        senderId: currentUser.id,
        groupId,
        expiresAt,
        replyToId,
        receipts: {
          create: receiverIds.map((userId: string) => ({ userId }))
        }
      },
      include: {
        sender: { select: { username: true } },
        replyTo: {
          select: {
            id: true,
            body: true,
            senderId: true,
            sender: { select: { username: true } }
          }
        }
      }
    });

    const group = await prisma.group.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
      select: { name: true }
    });

    await Promise.all(receiverIds.map((userId: string) => sendPushToUser(userId, {
      title: `Blink · ${group.name}`,
      body: `@${currentUser.username} sent a group message`,
      url: `/chat?group=${groupId}`,
      tag: `group-${groupId}`
    })));

    return NextResponse.json({
      message: {
        id: message.id,
        body: message.body,
        senderId: message.senderId,
        senderUsername: message.sender.username,
        createdAt: message.createdAt,
        expiresAt: message.expiresAt,
        seenByAll: receiverIds.length === 0,
        replyTo: message.replyTo ? {
          id: message.replyTo.id,
          body: message.replyTo.body,
          senderId: message.replyTo.senderId,
          senderUsername: message.replyTo.sender.username
        } : null
      }
    }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

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
    if (membership.role !== "OWNER") return jsonError("Only the group owner can delete the group", 403);

    await prisma.group.delete({ where: { id: groupId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
