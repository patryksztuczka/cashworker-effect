import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

const webStackItems = ["Vite", "React Router", "TanStack Query"];

async function fetchBackendHealth() {
  const response = await fetch("/api/health");

  if (!response.ok) {
    throw new Error("Unable to reach backend health endpoint");
  }

  return response.json() as Promise<{
    ok: true;
    service: "backend";
    runtime: "cloudflare-workers";
  }>;
}

export function HomeRoute() {
  const healthQuery = useQuery({
    queryKey: ["backend-health"],
    queryFn: fetchBackendHealth,
    enabled: false,
  });

  const checkBackendHealth = useCallback(() => {
    void healthQuery.refetch();
  }, [healthQuery]);

  return (
    <section className="grid flex-1 content-center gap-8 py-12">
      <div className="max-w-3xl">
        <p className="mb-4 text-sm font-medium tracking-wide text-cyan-300 uppercase">
          React Router + TanStack Query + Tailwind
        </p>
        <h1 className="text-4xl leading-tight font-semibold text-white sm:text-6xl">
          Cashworker web is wired for application work.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
          The backend lives in Cloudflare Workers with Hono, Effect, Drizzle, and D1. This frontend
          starts with route-driven rendering and a query client ready for API calls.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {webStackItems.map((label) => (
          <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">Web stack</p>
            <p className="mt-2 text-xl font-medium text-white">{label}</p>
          </div>
        ))}
      </div>

      <button
        className="w-fit rounded-md bg-cyan-300 px-4 py-2 font-medium text-zinc-950 transition hover:bg-cyan-200"
        type="button"
        onClick={checkBackendHealth}
      >
        Check backend health
      </button>

      {healthQuery.data ? (
        <pre className="w-fit rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-emerald-200">
          {JSON.stringify(healthQuery.data, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
