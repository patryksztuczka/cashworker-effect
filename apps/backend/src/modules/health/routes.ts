import { Hono } from "hono";

import type { HealthService } from "./interface";

type HealthEnv = { Bindings: Env };

interface HealthAppOptions {
  readonly healthService: HealthService;
}

export function createHealthApp(options: HealthAppOptions) {
  const app = new Hono<HealthEnv>();

  app.get("/", async (c) => {
    return c.json(options.healthService.getBackendHealthStatus());
  });

  return app;
}
