import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig, defineProject } from "vitest/config";

const configDir = dirname(fileURLToPath(import.meta.url));
const workersTestFiles = [
  "src/modules/bank-accounts/bank-account-service.test.ts",
  "src/modules/statement-imports/statement-import-service.test.ts",
  "src/modules/transactions/transaction-service.test.ts",
];

export default defineConfig(async () => ({
  test: {
    projects: [
      defineProject({
        test: {
          name: "node",
          globals: true,
          include: ["test/**/*.test.ts", "src/**/*.test.ts"],
          exclude: workersTestFiles,
        },
      }),
      defineProject({
        plugins: [
          cloudflareTest({
            wrangler: {
              configPath: "./wrangler.jsonc",
            },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations(resolve(configDir, "drizzle")),
              },
            },
          }),
        ],
        test: {
          name: "workers",
          globals: true,
          include: workersTestFiles,
          setupFiles: ["./test/apply-migrations.ts"],
        },
      }),
    ],
  },
}));
