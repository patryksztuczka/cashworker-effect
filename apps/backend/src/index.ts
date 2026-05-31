import { Hono } from "hono";

import { createDb } from "./db/client";
import { createLiveBankAccountService } from "./modules/bank-accounts/bank-account-service";
import type { BankAccountsService } from "./modules/bank-accounts/interface";
import { createBankAccountsApp } from "./modules/bank-accounts/routes";
import { createLiveCurrentUserService } from "./modules/current-user/current-user-service";
import type { CurrentUserService } from "./modules/current-user/interface";
import { createLiveHealthService } from "./modules/health/health-service";
import type { HealthService } from "./modules/health/interface";
import { createHealthApp } from "./modules/health/routes";
import type { StatementParserService } from "./modules/parsers/interface";
import { createLivePkoStatementParserService } from "./modules/parsers/pko-statement-parser-service";
import type { StatementImportsService } from "./modules/statement-imports/interface";
import { createStatementImportsApp } from "./modules/statement-imports/routes";
import { createLiveStatementImportService } from "./modules/statement-imports/statement-import-service";
import type { TransactionsService } from "./modules/transactions/interface";
import { createTransactionsApp } from "./modules/transactions/routes";
import { createLiveTransactionService } from "./modules/transactions/transaction-service";

interface AppOptions {
  readonly services?: AppServices;
}

export interface AppServices {
  readonly bankAccounts: BankAccountsService;
  readonly currentUser: CurrentUserService;
  readonly health: HealthService;
  readonly statementParser: StatementParserService;
  readonly statementImports: StatementImportsService;
  readonly transactions: TransactionsService;
}

type AppEnv = { Bindings: Env };

export function createApp(options: AppOptions = {}) {
  const app = new Hono<AppEnv>();
  const api = new Hono<AppEnv>();
  const currentUser = options.services?.currentUser ?? createLiveCurrentUserService();
  const health = options.services?.health ?? createLiveHealthService();
  const statementParser =
    options.services?.statementParser ?? createLivePkoStatementParserService();

  const getServices = (database?: D1Database): AppServices => {
    if (options.services) {
      return options.services;
    }

    if (!database) {
      throw new Error("D1 database binding is required");
    }

    const db = createDb(database);
    const bankAccounts = createLiveBankAccountService(db);
    const transactions = createLiveTransactionService(db);
    const statementImports = createLiveStatementImportService({
      db,
      bankAccountsService: bankAccounts,
      transactionsService: transactions,
    });

    return { bankAccounts, currentUser, health, statementParser, statementImports, transactions };
  };

  app.get("/", (c) => c.text("cashworker backend"));

  api.route("/health", createHealthApp({ healthService: health }));
  api.route(
    "/imports",
    createStatementImportsApp({
      currentUserService: currentUser,
      statementParserService: statementParser,
      getStatementImportsService: (database) => getServices(database).statementImports,
    }),
  );
  api.route(
    "/accounts",
    createBankAccountsApp({
      currentUserService: currentUser,
      getBankAccountsService: (database) => getServices(database).bankAccounts,
    }),
  );
  api.route(
    "/accounts",
    createTransactionsApp({
      currentUserService: currentUser,
      getTransactionsService: (database) => getServices(database).transactions,
    }),
  );

  app.route("/api/v1", api);

  return app;
}

const app = createApp();

export default app;
