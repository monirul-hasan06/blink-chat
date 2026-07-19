import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { pushSubscriptionSchema } from "@/lib/validation";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    return NextResponse.json({
      configured: Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY &&
        process.env.VAPID_SUBJECT
      ),
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const input = pushSubscriptionSchema.parse(await request.json());

    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userId: currentUser.id
      },
      update: {
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userId: currentUser.id
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    const input = await request.json().catch(() => ({})) as { endpoint?: string };

    if (input.endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: input.endpoint, userId: currentUser.id }
      });
    } else {
      await prisma.pushSubscription.deleteMany({ where: { userId: currentUser.id } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
