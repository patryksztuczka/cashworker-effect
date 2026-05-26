import { Hono } from "hono";
import { Effect } from "effect";

import { createDb } from "./db/client";
import { todos } from "./db/schema";
import { getHealth } from "./services/health";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.text("cashworker backend"));

app.get("/health", async (c) => {
  const payload = await Effect.runPromise(getHealth);

  return c.json(payload);
});

app.get("/todos", async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db.select().from(todos).limit(20);

  return c.json({ todos: rows });
});

export default app;
