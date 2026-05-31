import { Hono } from "hono";
import { z } from "zod";

import type { CurrentUserService } from "../current-user/interface";
import type { TransactionsService } from "./interface";

type TransactionsEnv = { Bindings: Env };

const bankAccountTransactionsParamsSchema = z.object({
  accountId: z.string().min(1),
});

interface TransactionsAppOptions {
  readonly currentUserService: CurrentUserService;
  readonly getTransactionsService: (database?: D1Database) => TransactionsService;
}

export function createTransactionsApp(options: TransactionsAppOptions) {
  const app = new Hono<TransactionsEnv>();

  app.get("/:accountId/transactions", async (c) => {
    const parsedParams = bankAccountTransactionsParamsSchema.safeParse({
      accountId: c.req.param("accountId"),
    });

    if (!parsedParams.success) {
      return c.json({ error: "bank account id is required" }, 400);
    }

    const transactions = await options
      .getTransactionsService(c.env?.DB)
      .listTransactionsForBankAccount({
        userId: options.currentUserService.getCurrentUserId(),
        bankAccountId: parsedParams.data.accountId,
      });

    return c.json({ transactions });
  });

  return app;
}
