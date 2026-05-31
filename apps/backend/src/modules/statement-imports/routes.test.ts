import { createApp, type AppServices } from "../../index";
import { createTestBankAccountService } from "../bank-accounts/bank-account-service";
import { createTestCurrentUserService } from "../current-user/current-user-service";
import { createTestHealthService } from "../health/health-service";
import { createTestStatementParserService } from "../parsers/pko-statement-parser-service";
import type { ParsedBankStatement } from "../statements/interface";
import { createTestTransactionService } from "../transactions/transaction-service";
import type { ImportStatementResult } from "./interface";
import { createTestStatementImportService } from "./statement-import-service";

const parsedStatement: ParsedBankStatement = {
  account: {
    bankName: "PKO BP SA",
    iban: "PL50102040270000110221038296",
    accountProduct: "PKO KONTO ZA ZERO",
    currency: "PLN",
  },
  statement: {
    number: "1/2026",
    issuedAt: "2026-02-12",
    periodFrom: "2026-01-12",
    periodTo: "2026-02-12",
  },
  transactions: [
    {
      operationId: "operation-1",
      bookedAt: "2026-02-10",
      valuedAt: "2026-02-10",
      operationType: "PRZELEW PRZYCHODZACY",
      amountMinor: 12_300,
      balanceAfterMinor: 12_300,
      description: "Incoming transfer",
    },
    {
      operationId: "operation-2",
      bookedAt: "2026-02-11",
      valuedAt: "2026-02-11",
      operationType: "PLATNOSC KARTA",
      amountMinor: -4_500,
      balanceAfterMinor: 7_800,
      description: "Card payment",
    },
  ],
};

interface AccountsPayload {
  readonly accounts: readonly { readonly transactionCount: number }[];
}

interface TransactionsPayload {
  readonly transactions: readonly {
    readonly operationId: string;
    readonly bookedAt: string;
    readonly valuedAt: string;
    readonly amountMinor: number;
    readonly balanceAfterMinor: number;
  }[];
}

function createTestAppServices(): AppServices {
  const transactions = createTestTransactionService();
  const bankAccounts = createTestBankAccountService({ transactionsService: transactions });
  const statementImports = createTestStatementImportService({
    bankAccountsService: bankAccounts,
    transactionsService: transactions,
  });

  return {
    bankAccounts,
    currentUser: createTestCurrentUserService(),
    health: createTestHealthService(),
    statementParser: createTestStatementParserService(parsedStatement),
    statementImports,
    transactions,
  };
}

function createStatementUploadBody() {
  const body = new FormData();
  body.set("statement", new File(["%PDF"], "statement.pdf", { type: "application/pdf" }));

  return body;
}

describe("statement import API", () => {
  it("rejects imports without a statement PDF", async () => {
    const app = createApp({ services: createTestAppServices() });
    const body = new FormData();

    const response = await app.request("/api/v1/imports", { method: "POST", body });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "statement PDF is required" });
  });

  it("imports a PKO statement and exposes the created account", async () => {
    const app = createApp({ services: createTestAppServices() });
    const body = createStatementUploadBody();

    const importResponse = await app.request("/api/v1/imports", {
      method: "POST",
      body,
    });
    const importResult = (await importResponse.json()) as ImportStatementResult;

    expect(importResponse.status).toBe(201);
    expect(importResult).toMatchObject({
      status: "imported",
      importedTransactionCount: 2,
      account: {
        accountProduct: "PKO KONTO ZA ZERO",
        iban: "PL50102040270000110221038296",
      },
    });

    const accountsResponse = await app.request("/api/v1/accounts");
    const accounts = (await accountsResponse.json()) as AccountsPayload;

    expect(accountsResponse.status).toBe(200);
    expect(accounts).toMatchObject({
      accounts: [
        {
          accountProduct: "PKO KONTO ZA ZERO",
          currency: "PLN",
          transactionCount: 2,
        },
      ],
    });
  });

  it("reports duplicate statement imports without adding transactions", async () => {
    const app = createApp({ services: createTestAppServices() });

    const firstBody = createStatementUploadBody();
    const firstResponse = await app.request("/api/v1/imports", {
      method: "POST",
      body: firstBody,
    });
    const firstPayload = (await firstResponse.json()) as ImportStatementResult;

    expect(firstResponse.status).toBe(201);
    expect(firstPayload.status).toBe("imported");

    const secondBody = createStatementUploadBody();
    const secondResponse = await app.request("/api/v1/imports", {
      method: "POST",
      body: secondBody,
    });
    const secondPayload = (await secondResponse.json()) as ImportStatementResult;

    expect(secondResponse.status).toBe(200);
    expect(secondPayload).toMatchObject({
      status: "duplicate",
      importedTransactionCount: 0,
    });

    const accountsResponse = await app.request("/api/v1/accounts");
    const accounts = (await accountsResponse.json()) as AccountsPayload;

    expect(accounts.accounts[0]!.transactionCount).toBe(2);
  });

  it("lists imported transactions for an account in booked-date order", async () => {
    const app = createApp({ services: createTestAppServices() });
    const body = createStatementUploadBody();
    const importResponse = await app.request("/api/v1/imports", { method: "POST", body });
    const importResult = (await importResponse.json()) as ImportStatementResult;

    const transactionsResponse = await app.request(
      `/api/v1/accounts/${importResult.account.id}/transactions`,
    );
    const payload = (await transactionsResponse.json()) as TransactionsPayload;

    expect(transactionsResponse.status).toBe(200);
    expect(payload.transactions).toHaveLength(2);
    expect(payload.transactions[0]).toMatchObject({
      operationId: "operation-2",
      bookedAt: "2026-02-11",
      valuedAt: "2026-02-11",
      amountMinor: -4_500,
      balanceAfterMinor: 7_800,
    });
    expect(
      payload.transactions.find(
        (transaction: { operationId: string }) => transaction.operationId === "operation-1",
      ),
    ).toMatchObject({
      operationId: "operation-1",
      amountMinor: 12_300,
    });
  });
});
