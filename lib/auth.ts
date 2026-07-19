import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { onlineUntilFromNow } from "@/lib/presence";

const COOKIE_NAME = "blink_session";
// Keep the login across browser and installed-PWA restarts. The app refreshes
// this cookie whenever an authenticated user opens Blink.
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 400;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS
  });
}

export async function refreshSession() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });
  if (!exists) {
    await clearSession();
    return null;
  }

  await createSession(userId);
  return userId;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0)
  });
}

export async function getSessionUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, lastActiveAt: true, onlineUntil: true }
  });

  if (!user) return null;

  const now = new Date();
  const shouldTouch = user.onlineUntil.getTime() < now.getTime() + 15_000;

  if (shouldTouch) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: now, onlineUntil: onlineUntilFromNow(now) },
      select: { id: true, username: true, lastActiveAt: true, onlineUntil: true }
    });
    return updated;
  }

  return user;
}

export async function setCurrentUserOffline() {
  const userId = await getSessionUserId();
  if (!userId) return;

  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: now, onlineUntil: now }
  }).catch(() => undefined);
}
