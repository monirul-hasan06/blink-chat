import { NextResponse } from "next/server";
import { deleteUserAndTransferGroups } from "@/lib/account";
import { handleRouteError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
    }
    if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const [expiredDirectMessages, expiredGroupMessages, expiredTyping, inactiveUsers] = await Promise.all([
      prisma.message.deleteMany({ where: { expiresAt: { lte: now } } }),
      prisma.groupMessage.deleteMany({ where: { expiresAt: { lte: now } } }),
      prisma.typingStatus.deleteMany({ where: { expiresAt: { lte: now } } }),
      prisma.user.findMany({
        where: { lastActiveAt: { lte: oneYearAgo } },
        select: { id: true }
      })
    ]);

    let deletedUsers = 0;
    for (const user of inactiveUsers) {
      await deleteUserAndTransferGroups(user.id);
      deletedUsers += 1;
    }

    return NextResponse.json({
      deletedDirectMessages: expiredDirectMessages.count,
      deletedGroupMessages: expiredGroupMessages.count,
      deletedTypingStatuses: expiredTyping.count,
      deletedUsers,
      ranAt: now.toISOString()
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
