import { redirect } from "next/navigation";
import { Clock3, MessageCircle, ShieldCheck } from "lucide-react";
import { AuthCard } from "@/components/auth-card";
import { InstallButton } from "@/components/install-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/chat");

  return (
    <main className="min-h-dvh overflow-hidden px-5 py-6 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent font-black text-on-accent">
              B
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold tracking-tight">Blink</div>
              <div className="truncate text-xs text-muted">text, then gone</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <InstallButton />
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <section className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs text-accent">
              <span className="blink-dot size-1.5 rounded-full bg-accent" />
              private, text-only messaging
            </div>
            <h1 className="max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Say it. See it. Let it disappear.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
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
                  <div key={title as string} className="rounded-2xl border border-theme bg-subtle p-4">
                    <FeatureIcon size={18} className="mb-3 text-accent" />
                    <div className="text-sm font-medium">{title as string}</div>
                    <div className="mt-1 text-xs leading-5 text-muted">{description as string}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex justify-center lg:justify-end">
            <AuthCard />
          </section>
        </div>

        <footer className="pb-2 text-center text-xs text-faint sm:text-left">
          Accounts inactive for one year are automatically deleted.
        </footer>
      </div>
    </main>
  );
}
