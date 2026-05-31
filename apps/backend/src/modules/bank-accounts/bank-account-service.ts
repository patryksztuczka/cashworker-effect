import { and, eq } from "drizzle-orm";

import type { createDb } from "../../db/client";
import { bankAccounts, transactions } from "../../db/schema";
import type { TransactionsService } from "../transactions/interface";
import type { BankAccount, BankAccountSummary, BankAccountsService } from "./interface";

type Db = ReturnType<typeof createDb>;

interface TestBankAccountServiceOptions {
  readonly initialBankAccounts?: readonly BankAccount[];
  readonly transactionsService?: TransactionsService;
  readonly now?: () => string;
  readonly createId?: () => string;
}

export function createLiveBankAccountService(db: Db): BankAccountsService {
  return {
    async listBankAccountsForUser(userId) {
      const rows = await db.query.bankAccounts.findMany({
        where: eq(bankAccounts.userId, userId),
        orderBy: bankAccounts.accountProduct,
      });

      return Promise.all(
        rows.map(async (account) => {
          const transactionRows = await db.query.transactions.findMany({
            where: and(eq(transactions.userId, userId), eq(transactions.bankAccountId, account.id)),
          });

          return { ...account, transactionCount: transactionRows.length };
        }),
      );
    },
    async ensureBankAccountForUser(input) {
      const existing = await db.query.bankAccounts.findFirst({
        where: and(
          eq(bankAccounts.userId, input.userId),
          eq(bankAccounts.iban, input.bankAccount.iban),
        ),
      });

      if (existing) {
        return existing;
      }

      const now = new Date().toISOString();
      const account = {
        id: crypto.randomUUID(),
        userId: input.userId,
        iban: input.bankAccount.iban,
        accountProduct: input.bankAccount.accountProduct,
        currency: input.bankAccount.currency,
        bankName: input.bankAccount.bankName,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(bankAccounts).values(account);

      return account;
    },
    async getBankAccountForUser(input) {
      const account = await db.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.userId, input.userId), eq(bankAccounts.id, input.bankAccountId)),
      });

      if (!account) {
        throw new Error("Bank account not found");
      }

      const rows = await db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, input.userId),
          eq(transactions.bankAccountId, input.bankAccountId),
        ),
      });

      return { ...account, transactionCount: rows.length };
    },
  };
}

export function createTestBankAccountService(
  options: TestBankAccountServiceOptions = {},
): BankAccountsService {
  const accounts = new Map(
    (options.initialBankAccounts ?? []).map((account) => [account.id, account]),
  );
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? (() => crypto.randomUUID());
  const transactionsService = options.transactionsService;

  return {
    async listBankAccountsForUser(userId) {
      const rows = [...accounts.values()]
        .filter((account) => account.userId === userId)
        .sort((left, right) => left.accountProduct.localeCompare(right.accountProduct));

      return Promise.all(
        rows.map(async (account): Promise<BankAccountSummary> => {
          const transactionCount = transactionsService
            ? (
                await transactionsService.listTransactionsForBankAccount({
                  userId,
                  bankAccountId: account.id,
                })
              ).length
            : 0;

          return { ...account, transactionCount };
        }),
      );
    },
    async ensureBankAccountForUser(input) {
      const existing = [...accounts.values()].find(
        (account) => account.userId === input.userId && account.iban === input.bankAccount.iban,
      );

      if (existing) {
        return existing;
      }

      const timestamp = now();
      const account: BankAccount = {
        id: createId(),
        userId: input.userId,
        iban: input.bankAccount.iban,
        accountProduct: input.bankAccount.accountProduct,
        currency: input.bankAccount.currency,
        bankName: input.bankAccount.bankName,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      accounts.set(account.id, account);

      return account;
    },
    async getBankAccountForUser(input) {
      const account = accounts.get(input.bankAccountId);

      if (!account || account.userId !== input.userId) {
        throw new Error("Bank account not found");
      }

      const transactionCount = transactionsService
        ? (
            await transactionsService.listTransactionsForBankAccount({
              userId: input.userId,
              bankAccountId: account.id,
            })
          ).length
        : 0;

      return { ...account, transactionCount };
    },
  };
}
