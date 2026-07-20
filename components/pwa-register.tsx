"use client";

import { useEffect } from "react";

export type BlinkInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

declare global {
  interface Window {
    __blinkInstallPrompt?: BlinkInstallPromptEvent | null;
  }
}

function announceInstallState() {
  window.dispatchEvent(new Event("blink-install-state"));
}

export function PwaRegister() {
  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__blinkInstallPrompt = event as BlinkInstallPromptEvent;
      announceInstallState();
    };

    const handleInstalled = () => {
      window.__blinkInstallPrompt = null;
      announceInstallState();
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          void registration.update();
        })
        .catch(() => {
          // Blink remains usable without installation or push support.
        });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  return null;
}
