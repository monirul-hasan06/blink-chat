import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
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

  const [expiredMessages, inactiveUsers] = await prisma.$transaction([
    prisma.message.deleteMany({
      where: { expiresAt: { lte: now } }
    }),
    prisma.user.deleteMany({
      where: { lastActiveAt: { lte: oneYearAgo } }
    })
  ]);

  return NextResponse.json({
    deletedMessages: expiredMessages.count,
    deletedUsers: inactiveUsers.count,
    ranAt: now.toISOString()
  });
}
