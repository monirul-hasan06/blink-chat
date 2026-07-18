import { AuthCard } from "@/components/auth-card";
import { InstallButton } from "@/components/install-button";
import { Clock3, MessageCircle, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-dvh overflow-hidden px-5 py-6 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-[#8cffaa] font-black text-[#07110d]">
              B
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Blink</div>
              <div className="text-xs text-white/35">text, then gone</div>
            </div>
          </div>
          <InstallButton />
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <section className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#8cffaa]/20 bg-[#8cffaa]/5 px-3 py-1.5 text-xs text-[#b8ffc9]">
              <span className="blink-dot size-1.5 rounded-full bg-[#8cffaa]" />
              private, text-only messaging
            </div>
            <h1 className="max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Say it. See it. Let it disappear.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/50 sm:text-lg">
              Blink keeps chat simple: a username, a PIN, and messages that are removed 24 hours after they are seen.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                [MessageCircle, "Text only", "No media or feeds."],
                [Clock3, "24-hour expiry", "The countdown starts after viewing."],
                [ShieldCheck, "Simple access", "Username and PIN only."]
              ].map(([Icon, title, description]) => {
                const FeatureIcon = Icon as typeof MessageCircle;
                return (
                  <div key={title as string} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <FeatureIcon size={18} className="mb-3 text-[#8cffaa]" />
                    <div className="text-sm font-medium">{title as string}</div>
                    <div className="mt-1 text-xs leading-5 text-white/35">{description as string}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex justify-center lg:justify-end">
            <AuthCard />
          </section>
        </div>

        <footer className="pb-2 text-center text-xs text-white/25 sm:text-left">
          Accounts inactive for one year are automatically deleted.
        </footer>
      </div>
    </main>
  );
}
