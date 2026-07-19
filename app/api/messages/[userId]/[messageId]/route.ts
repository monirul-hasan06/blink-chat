import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string; messageId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);

    const { userId, messageId } = await context.params;
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: currentUser.id,
        receiverId: userId
      },
      select: { id: true }
    });

    if (!message) return jsonError("You can only delete a message you sent in this chat", 404);

    await prisma.message.delete({ where: { id: message.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
