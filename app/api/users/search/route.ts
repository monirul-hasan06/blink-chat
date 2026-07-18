import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: currentUser.id },
      username: { contains: query, mode: "insensitive" }
    },
    select: { id: true, username: true },
    orderBy: { username: "asc" },
    take: 12
  });

  return NextResponse.json({ users });
}
