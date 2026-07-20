import { redirect } from "next/navigation";
import { Clock3, MessageCircle, ShieldCheck } from "lucide-react";
import { AuthCard } from "@/components/auth-card";
import { InstallButton } from "@/components/install-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SessionRecovery } from "@/components/session-recovery";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/chat");

  return (
    <>
      <SessionRecovery />
      <main className="landing-shell min-h-svh overflow-x-clip px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-1.5rem)] min-w-0 max-w-6xl flex-col sm:min-h-[calc(100svh-3rem)]">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-sm font-black text-on-accent sm:size-10 sm:rounded-2xl sm:text-base">
              B
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold tracking-tight sm:text-lg">Blink</div>
              <div className="truncate text-[11px] text-muted sm:text-xs">text, then gone</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <InstallButton />
          </div>
        </header>

        <div className="grid flex-1 content-start gap-6 py-5 sm:gap-9 sm:py-9 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-12 lg:py-12">
          <section className="landing-copy order-2 mx-auto min-w-0 w-full max-w-md lg:order-1 lg:mx-0 lg:max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-[11px] text-accent sm:mb-6 sm:text-xs">
              <span className="blink-dot size-1.5 rounded-full bg-accent" />
              private, text-only messaging
            </div>
            <h1 className="landing-title max-w-xl font-semibold leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-7xl lg:leading-[0.98]">
              <span className="block">Say it. See it.</span>
              <span className="block">Let it disappear.</span>
            </h1>
            <p className="landing-description mt-4 max-w-xl text-sm leading-6 text-muted sm:mt-6 sm:text-base sm:leading-7 lg:text-lg">
              Blink keeps chat simple: a username, a PIN, and messages that are removed 24 hours after they are seen.
            </p>

            <div className="mt-7 hidden gap-3 md:grid md:grid-cols-3 lg:mt-10">
              {[
                [MessageCircle, "Text only", "No media or feeds."],
                [Clock3, "24-hour expiry", "The countdown starts after viewing."],
                [ShieldCheck, "Simple access", "Username and PIN only."]
              ].map(([Icon, title, description]) => {
                const FeatureIcon = Icon as typeof MessageCircle;
                return (
                  <div key={title as string} className="rounded-2xl border border-theme bg-subtle p-4">
                    <FeatureIcon size={18} className="mb-3 text-accent" />
                    <div className="text-sm font-medium">{title as string}</div>
                    <div className="mt-1 text-xs leading-5 text-muted">{description as string}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="order-1 flex min-w-0 w-full justify-center lg:order-2 lg:justify-end">
            <AuthCard />
          </section>
        </div>

        <footer className="pb-[max(0.25rem,env(safe-area-inset-bottom))] text-center text-[11px] text-faint sm:text-left sm:text-xs">
          Accounts inactive for one year are automatically deleted.
        </footer>
      </div>
      </main>
    </>
  );
}
