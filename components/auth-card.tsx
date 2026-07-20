"use client";

import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Mode = "login" | "signup";

export function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin })
      });
      const responseText = await response.text();
      let data: { error?: string } = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText) as { error?: string };
        } catch {
          throw new Error(
            `The server returned an invalid response (${response.status}). Check the Vercel runtime logs.`
          );
        }
      }

      if (!response.ok) {
        throw new Error(data.error ?? `Request failed (${response.status})`);
      }

      router.push("/chat");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Could not continue");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
  }

  return (
    <div className="glass w-full max-w-md rounded-[1.5rem] p-2 shadow-glow sm:rounded-[2rem] sm:p-3">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-input p-1.5">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            mode === "login" ? "bg-selected text-main" : "text-secondary hover-text-main"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            mode === "signup" ? "bg-selected text-main" : "text-secondary hover-text-main"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 p-3 pt-4 sm:space-y-4 sm:p-4 sm:pt-6">
        <div>
          <label htmlFor="username" className="mb-2 block text-sm text-secondary">
            Username
          </label>
          <div className="text-field flex items-center gap-3 rounded-2xl border border-theme bg-input px-3.5 sm:px-4">
            <UserRound size={18} className="text-muted" />
            <input
              id="username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="your_username"
              minLength={3}
              maxLength={20}
              required
              className="min-w-0 flex-1 bg-transparent py-3.5 text-[16px] text-main outline-none placeholder-faint"
            />
          </div>
          {mode === "signup" && (
            <p className="mt-2 text-xs leading-5 text-muted">
              3–20 characters. Letters, numbers, and underscores only.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="pin" className="mb-2 block text-sm text-secondary">
            PIN
          </label>
          <div className="text-field flex items-center gap-3 rounded-2xl border border-theme bg-input px-3.5 sm:px-4">
            <LockKeyhole size={18} className="text-muted" />
            <input
              id="pin"
              name="pin"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="4–8 digits"
              minLength={4}
              maxLength={8}
              required
              className="min-w-0 flex-1 bg-transparent py-3.5 text-[16px] tracking-[0.3em] text-main outline-none placeholder:tracking-normal placeholder-faint"
            />
            <button
              type="button"
              onClick={() => setShowPin((current) => !current)}
              aria-label={showPin ? "Hide PIN" : "Show PIN"}
              className="rounded-lg p-1 text-muted transition hover-text-main"
            >
              {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 font-semibold text-on-accent transition hover-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <LoaderCircle size={18} className="animate-spin" />}
          {mode === "login" ? "Enter Blink" : "Create my account"}
        </button>
      </form>
    </div>
  );
}
