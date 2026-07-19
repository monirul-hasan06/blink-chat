import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);

    const { userId } = await context.params;
    if (userId === currentUser.id) return jsonError("Invalid conversation", 400);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const result = await prisma.message.updateMany({
      where: {
        senderId: userId,
        receiverId: currentUser.id,
        seenAt: null
      },
      data: { seenAt: now, expiresAt }
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    return handleRouteError(error);
  }
}
