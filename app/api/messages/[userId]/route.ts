import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { directScopeKey, getBlockState } from "@/lib/chat";
import { handleRouteError, jsonError } from "@/lib/http";
import { presenceFromDates } from "@/lib/presence";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { messageSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);

    const { userId } = await context.params;
    if (userId === currentUser.id) return jsonError("You cannot message yourself", 400);

    const otherUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, lastActiveAt: true, onlineUntil: true }
    });
    if (!otherUser) return jsonError("User not found", 404);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await prisma.message.updateMany({
      where: {
        senderId: userId,
        receiverId: currentUser.id,
        seenAt: null
      },
      data: { seenAt: now, expiresAt }
    });

    const [messages, blockState, typing] = await Promise.all([
      prisma.message.findMany({
        where: {
          OR: [
            { senderId: currentUser.id, receiverId: userId },
            { senderId: userId, receiverId: currentUser.id }
          ],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }]
        },
        select: {
          id: true,
          body: true,
          senderId: true,
          receiverId: true,
          createdAt: true,
          seenAt: true,
          expiresAt: true,
          replyTo: {
            select: { id: true, body: true, senderId: true, expiresAt: true }
          }
        },
        orderBy: { createdAt: "asc" },
        take: 200
      }),
      getBlockState(currentUser.id, userId),
      prisma.typingStatus.findFirst({
        where: {
          scopeKey: directScopeKey(currentUser.id, userId),
          userId,
          expiresAt: { gt: now }
        },
        select: { id: true }
      })
    ]);

    return NextResponse.json({
      user: {
        id: otherUser.id,
        username: otherUser.username,
        ...presenceFromDates(otherUser.lastActiveAt, otherUser.onlineUntil)
      },
      messages: messages.map((message: any) => ({
        ...message,
        replyTo: message.replyTo && (!message.replyTo.expiresAt || message.replyTo.expiresAt > now)
          ? { id: message.replyTo.id, body: message.replyTo.body, senderId: message.replyTo.senderId }
          : null
      })),
      blockState,
      typing: Boolean(typing)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);

    const { userId } = await context.params;
    if (userId === currentUser.id) return jsonError("You cannot message yourself", 400);

    const otherUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true }
    });
    if (!otherUser) return jsonError("User not found", 404);

    const blockState = await getBlockState(currentUser.id, userId);
    if (blockState.blocked) {
      return jsonError("Messages are disabled because one of you blocked the other user", 403);
    }

    const input = messageSchema.parse(await request.json());

    let replyToId: string | null = null;
    if (input.replyToId) {
      const replyTarget = await prisma.message.findFirst({
        where: {
          id: input.replyToId,
          OR: [
            { senderId: currentUser.id, receiverId: userId },
            { senderId: userId, receiverId: currentUser.id }
          ],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }]
        },
        select: { id: true }
      });
      if (!replyTarget) return jsonError("The message you are replying to is no longer available", 404);
      replyToId = replyTarget.id;
    }

    const message = await prisma.message.create({
      data: {
        body: input.body,
        senderId: currentUser.id,
        receiverId: userId,
        replyToId
      },
      select: {
        id: true,
        body: true,
        senderId: true,
        receiverId: true,
        createdAt: true,
        seenAt: true,
        expiresAt: true,
        replyTo: {
          select: { id: true, body: true, senderId: true }
        }
      }
    });

    await sendPushToUser(userId, {
      title: "Blink",
      body: `@${currentUser.username} sent you a message`,
      url: `/chat?direct=${currentUser.id}`,
      tag: `direct-${currentUser.id}`
    });

    return NextResponse.json({ message }, { status: 201 });
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
    if (userId === currentUser.id) return jsonError("Invalid conversation", 400);

    const result = await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: currentUser.id, receiverId: userId },
          { senderId: userId, receiverId: currentUser.id }
        ]
      }
    });

    return NextResponse.json({ ok: true, deletedMessages: result.count });
  } catch (error) {
    return handleRouteError(error);
  }
}
