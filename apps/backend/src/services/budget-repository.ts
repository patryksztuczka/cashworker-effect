import { and, desc, eq } from "drizzle-orm";

import { createDb } from "../db/client";
import { bankAccounts, statementImports, transactions } from "../db/schema";
import type { ParsedPkoStatement, ParsedPkoTransaction } from "../statements/pko-parser";

export interface BankAccountView {
  readonly id: string;
  readonly userId: string;
  readonly iban: string;
  readonly accountProduct: string;
  readonly currency: string;
  readonly bankName: string;
  readonly transactionCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TransactionView extends ParsedPkoTransaction {
  readonly id: string;
  readonly userId: string;
  readonly bankAccountId: string;
  readonly statementImportId: string;
  readonly createdAt: string;
}

export interface ImportHistoryItem {
  readonly id: string;
  readonly userId: string;
  readonly bankAccountId: string;
  readonly status: "imported" | "duplicate" | "failed";
  readonly statementNumber: string;
  readonly issuedAt: string;
  readonly periodFrom: string;
  readonly periodTo: string;
  readonly importedTransactionCount: number;
  readonly errorMessage: string | null;
  readonly createdAt: string;
}

export interface ImportStatementInput {
  readonly userId: string;
  readonly fileHash: string;
  readonly parsed: ParsedPkoStatement;
}

export interface ImportStatementResult {
  readonly status: "imported" | "duplicate";
  readonly importId: string;
  readonly importedTransactionCount: number;
  readonly account: BankAccountView;
  readonly statement: ParsedPkoStatement["statement"];
}

export interface BudgetRepository {
  importStatement(input: ImportStatementInput): Promise<ImportStatementResult>;
  listAccounts(userId: string): Promise<BankAccountView[]>;
  listTransactions(userId: string, bankAccountId: string): Promise<TransactionView[]>;
  listImports(userId: string): Promise<ImportHistoryItem[]>;
}

type Db = ReturnType<typeof createDb>;

export function createInMemoryBudgetRepository(): BudgetRepository {
  const accounts = new Map<string, BankAccountView>();
  const imports = new Map<string, ImportHistoryItem & { fileHash: string }>();
  const transactionRows: TransactionView[] = [];

  return {
    async importStatement(input) {
      const duplicate = [...imports.values()].find(
        (item) =>
          item.userId === input.userId &&
          (item.fileHash === input.fileHash ||
            (item.statementNumber === input.parsed.statement.number &&
              item.issuedAt === input.parsed.statement.issuedAt)),
      );

      const account = upsertMemoryAccount(accounts, input);

      if (duplicate) {
        return {
          status: "duplicate",
          importId: duplicate.id,
          importedTransactionCount: 0,
          account,
          statement: input.parsed.statement,
        };
      }

      const now = new Date().toISOString();
      const importId = crypto.randomUUID();
      imports.set(importId, {
        id: importId,
        userId: input.userId,
        bankAccountId: account.id,
        fileHash: input.fileHash,
        status: "imported",
        statementNumber: input.parsed.statement.number,
        issuedAt: input.parsed.statement.issuedAt,
        periodFrom: input.parsed.statement.periodFrom,
        periodTo: input.parsed.statement.periodTo,
        importedTransactionCount: input.parsed.transactions.length,
        errorMessage: null,
        createdAt: now,
      });

      for (const transaction of input.parsed.transactions) {
        if (
          transactionRows.some(
            (row) =>
              row.bankAccountId === account.id && row.operationId === transaction.operationId,
          )
        ) {
          continue;
        }

        transactionRows.push({
          ...transaction,
          id: crypto.randomUUID(),
          userId: input.userId,
          bankAccountId: account.id,
          statementImportId: importId,
          createdAt: now,
        });
      }

      return {
        status: "imported",
        importId,
        importedTransactionCount: input.parsed.transactions.length,
        account: { ...account, transactionCount: input.parsed.transactions.length },
        statement: input.parsed.statement,
      };
    },
    async listAccounts(userId) {
      return [...accounts.values()]
        .filter((account) => account.userId === userId)
        .map((account) => ({
          ...account,
          transactionCount: transactionRows.filter((row) => row.bankAccountId === account.id)
            .length,
        }))
        .sort((left, right) => left.accountProduct.localeCompare(right.accountProduct));
    },
    async listTransactions(userId, bankAccountId) {
      return transactionRows
        .filter((row) => row.userId === userId && row.bankAccountId === bankAccountId)
        .sort((left, right) => right.bookedAt.localeCompare(left.bookedAt));
    },
    async listImports(userId) {
      return [...imports.values()]
        .filter((item) => item.userId === userId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(({ fileHash: _fileHash, ...item }) => item);
    },
  };
}

export function createD1BudgetRepository(db: Db): BudgetRepository {
  return {
    async importStatement(input) {
      const existingByHash = await db.query.statementImports.findFirst({
        where: and(
          eq(statementImports.userId, input.userId),
          eq(statementImports.fileHash, input.fileHash),
        ),
      });
      const account = await upsertD1Account(db, input);

      if (existingByHash) {
        return {
          status: "duplicate",
          importId: existingByHash.id,
          importedTransactionCount: 0,
          account: await getD1AccountView(db, input.userId, account.id),
          statement: input.parsed.statement,
        };
      }

      const existingByStatement = await db.query.statementImports.findFirst({
        where: and(
          eq(statementImports.bankAccountId, account.id),
          eq(statementImports.statementNumber, input.parsed.statement.number),
          eq(statementImports.issuedAt, input.parsed.statement.issuedAt),
        ),
      });

      if (existingByStatement) {
        return {
          status: "duplicate",
          importId: existingByStatement.id,
          importedTransactionCount: 0,
          account: await getD1AccountView(db, input.userId, account.id),
          statement: input.parsed.statement,
        };
      }

      const now = new Date().toISOString();
      const importId = crypto.randomUUID();

      await db.insert(statementImports).values({
        id: importId,
        userId: input.userId,
        bankAccountId: account.id,
        fileHash: input.fileHash,
        statementNumber: input.parsed.statement.number,
        issuedAt: input.parsed.statement.issuedAt,
        periodFrom: input.parsed.statement.periodFrom,
        periodTo: input.parsed.statement.periodTo,
        status: "imported",
        importedTransactionCount: input.parsed.transactions.length,
        errorMessage: null,
        createdAt: now,
      });

      for (const transaction of input.parsed.transactions) {
        await db
          .insert(transactions)
          .values({
            ...transaction,
            id: crypto.randomUUID(),
            userId: input.userId,
            bankAccountId: account.id,
            statementImportId: importId,
            createdAt: now,
          })
          .onConflictDoNothing();
      }

      return {
        status: "imported",
        importId,
        importedTransactionCount: input.parsed.transactions.length,
        account: await getD1AccountView(db, input.userId, account.id),
        statement: input.parsed.statement,
      };
    },
    async listAccounts(userId) {
      const rows = await db.query.bankAccounts.findMany({
        where: eq(bankAccounts.userId, userId),
        orderBy: bankAccounts.accountProduct,
      });

      return Promise.all(rows.map((row) => getD1AccountView(db, userId, row.id)));
    },
    async listTransactions(userId, bankAccountId) {
      return db.query.transactions.findMany({
        where: and(eq(transactions.userId, userId), eq(transactions.bankAccountId, bankAccountId)),
        orderBy: desc(transactions.bookedAt),
      });
    },
    async listImports(userId) {
      return db.query.statementImports.findMany({
        where: eq(statementImports.userId, userId),
        orderBy: desc(statementImports.createdAt),
      });
    },
  };
}

function upsertMemoryAccount(
  accounts: Map<string, BankAccountView>,
  input: ImportStatementInput,
): BankAccountView {
  const existing = [...accounts.values()].find(
    (account) => account.userId === input.userId && account.iban === input.parsed.account.iban,
  );

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const account: BankAccountView = {
    id: crypto.randomUUID(),
    userId: input.userId,
    iban: input.parsed.account.iban,
    accountProduct: input.parsed.account.accountProduct,
    currency: input.parsed.account.currency,
    bankName: input.parsed.account.bankName,
    transactionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  accounts.set(account.id, account);

  return account;
}

async function upsertD1Account(db: Db, input: ImportStatementInput) {
  const existing = await db.query.bankAccounts.findFirst({
    where: and(
      eq(bankAccounts.userId, input.userId),
      eq(bankAccounts.iban, input.parsed.account.iban),
    ),
  });

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const account = {
    id: crypto.randomUUID(),
    userId: input.userId,
    iban: input.parsed.account.iban,
    accountProduct: input.parsed.account.accountProduct,
    currency: input.parsed.account.currency,
    bankName: input.parsed.account.bankName,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(bankAccounts).values(account);

  return account;
}

async function getD1AccountView(db: Db, userId: string, id: string): Promise<BankAccountView> {
  const account = await db.query.bankAccounts.findFirst({
    where: and(eq(bankAccounts.userId, userId), eq(bankAccounts.id, id)),
  });

  if (!account) {
    throw new Error("Bank account not found");
  }

  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), eq(transactions.bankAccountId, id)),
  });

  return { ...account, transactionCount: rows.length };
}
