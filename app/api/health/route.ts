import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const userTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."User"') IS NOT NULL AS "exists"
    `;

    return NextResponse.json({
      ok: true,
      database: "connected",
      schema: userTable[0]?.exists ? "ready" : "missing"
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, database: "unavailable", schema: "unknown" },
      { status: 503 }
    );
  }
}
