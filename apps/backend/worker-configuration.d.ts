import type { D1Migration } from "cloudflare:test";

declare global {
  interface Env {
    DB: D1Database;
  }

  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
