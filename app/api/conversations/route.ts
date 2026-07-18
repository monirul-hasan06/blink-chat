import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ senderId: currentUser.id }, { receiverId: currentUser.id }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }]
    },
    include: {
      sender: { select: { id: true, username: true } },
      receiver: { select: { id: true, username: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 300
  });

  const conversationMap = new Map<
    string,
    {
      user: { id: string; username: string };
      lastMessage: string;
      lastMessageAt: Date;
      unreadCount: number;
      sentByMe: boolean;
    }
  >();

  for (const message of messages) {
    const sentByMe = message.senderId === currentUser.id;
    const otherUser = sentByMe ? message.receiver : message.sender;
    const existing = conversationMap.get(otherUser.id);

    if (!existing) {
      conversationMap.set(otherUser.id, {
        user: otherUser,
        lastMessage: message.body,
        lastMessageAt: message.createdAt,
        unreadCount: !sentByMe && !message.seenAt ? 1 : 0,
        sentByMe
      });
    } else if (!sentByMe && !message.seenAt) {
      existing.unreadCount += 1;
    }
  }

  return NextResponse.json({ conversations: Array.from(conversationMap.values()) });
}
