export interface HealthStatus {
  readonly ok: true;
  readonly service: "backend";
  readonly runtime: "cloudflare-workers";
}

export interface HealthService {
  /**
   * Returns the backend runtime health payload.
   */
  getBackendHealthStatus(): HealthStatus;
}
