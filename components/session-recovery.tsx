"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Recovers sessions created by older Blink releases that used SameSite=Strict.
 * Some Android PWA launches omit a Strict cookie on the first navigation, but
 * include it again for a same-origin request after the page has loaded.
 */
export function SessionRecovery() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);

    void fetch("/api/auth/refresh", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) return;
        router.replace("/chat");
        router.refresh();
      })
      .catch(() => {
        // A missing session or temporary network error should leave login usable.
      })
      .finally(() => {
        window.clearTimeout(timeout);
        setChecking(false);
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [router]);

  if (!checking) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-page"
      role="status"
      aria-live="polite"
      aria-label="Restoring your Blink session"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-theme bg-panel px-4 py-3 text-sm text-secondary shadow-xl">
        <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
        Restoring Blink…
      </div>
    </div>
  );
}
