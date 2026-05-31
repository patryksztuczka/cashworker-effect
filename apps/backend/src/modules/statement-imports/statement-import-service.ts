import { and, desc, eq } from "drizzle-orm";

import type { createDb } from "../../db/client";
import { statementImports } from "../../db/schema";
import type { BankAccountsService } from "../bank-accounts/interface";
import type { TransactionsService } from "../transactions/interface";
import type { StatementImport, StatementImportsService } from "./interface";

type Db = ReturnType<typeof createDb>;

interface StatementImportServiceOptions {
  readonly db: Db;
  readonly bankAccountsService: BankAccountsService;
  readonly transactionsService: TransactionsService;
}

interface TestStatementImportRecord extends StatementImport {
  readonly fileHash: string;
}

interface TestStatementImportServiceOptions {
  readonly bankAccountsService: BankAccountsService;
  readonly transactionsService: TransactionsService;
  readonly initialStatementImports?: readonly TestStatementImportRecord[];
  readonly now?: () => string;
  readonly createId?: () => string;
}

export function createLiveStatementImportService(
  options: StatementImportServiceOptions,
): StatementImportsService {
  return {
    async importBankStatement(input) {
      const existingByHash = await options.db.query.statementImports.findFirst({
        where: and(
          eq(statementImports.userId, input.userId),
          eq(statementImports.fileHash, input.fileHash),
        ),
      });
      const account = await options.bankAccountsService.ensureBankAccountForUser({
        userId: input.userId,
        bankAccount: input.parsed.account,
      });

      if (existingByHash) {
        return {
          status: "duplicate",
          importId: existingByHash.id,
          importedTransactionCount: 0,
          account: await options.bankAccountsService.getBankAccountForUser({
            userId: input.userId,
            bankAccountId: account.id,
          }),
          statement: input.parsed.statement,
        };
      }

      const existingByStatement = await options.db.query.statementImports.findFirst({
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
          account: await options.bankAccountsService.getBankAccountForUser({
            userId: input.userId,
            bankAccountId: account.id,
          }),
          statement: input.parsed.statement,
        };
      }

      const now = new Date().toISOString();
      const importId = crypto.randomUUID();

      await options.db.insert(statementImports).values({
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

      await options.transactionsService.recordTransactionsForStatementImport({
        userId: input.userId,
        bankAccountId: account.id,
        statementImportId: importId,
        transactions: input.parsed.transactions,
      });

      return {
        status: "imported",
        importId,
        importedTransactionCount: input.parsed.transactions.length,
        account: await options.bankAccountsService.getBankAccountForUser({
          userId: input.userId,
          bankAccountId: account.id,
        }),
        statement: input.parsed.statement,
      };
    },
    listStatementImportsForUser(userId) {
      return options.db.query.statementImports.findMany({
        where: eq(statementImports.userId, userId),
        orderBy: desc(statementImports.createdAt),
      });
    },
  };
}

export function createTestStatementImportService(
  options: TestStatementImportServiceOptions,
): StatementImportsService {
  const imports = new Map(
    (options.initialStatementImports ?? []).map((statementImport) => [
      statementImport.id,
      statementImport,
    ]),
  );
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? (() => crypto.randomUUID());

  return {
    async importBankStatement(input) {
      const duplicate = [...imports.values()].find(
        (item) =>
          item.userId === input.userId &&
          (item.fileHash === input.fileHash ||
            (item.statementNumber === input.parsed.statement.number &&
              item.issuedAt === input.parsed.statement.issuedAt)),
      );
      const account = await options.bankAccountsService.ensureBankAccountForUser({
        userId: input.userId,
        bankAccount: input.parsed.account,
      });

      if (duplicate) {
        return {
          status: "duplicate",
          importId: duplicate.id,
          importedTransactionCount: 0,
          account: await options.bankAccountsService.getBankAccountForUser({
            userId: input.userId,
            bankAccountId: account.id,
          }),
          statement: input.parsed.statement,
        };
      }

      const importId = createId();
      imports.set(importId, {
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
        createdAt: now(),
      });

      await options.transactionsService.recordTransactionsForStatementImport({
        userId: input.userId,
        bankAccountId: account.id,
        statementImportId: importId,
        transactions: input.parsed.transactions,
      });

      return {
        status: "imported",
        importId,
        importedTransactionCount: input.parsed.transactions.length,
        account: await options.bankAccountsService.getBankAccountForUser({
          userId: input.userId,
          bankAccountId: account.id,
        }),
        statement: input.parsed.statement,
      };
    },
    async listStatementImportsForUser(userId) {
      return [...imports.values()]
        .filter((item) => item.userId === userId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(({ fileHash: _fileHash, ...statementImport }) => statementImport);
    },
  };
}
