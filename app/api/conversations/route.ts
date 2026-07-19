import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { presenceFromDates } from "@/lib/presence";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);

    const now = new Date();
    const [messages, blocks] = await Promise.all([
      prisma.message.findMany({
        where: {
          OR: [{ senderId: currentUser.id }, { receiverId: currentUser.id }],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }]
        },
        include: {
          sender: {
            select: { id: true, username: true, lastActiveAt: true, onlineUntil: true }
          },
          receiver: {
            select: { id: true, username: true, lastActiveAt: true, onlineUntil: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 400
      }),
      prisma.block.findMany({
        where: {
          OR: [{ blockerId: currentUser.id }, { blockedId: currentUser.id }]
        },
        select: { blockerId: true, blockedId: true }
      })
    ]);

    const conversationMap = new Map<string, {
      user: { id: string; username: string; online: boolean; lastSeenAt: string };
      lastMessage: string;
      lastMessageAt: Date;
      unreadCount: number;
      sentByMe: boolean;
      blockedByMe: boolean;
      blockedMe: boolean;
    }>();

    for (const message of messages) {
      const sentByMe = message.senderId === currentUser.id;
      const otherUser = sentByMe ? message.receiver : message.sender;
      const existing = conversationMap.get(otherUser.id);

      if (!existing) {
        conversationMap.set(otherUser.id, {
          user: {
            id: otherUser.id,
            username: otherUser.username,
            ...presenceFromDates(otherUser.lastActiveAt, otherUser.onlineUntil)
          },
          lastMessage: message.body,
          lastMessageAt: message.createdAt,
          unreadCount: !sentByMe && !message.seenAt ? 1 : 0,
          sentByMe,
          blockedByMe: blocks.some((block: { blockerId: string; blockedId: string }) => block.blockerId === currentUser.id && block.blockedId === otherUser.id),
          blockedMe: blocks.some((block: { blockerId: string; blockedId: string }) => block.blockerId === otherUser.id && block.blockedId === currentUser.id)
        });
      } else if (!sentByMe && !message.seenAt) {
        existing.unreadCount += 1;
      }
    }

    return NextResponse.json({ conversations: Array.from(conversationMap.values()) });
  } catch (error) {
    return handleRouteError(error);
  }
}
