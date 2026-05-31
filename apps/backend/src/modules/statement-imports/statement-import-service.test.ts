import { env } from "cloudflare:workers";

import { createDb } from "../../db/client";
import { statementImports } from "../../db/schema";
import { createLiveBankAccountService } from "../bank-accounts/bank-account-service";
import type { ParsedBankStatement } from "../statements/interface";
import { createLiveTransactionService } from "../transactions/transaction-service";
import { createLiveStatementImportService } from "./statement-import-service";

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

function createService() {
  const db = createDb(env.DB);
  const bankAccountsService = createLiveBankAccountService(db);
  const transactionsService = createLiveTransactionService(db);

  return {
    db,
    service: createLiveStatementImportService({
      db,
      bankAccountsService,
      transactionsService,
    }),
  };
}

describe("StatementImportsService", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM transactions").run();
    await env.DB.prepare("DELETE FROM statement_imports").run();
    await env.DB.prepare("DELETE FROM bank_accounts").run();
  });

  it("imports one parsed Bank Statement into Budget Data", async () => {
    const { db, service } = createService();

    const result = await service.importBankStatement({
      userId: "user-1",
      fileHash: "file-hash-1",
      parsed: parsedStatement,
    });

    expect(result).toMatchObject({
      status: "imported",
      importedTransactionCount: 2,
      account: {
        userId: "user-1",
        iban: "PL50102040270000110221038296",
        transactionCount: 2,
      },
      statement: parsedStatement.statement,
    });
    await expect(db.query.statementImports.findMany()).resolves.toHaveLength(1);
    await expect(db.query.transactions.findMany()).resolves.toHaveLength(2);
  });

  it("returns duplicate when the file hash was already imported", async () => {
    const { db, service } = createService();

    await service.importBankStatement({
      userId: "user-1",
      fileHash: "file-hash-1",
      parsed: parsedStatement,
    });
    const duplicate = await service.importBankStatement({
      userId: "user-1",
      fileHash: "file-hash-1",
      parsed: parsedStatement,
    });

    expect(duplicate).toMatchObject({
      status: "duplicate",
      importedTransactionCount: 0,
    });
    await expect(db.query.statementImports.findMany()).resolves.toHaveLength(1);
    await expect(db.query.transactions.findMany()).resolves.toHaveLength(2);
  });

  it("returns duplicate when the statement identity was already imported for the Bank Account", async () => {
    const { db, service } = createService();

    await service.importBankStatement({
      userId: "user-1",
      fileHash: "file-hash-1",
      parsed: parsedStatement,
    });
    const duplicate = await service.importBankStatement({
      userId: "user-1",
      fileHash: "file-hash-2",
      parsed: parsedStatement,
    });

    expect(duplicate).toMatchObject({
      status: "duplicate",
      importedTransactionCount: 0,
    });
    await expect(db.query.statementImports.findMany()).resolves.toHaveLength(1);
    await expect(db.query.transactions.findMany()).resolves.toHaveLength(2);
  });

  it("lists Statement Imports for one User ordered by creation time descending", async () => {
    const { db, service } = createService();

    await db.insert(statementImports).values([
      {
        id: "older-import",
        userId: "user-1",
        bankAccountId: "bank-account-1",
        fileHash: "file-hash-1",
        statementNumber: "1/2026",
        issuedAt: "2026-02-12",
        periodFrom: "2026-01-12",
        periodTo: "2026-02-12",
        status: "imported",
        importedTransactionCount: 2,
        errorMessage: null,
        createdAt: "2026-02-12T10:00:00.000Z",
      },
      {
        id: "newer-import",
        userId: "user-1",
        bankAccountId: "bank-account-1",
        fileHash: "file-hash-2",
        statementNumber: "2/2026",
        issuedAt: "2026-03-12",
        periodFrom: "2026-02-12",
        periodTo: "2026-03-12",
        status: "imported",
        importedTransactionCount: 1,
        errorMessage: null,
        createdAt: "2026-03-12T10:00:00.000Z",
      },
      {
        id: "other-user-import",
        userId: "user-2",
        bankAccountId: "bank-account-2",
        fileHash: "file-hash-3",
        statementNumber: "1/2026",
        issuedAt: "2026-02-12",
        periodFrom: "2026-01-12",
        periodTo: "2026-02-12",
        status: "imported",
        importedTransactionCount: 1,
        errorMessage: null,
        createdAt: "2026-04-12T10:00:00.000Z",
      },
    ]);

    const imports = await service.listStatementImportsForUser("user-1");

    expect(imports.map((item) => item.id)).toEqual(["newer-import", "older-import"]);
  });
});
