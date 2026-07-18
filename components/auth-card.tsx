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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not continue");
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
    <div className="glass w-full max-w-md rounded-[2rem] p-3 shadow-glow">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1.5">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            mode === "login" ? "bg-white text-black" : "text-white/60 hover:text-white"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            mode === "signup" ? "bg-white text-black" : "text-white/60 hover:text-white"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-4 pt-6">
        <div>
          <label htmlFor="username" className="mb-2 block text-sm text-white/70">
            Username
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 focus-within:border-[#8cffaa]/50">
            <UserRound size={18} className="text-white/35" />
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
              className="min-w-0 flex-1 bg-transparent py-3.5 text-[16px] text-white outline-none placeholder:text-white/25"
            />
          </div>
          {mode === "signup" && (
            <p className="mt-2 text-xs leading-5 text-white/35">
              3–20 characters. Letters, numbers, and underscores only.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="pin" className="mb-2 block text-sm text-white/70">
            PIN
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 focus-within:border-[#8cffaa]/50">
            <LockKeyhole size={18} className="text-white/35" />
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
              className="min-w-0 flex-1 bg-transparent py-3.5 text-[16px] tracking-[0.3em] text-white outline-none placeholder:tracking-normal placeholder:text-white/25"
            />
            <button
              type="button"
              onClick={() => setShowPin((current) => !current)}
              aria-label={showPin ? "Hide PIN" : "Show PIN"}
              className="rounded-lg p-1 text-white/35 transition hover:text-white"
            >
              {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8cffaa] px-4 py-3.5 font-semibold text-[#07110d] transition hover:bg-[#a8ffbd] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <LoaderCircle size={18} className="animate-spin" />}
          {mode === "login" ? "Enter Blink" : "Create my account"}
        </button>
      </form>
    </div>
  );
}
