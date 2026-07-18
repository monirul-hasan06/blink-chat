import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { authSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = authSchema.parse(await request.json());
    const pinHash = await hash(input.pin, 12);

    const user = await prisma.user.create({
      data: {
        username: input.username,
        pinHash
      },
      select: { id: true, username: true }
    });

    await createSession(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return jsonError("That username is already taken", 409);
    }
    return handleRouteError(error);
  }
}
