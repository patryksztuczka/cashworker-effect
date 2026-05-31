import { Hono } from "hono";

import type { CurrentUserService } from "../current-user/interface";
import type { BankAccountsService } from "./interface";

type BankAccountsEnv = { Bindings: Env };

interface BankAccountsAppOptions {
  readonly currentUserService: CurrentUserService;
  readonly getBankAccountsService: (database?: D1Database) => BankAccountsService;
}

export function createBankAccountsApp(options: BankAccountsAppOptions) {
  const app = new Hono<BankAccountsEnv>();

  app.get("/", async (c) => {
    const accounts = await options
      .getBankAccountsService(c.env?.DB)
      .listBankAccountsForUser(options.currentUserService.getCurrentUserId());

    return c.json({ accounts });
  });

  return app;
}
