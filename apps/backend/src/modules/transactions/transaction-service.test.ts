import { env } from "cloudflare:workers";

import { createDb } from "../../db/client";
import { transactions } from "../../db/schema";
import { createLiveTransactionService } from "./transaction-service";

describe("TransactionsService", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM transactions").run();
  });

  it("records Transactions for a statement import", async () => {
    const service = createLiveTransactionService(createDb(env.DB));

    const recorded = await service.recordTransactionsForStatementImport({
      userId: "user-1",
      bankAccountId: "bank-account-1",
      statementImportId: "statement-import-1",
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
      ],
    });

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      userId: "user-1",
      bankAccountId: "bank-account-1",
      statementImportId: "statement-import-1",
      operationId: "operation-1",
    });
    expect(recorded[0]!.id).toEqual(expect.any(String));
    expect(recorded[0]!.createdAt).toEqual(expect.any(String));
  });

  it("ignores duplicate Operation Identifiers for the same Bank Account", async () => {
    const service = createLiveTransactionService(createDb(env.DB));
    const input = {
      userId: "user-1",
      bankAccountId: "bank-account-1",
      statementImportId: "statement-import-1",
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
      ],
    };

    await service.recordTransactionsForStatementImport(input);
    await service.recordTransactionsForStatementImport(input);

    await expect(
      service.listTransactionsForBankAccount({
        userId: "user-1",
        bankAccountId: "bank-account-1",
      }),
    ).resolves.toHaveLength(1);
  });

  it("lists Transactions for one User-owned Bank Account in Booked Date descending order", async () => {
    const db = createDb(env.DB);
    const service = createLiveTransactionService(db);

    await db.insert(transactions).values([
      {
        id: "transaction-1",
        userId: "user-1",
        bankAccountId: "bank-account-1",
        statementImportId: "statement-import-1",
        operationId: "operation-1",
        bookedAt: "2026-02-10",
        valuedAt: "2026-02-10",
        operationType: "PRZELEW PRZYCHODZACY",
        amountMinor: 12_300,
        balanceAfterMinor: 12_300,
        description: "Incoming transfer",
        createdAt: "2026-02-12T10:00:00.000Z",
      },
      {
        id: "transaction-2",
        userId: "user-1",
        bankAccountId: "bank-account-1",
        statementImportId: "statement-import-1",
        operationId: "operation-2",
        bookedAt: "2026-02-11",
        valuedAt: "2026-02-11",
        operationType: "PLATNOSC KARTA",
        amountMinor: -4_500,
        balanceAfterMinor: 7_800,
        description: "Card payment",
        createdAt: "2026-02-12T10:01:00.000Z",
      },
      {
        id: "transaction-3",
        userId: "user-2",
        bankAccountId: "bank-account-1",
        statementImportId: "statement-import-2",
        operationId: "operation-3",
        bookedAt: "2026-02-12",
        valuedAt: "2026-02-12",
        operationType: "PRZELEW PRZYCHODZACY",
        amountMinor: 1_000,
        balanceAfterMinor: 1_000,
        description: "Other user transaction",
        createdAt: "2026-02-12T10:02:00.000Z",
      },
    ]);

    const result = await service.listTransactionsForBankAccount({
      userId: "user-1",
      bankAccountId: "bank-account-1",
    });

    expect(result.map((transaction) => transaction.id)).toEqual(["transaction-2", "transaction-1"]);
  });
});
