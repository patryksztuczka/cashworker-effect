import { readFile } from "node:fs/promises";

import { createApp } from "../src/index";
import type { ImportStatementResult } from "../src/services/budget-repository";
import { createInMemoryBudgetRepository } from "../src/services/budget-repository";

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

describe("statement import API", () => {
  it("imports a PKO statement and exposes the created account", async () => {
    const repository = createInMemoryBudgetRepository();
    const app = createApp({ repository });
    const pdf = await readFile(
      "../../docs/Wyciag_1_50102040270000110221038296_20260212662989201.pdf",
    );
    const body = new FormData();
    body.set(
      "statement",
      new File([pdf], "Wyciag_1_50102040270000110221038296_20260212662989201.pdf", {
        type: "application/pdf",
      }),
    );

    const importResponse = await app.request("/api/imports", {
      method: "POST",
      body,
    });
    const importResult = (await importResponse.json()) as ImportStatementResult;

    expect(importResponse.status).toBe(201);
    expect(importResult).toMatchObject({
      status: "imported",
      importedTransactionCount: 35,
      account: {
        accountProduct: "PKO KONTO ZA ZERO",
        iban: "PL50102040270000110221038296",
      },
    });

    const accountsResponse = await app.request("/api/accounts");
    const accounts = (await accountsResponse.json()) as AccountsPayload;

    expect(accountsResponse.status).toBe(200);
    expect(accounts).toMatchObject({
      accounts: [
        {
          accountProduct: "PKO KONTO ZA ZERO",
          currency: "PLN",
          transactionCount: 35,
        },
      ],
    });
  });

  it("reports duplicate statement imports without adding transactions", async () => {
    const repository = createInMemoryBudgetRepository();
    const app = createApp({ repository });
    const pdf = await readFile(
      "../../docs/Wyciag_1_50102040270000110221038296_20260212662989201.pdf",
    );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const body = new FormData();
      body.set("statement", new File([pdf], "statement.pdf", { type: "application/pdf" }));
      const response = await app.request("/api/imports", { method: "POST", body });
      const payload = (await response.json()) as ImportStatementResult;

      if (attempt === 0) {
        expect(response.status).toBe(201);
        expect(payload.status).toBe("imported");
      } else {
        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
          status: "duplicate",
          importedTransactionCount: 0,
        });
      }
    }

    const accountsResponse = await app.request("/api/accounts");
    const accounts = (await accountsResponse.json()) as AccountsPayload;

    expect(accounts.accounts[0]!.transactionCount).toBe(35);
  });

  it("lists imported transactions for an account in booked-date order", async () => {
    const repository = createInMemoryBudgetRepository();
    const app = createApp({ repository });
    const pdf = await readFile(
      "../../docs/Wyciag_1_50102040270000110221038296_20260212662989201.pdf",
    );
    const body = new FormData();
    body.set("statement", new File([pdf], "statement.pdf", { type: "application/pdf" }));
    const importResponse = await app.request("/api/imports", { method: "POST", body });
    const importResult = (await importResponse.json()) as ImportStatementResult;

    const transactionsResponse = await app.request(
      `/api/accounts/${importResult.account.id}/transactions`,
    );
    const payload = (await transactionsResponse.json()) as TransactionsPayload;

    expect(transactionsResponse.status).toBe(200);
    expect(payload.transactions).toHaveLength(35);
    expect(payload.transactions[0]).toMatchObject({
      operationId: "6542MX95120208116",
      bookedAt: "2026-02-11",
      valuedAt: "2026-02-09",
      amountMinor: -9412,
      balanceAfterMinor: 201_692,
    });
    expect(
      payload.transactions.find(
        (transaction: { operationId: string }) => transaction.operationId === "6512BG06100933174",
      ),
    ).toMatchObject({
      operationId: "6512BG06100933174",
      amountMinor: 0,
    });
  });
});
