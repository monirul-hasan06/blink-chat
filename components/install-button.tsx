"use client";

import { CheckCircle2, Download, MoreVertical, Share2, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BlinkInstallPromptEvent } from "@/components/pwa-register";

type InstallState = {
  installed: boolean;
  canPrompt: boolean;
  isIos: boolean;
  isSafari: boolean;
};

function readInstallState(): InstallState {
  if (typeof window === "undefined") {
    return { installed: false, canPrompt: false, isIos: false, isSafari: false };
  }

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  const installed = window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
  const userAgent = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(userAgent);
  const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);

  return {
    installed,
    canPrompt: Boolean(window.__blinkInstallPrompt),
    isIos,
    isSafari
  };
}

function useInstallState() {
  const [state, setState] = useState<InstallState>(() => readInstallState());

  const refresh = useCallback(() => setState(readInstallState()), []);

  useEffect(() => {
    refresh();
    const media = window.matchMedia("(display-mode: standalone)");
    window.addEventListener("blink-install-state", refresh);
    window.addEventListener("appinstalled", refresh);
    media.addEventListener?.("change", refresh);

    return () => {
      window.removeEventListener("blink-install-state", refresh);
      window.removeEventListener("appinstalled", refresh);
      media.removeEventListener?.("change", refresh);
    };
  }, [refresh]);

  const install = useCallback(async () => {
    const promptEvent = window.__blinkInstallPrompt as BlinkInstallPromptEvent | null | undefined;
    if (!promptEvent) return false;

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    window.__blinkInstallPrompt = null;
    window.dispatchEvent(new Event("blink-install-state"));
    return choice.outcome === "accepted";
  }, []);

  return { state, install };
}

export function InstallButton() {
  const { state, install } = useInstallState();
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  if (state.installed) return null;
  if (!state.canPrompt && !state.isIos) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={async () => {
          if (state.canPrompt) await install();
          else setInstructionsOpen((current) => !current);
        }}
        className="inline-flex size-10 items-center justify-center rounded-full border border-theme bg-subtle text-secondary transition hover-surface sm:w-auto sm:px-3.5"
        aria-label="Install Blink app"
        title="Install Blink app"
      >
        <Download size={16} />
        <span className="ml-2 hidden text-sm sm:inline">Install</span>
      </button>

      {instructionsOpen && (
        <div className="absolute right-0 top-12 z-40 w-64 rounded-2xl border border-theme bg-panel-solid p-4 text-left shadow-2xl">
          <p className="text-sm font-medium">Install Blink on iPhone</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Open Blink in Safari, tap Share, then choose Add to Home Screen.
          </p>
          <button type="button" onClick={() => setInstructionsOpen(false)} className="mt-3 text-xs font-medium text-accent">
            Got it
          </button>
        </div>
      )}
    </div>
  );
}

export function InstallAppCard() {
  const { state, install } = useInstallState();
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const description = useMemo(() => {
    if (state.installed) return "Blink is installed and opens in its own app window.";
    if (state.canPrompt) return "Install Blink for a full-screen app experience and easier notification access.";
    if (state.isIos && state.isSafari) return "Tap Share in Safari, then choose Add to Home Screen.";
    if (state.isIos) return "Open this page in Safari, tap Share, then choose Add to Home Screen.";
    return "Use your browser menu and choose Install app or Add to Home screen.";
  }, [state]);

  return (
    <div className="rounded-2xl border border-theme bg-subtle p-4">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${state.installed ? "bg-accent-soft text-accent" : "bg-input text-secondary"}`}>
          {state.installed ? <CheckCircle2 size={19} /> : <Smartphone size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Install Blink</div>
          <div className="mt-1 text-xs leading-5 text-muted">{description}</div>
        </div>
      </div>

      {!state.installed && (
        <div className="mt-3">
          {state.canPrompt ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await install().catch(() => false);
                setBusy(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-xs font-semibold text-on-accent disabled:opacity-60"
            >
              <Download size={15} />
              {busy ? "Opening installer…" : "Install app"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowHelp((current) => !current)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-theme bg-input px-3 py-2.5 text-xs font-medium text-secondary hover-surface"
            >
              {state.isIos ? <Share2 size={15} /> : <MoreVertical size={15} />}
              Show installation steps
            </button>
          )}

          {showHelp && (
            <div className="mt-3 rounded-xl border border-theme bg-input px-3 py-3 text-xs leading-5 text-muted">
              {state.isIos
                ? "Use Safari. Tap the Share button, scroll if needed, select Add to Home Screen, then tap Add."
                : "Open the browser menu and select Install app or Add to Home screen. The exact wording depends on the browser."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
