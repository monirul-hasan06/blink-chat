import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { authSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = authSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { username: input.username }
    });

    if (!user || !(await compare(input.pin, user.pinHash))) {
      return jsonError("Incorrect username or PIN", 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() }
    });

    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, username: user.username } });
  } catch (error) {
    return handleRouteError(error);
  }
}
