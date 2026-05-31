import { env } from "cloudflare:workers";

import { createDb } from "../../db/client";
import { transactions } from "../../db/schema";
import { createLiveBankAccountService } from "./bank-account-service";
import type { BankAccountDetails } from "./interface";

const primaryAccount: BankAccountDetails = {
  bankName: "PKO BP SA",
  iban: "PL50102040270000110221038296",
  accountProduct: "PKO KONTO ZA ZERO",
  currency: "PLN",
};

const savingsAccount: BankAccountDetails = {
  bankName: "PKO BP SA",
  iban: "PL44102040270000110221038297",
  accountProduct: "PKO KONTO OSZCZEDNOSCIOWE",
  currency: "PLN",
};

describe("BankAccountsService", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM transactions").run();
    await env.DB.prepare("DELETE FROM statement_imports").run();
    await env.DB.prepare("DELETE FROM bank_accounts").run();
  });

  it("creates a Bank Account from imported statement details", async () => {
    const account = await createLiveBankAccountService(createDb(env.DB)).ensureBankAccountForUser({
      userId: "user-1",
      bankAccount: primaryAccount,
    });

    expect(account).toMatchObject({
      userId: "user-1",
      iban: "PL50102040270000110221038296",
      accountProduct: "PKO KONTO ZA ZERO",
      currency: "PLN",
      bankName: "PKO BP SA",
    });
    expect(account.id).toEqual(expect.any(String));
    expect(account.createdAt).toEqual(expect.any(String));
    expect(account.updatedAt).toEqual(expect.any(String));
  });

  it("returns the existing Bank Account for the same User and IBAN", async () => {
    const service = createLiveBankAccountService(createDb(env.DB));
    const first = await service.ensureBankAccountForUser({
      userId: "user-1",
      bankAccount: primaryAccount,
    });
    const second = await service.ensureBankAccountForUser({
      userId: "user-1",
      bankAccount: { ...primaryAccount, accountProduct: "Changed product name" },
    });

    expect(second).toEqual(first);
    await expect(service.listBankAccountsForUser("user-1")).resolves.toHaveLength(1);
  });

  it("creates separate Bank Accounts for the same IBAN across different Users", async () => {
    const service = createLiveBankAccountService(createDb(env.DB));
    const firstUserAccount = await service.ensureBankAccountForUser({
      userId: "user-1",
      bankAccount: primaryAccount,
    });
    const secondUserAccount = await service.ensureBankAccountForUser({
      userId: "user-2",
      bankAccount: primaryAccount,
    });

    expect(secondUserAccount.id).not.toBe(firstUserAccount.id);
    await expect(service.listBankAccountsForUser("user-1")).resolves.toHaveLength(1);
    await expect(service.listBankAccountsForUser("user-2")).resolves.toHaveLength(1);
  });

  it("lists only the User's Bank Accounts ordered by Account Product", async () => {
    const service = createLiveBankAccountService(createDb(env.DB));
    await service.ensureBankAccountForUser({
      userId: "user-1",
      bankAccount: primaryAccount,
    });
    await service.ensureBankAccountForUser({
      userId: "user-1",
      bankAccount: savingsAccount,
    });
    await service.ensureBankAccountForUser({
      userId: "user-2",
      bankAccount: {
        ...primaryAccount,
        iban: "PL33102040270000110221038298",
      },
    });

    const accounts = await service.listBankAccountsForUser("user-1");

    expect(accounts.map((account) => account.accountProduct)).toEqual([
      "PKO KONTO OSZCZEDNOSCIOWE",
      "PKO KONTO ZA ZERO",
    ]);
    expect(accounts.every((account) => account.userId === "user-1")).toBe(true);
  });

  it("returns a User-owned Bank Account summary and rejects accounts outside the User Boundary", async () => {
    const service = createLiveBankAccountService(createDb(env.DB));
    const account = await service.ensureBankAccountForUser({
      userId: "user-1",
      bankAccount: primaryAccount,
    });

    await expect(
      service.getBankAccountForUser({
        userId: "user-1",
        bankAccountId: account.id,
      }),
    ).resolves.toMatchObject({
      id: account.id,
      userId: "user-1",
      transactionCount: 0,
    });
    await expect(
      service.getBankAccountForUser({
        userId: "user-2",
        bankAccountId: account.id,
      }),
    ).rejects.toThrow("Bank account not found");
  });

  it("includes Transaction counts in Bank Account summaries", async () => {
    const db = createDb(env.DB);
    const service = createLiveBankAccountService(db);
    const account = await service.ensureBankAccountForUser({
      userId: "user-1",
      bankAccount: primaryAccount,
    });

    await db.insert(transactions).values([
      {
        id: crypto.randomUUID(),
        userId: "user-1",
        bankAccountId: account.id,
        statementImportId: "statement-import-1",
        operationId: "operation-1",
        bookedAt: "2026-02-10",
        valuedAt: "2026-02-10",
        operationType: "PRZELEW PRZYCHODZACY",
        amountMinor: 12_300,
        balanceAfterMinor: 12_300,
        description: "Incoming transfer",
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        userId: "user-1",
        bankAccountId: account.id,
        statementImportId: "statement-import-1",
        operationId: "operation-2",
        bookedAt: "2026-02-11",
        valuedAt: "2026-02-11",
        operationType: "PLATNOSC KARTA",
        amountMinor: -4_500,
        balanceAfterMinor: 7_800,
        description: "Card payment",
        createdAt: new Date().toISOString(),
      },
    ]);

    const listResult = await service.listBankAccountsForUser("user-1");
    const getResult = await service.getBankAccountForUser({
      userId: "user-1",
      bankAccountId: account.id,
    });

    expect(listResult[0]).toMatchObject({ id: account.id, transactionCount: 2 });
    expect(getResult.transactionCount).toBe(2);
  });
});
