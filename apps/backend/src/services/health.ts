import { Effect } from "effect";

export interface HealthStatus {
  readonly ok: true;
  readonly service: "backend";
  readonly runtime: "cloudflare-workers";
}

export const getHealth = Effect.succeed<HealthStatus>({
  ok: true,
  service: "backend",
  runtime: "cloudflare-workers",
});
