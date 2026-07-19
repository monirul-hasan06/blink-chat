import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { presenceFromDates } from "@/lib/presence";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);

    const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
    if (query.length < 2) return NextResponse.json({ users: [] });

    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUser.id },
        username: { contains: query, mode: "insensitive" }
      },
      select: { id: true, username: true, lastActiveAt: true, onlineUntil: true },
      orderBy: { username: "asc" },
      take: 16
    });

    return NextResponse.json({
      users: users.map((user: any) => ({
        id: user.id,
        username: user.username,
        ...presenceFromDates(user.lastActiveAt, user.onlineUntil)
      }))
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
