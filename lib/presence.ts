export const ONLINE_WINDOW_MS = 45_000;

export function onlineUntilFromNow(now = new Date()) {
  return new Date(now.getTime() + ONLINE_WINDOW_MS);
}

export function presenceFromDates(lastActiveAt: Date, onlineUntil: Date) {
  return {
    online: onlineUntil.getTime() > Date.now(),
    lastSeenAt: lastActiveAt.toISOString()
  };
}
