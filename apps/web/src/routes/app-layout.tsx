import type { ReactNode } from "react";

interface AppLayoutProps {
  readonly children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <main className="min-h-dvh bg-stone-100 text-stone-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-stone-300 py-4">
          <span className="text-sm font-semibold tracking-wide text-stone-950 uppercase">
            Cashworker
          </span>
          <span className="rounded-full border border-lime-700/30 bg-lime-100 px-3 py-1 text-sm font-medium text-lime-900">
            Dev user
          </span>
        </header>
        {children}
      </div>
    </main>
  );
}
