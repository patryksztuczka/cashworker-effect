import type { ReactNode } from "react";

interface AppLayoutProps {
  readonly children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-5">
          <span className="text-sm font-medium tracking-wide text-cyan-300 uppercase">
            Cashworker
          </span>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
            Monorepo ready
          </span>
        </header>
        {children}
      </div>
    </main>
  );
}
