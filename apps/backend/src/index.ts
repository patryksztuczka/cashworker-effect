import { Hono } from "hono";
import { Effect } from "effect";

import { createDb } from "./db/client";
import type { BudgetRepository } from "./services/budget-repository";
import { createD1BudgetRepository } from "./services/budget-repository";
import { currentUserId } from "./services/current-user";
import { getHealth } from "./services/health";
import { parsePkoStatementPdf } from "./statements/pko-parser";

interface AppOptions {
  readonly repository?: BudgetRepository;
}

type AppEnv = { Bindings: Env };

export function createApp(options: AppOptions = {}) {
  const app = new Hono<AppEnv>();

  const getRepository = (database?: D1Database): BudgetRepository => {
    if (options.repository) {
      return options.repository;
    }

    if (!database) {
      throw new Error("D1 database binding is required");
    }

    return createD1BudgetRepository(createDb(database));
  };

  app.get("/", (c) => c.text("cashworker backend"));

  app.get("/health", async (c) => {
    const payload = await Effect.runPromise(getHealth);

    return c.json(payload);
  });

  app.get("/api/health", async (c) => {
    const payload = await Effect.runPromise(getHealth);

    return c.json(payload);
  });

  app.post("/api/imports", async (c) => {
    const body = await c.req.parseBody();
    const file = body.statement;

    if (!(file instanceof File)) {
      return c.json({ error: "statement PDF is required" }, 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await parsePkoStatementPdf(bytes);
    const result = await getRepository(c.env?.DB).importStatement({
      userId: currentUserId,
      fileHash: await hashBytes(bytes),
      parsed,
    });

    return c.json(result, result.status === "imported" ? 201 : 200);
  });

  app.get("/api/accounts", async (c) => {
    const accounts = await getRepository(c.env?.DB).listAccounts(currentUserId);

    return c.json({ accounts });
  });

  app.get("/api/accounts/:accountId/transactions", async (c) => {
    const transactions = await getRepository(c.env?.DB).listTransactions(
      currentUserId,
      c.req.param("accountId"),
    );

    return c.json({ transactions });
  });

  app.get("/api/imports", async (c) => {
    const imports = await getRepository(c.env?.DB).listImports(currentUserId);

    return c.json({ imports });
  });

  return app;
}

async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const app = createApp();

export default app;
