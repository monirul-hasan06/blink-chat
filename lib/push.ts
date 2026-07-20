import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface PushDeliveryResult {
  configured: boolean;
  attempted: number;
  delivered: number;
}

let configured = false;

function configureWebPush() {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushDeliveryResult> {
  if (!configureWebPush()) {
    return { configured: false, attempted: 0, delivered: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true }
  });

  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (subscription: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24, urgency: "high", topic: payload.tag.slice(0, 32) }
        );
        delivered += 1;
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
          return;
        }

        console.error("Push notification failed", error);
      }
    })
  );

  return {
    configured: true,
    attempted: subscriptions.length,
    delivered
  };
}
