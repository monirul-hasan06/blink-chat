import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Unauthorized", 401);

  const { userId } = await context.params;
  if (userId === currentUser.id) return jsonError("You cannot message yourself", 400);

  const otherUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true }
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

  const messages = await prisma.message.findMany({
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
      expiresAt: true
    },
    orderBy: { createdAt: "asc" },
    take: 150
  });

  return NextResponse.json({ user: otherUser, messages });
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
      select: { id: true }
    });
    if (!otherUser) return jsonError("User not found", 404);

    const input = messageSchema.parse(await request.json());
    const message = await prisma.message.create({
      data: {
        body: input.body,
        senderId: currentUser.id,
        receiverId: userId
      },
      select: {
        id: true,
        body: true,
        senderId: true,
        receiverId: true,
        createdAt: true,
        seenAt: true,
        expiresAt: true
      }
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
