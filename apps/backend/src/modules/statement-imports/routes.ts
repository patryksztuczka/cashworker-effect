import { Hono } from "hono";
import { z } from "zod";

import type { CurrentUserService } from "../current-user/interface";
import type { StatementParserService } from "../parsers/interface";
import { hashBytes } from "./file-hash";
import type { StatementImportsService } from "./interface";

type StatementImportsEnv = { Bindings: Env };

const statementImportBodySchema = z.object({
  statement: z
    .instanceof(File)
    .refine(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
      "statement PDF is required",
    ),
});

interface StatementImportsAppOptions {
  readonly currentUserService: CurrentUserService;
  readonly statementParserService: StatementParserService;
  readonly getStatementImportsService: (database?: D1Database) => StatementImportsService;
}

export function createStatementImportsApp(options: StatementImportsAppOptions) {
  const app = new Hono<StatementImportsEnv>();

  app.post("/", async (c) => {
    const body = await c.req.parseBody();
    const parsedBody = statementImportBodySchema.safeParse(body);

    if (!parsedBody.success) {
      return c.json({ error: "statement PDF is required" }, 400);
    }

    const file = parsedBody.data.statement;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await options.statementParserService.parsePkoBankStatementPdf(bytes);
    const result = await options.getStatementImportsService(c.env?.DB).importBankStatement({
      userId: options.currentUserService.getCurrentUserId(),
      fileHash: await hashBytes(bytes),
      parsed,
    });

    return c.json(result, result.status === "imported" ? 201 : 200);
  });

  app.get("/", async (c) => {
    const imports = await options
      .getStatementImportsService(c.env?.DB)
      .listStatementImportsForUser(options.currentUserService.getCurrentUserId());

    return c.json({ imports });
  });

  return app;
}
