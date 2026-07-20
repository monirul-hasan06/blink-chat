import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);

    const result = await sendPushToUser(currentUser.id, {
      title: "Blink notifications are ready",
      body: "This device can receive new-message alerts.",
      url: "/chat",
      tag: `notification-test-${currentUser.id}`
    });

    if (!result.configured) {
      return jsonError("Push notification keys are not configured in Vercel", 503);
    }
    if (result.attempted === 0) {
      return jsonError("No notification subscription is saved for this device", 409);
    }
    if (result.delivered === 0) {
      return jsonError("The push service did not accept the test notification", 502);
    }

    return NextResponse.json({ ok: true, delivered: result.delivered });
  } catch (error) {
    return handleRouteError(error);
  }
}
