import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tables = await prisma.$queryRaw<Array<{ users: boolean; groups: boolean; push: boolean }>>`
      SELECT
        to_regclass('public."User"') IS NOT NULL AS "users",
        to_regclass('public."Group"') IS NOT NULL AS "groups",
        to_regclass('public."PushSubscription"') IS NOT NULL AS "push"
    `;
    const ready = Boolean(tables[0]?.users && tables[0]?.groups && tables[0]?.push);

    return NextResponse.json({
      ok: true,
      database: "connected",
      schema: ready ? "ready" : "missing",
      notificationsConfigured: Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY &&
        process.env.VAPID_SUBJECT
      )
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, database: "unavailable", schema: "unknown" },
      { status: 503 }
    );
  }
}
