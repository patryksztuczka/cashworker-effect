import type { HealthService } from "./interface";

export function createLiveHealthService(): HealthService {
  return {
    getBackendHealthStatus() {
      return {
        ok: true,
        service: "backend",
        runtime: "cloudflare-workers",
      };
    },
  };
}

export function createTestHealthService(): HealthService {
  return {
    getBackendHealthStatus() {
      return {
        ok: true,
        service: "backend",
        runtime: "cloudflare-workers",
      };
    },
  };
}
