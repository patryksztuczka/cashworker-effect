import { and, desc, eq } from "drizzle-orm";

import type { createDb } from "../../db/client";
import { transactions } from "../../db/schema";
import type { Transaction, TransactionsService } from "./interface";

type Db = ReturnType<typeof createDb>;

interface TestTransactionServiceOptions {
  readonly initialTransactions?: readonly Transaction[];
  readonly now?: () => string;
  readonly createId?: () => string;
}

export function createLiveTransactionService(db: Db): TransactionsService {
  return {
    listTransactionsForBankAccount(input) {
      return db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, input.userId),
          eq(transactions.bankAccountId, input.bankAccountId),
        ),
        orderBy: desc(transactions.bookedAt),
      });
    },
    async recordTransactionsForStatementImport(input) {
      const now = new Date().toISOString();
      const rows: Transaction[] = input.transactions.map((transaction) => ({
        ...transaction,
        id: crypto.randomUUID(),
        userId: input.userId,
        bankAccountId: input.bankAccountId,
        statementImportId: input.statementImportId,
        createdAt: now,
      }));

      await Promise.all(
        rows.map((row) => db.insert(transactions).values(row).onConflictDoNothing()),
      );

      return rows;
    },
  };
}

export function createTestTransactionService(
  options: TestTransactionServiceOptions = {},
): TransactionsService {
  const recordedTransactions = [...(options.initialTransactions ?? [])];
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? (() => crypto.randomUUID());

  return {
    async listTransactionsForBankAccount(input) {
      return recordedTransactions
        .filter((row) => row.userId === input.userId && row.bankAccountId === input.bankAccountId)
        .sort((left, right) => right.bookedAt.localeCompare(left.bookedAt));
    },
    async recordTransactionsForStatementImport(input) {
      const timestamp = now();
      const rows: Transaction[] = input.transactions.map((transaction) => ({
        ...transaction,
        id: createId(),
        userId: input.userId,
        bankAccountId: input.bankAccountId,
        statementImportId: input.statementImportId,
        createdAt: timestamp,
      }));

      for (const row of rows) {
        if (
          recordedTransactions.some(
            (existing) =>
              existing.bankAccountId === row.bankAccountId &&
              existing.operationId === row.operationId,
          )
        ) {
          continue;
        }

        recordedTransactions.push(row);
      }

      return rows;
    },
  };
}
