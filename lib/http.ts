import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError(error.issues[0]?.message ?? "Invalid request", 400);
  }

  if (error instanceof SyntaxError) {
    return jsonError("The request body is not valid JSON", 400);
  }

  console.error(error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return jsonError(
        "The database tables have not been created. Apply the Prisma migration and redeploy.",
        503
      );
    }

    if (error.code === "P2025") {
      return jsonError("The requested item no longer exists", 404);
    }

    if (error.code === "P2003") {
      return jsonError("That action conflicts with related data", 409);
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return jsonError(
      "The server could not connect to the database. Check DATABASE_URL and DIRECT_URL in Vercel.",
      503
    );
  }

  if (error instanceof Error && error.message.includes("AUTH_SECRET")) {
    return jsonError(
      "Server authentication is not configured. Add AUTH_SECRET in Vercel and redeploy.",
      503
    );
  }

  return jsonError("Something went wrong", 500);
}
