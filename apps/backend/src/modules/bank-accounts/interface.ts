export interface BankAccountDetails {
  readonly bankName: string;
  readonly iban: string;
  readonly accountProduct: string;
  readonly currency: string;
}

export interface BankAccount extends BankAccountDetails {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BankAccountSummary extends BankAccount {
  readonly transactionCount: number;
}

export interface EnsureBankAccountInput {
  readonly userId: string;
  readonly bankAccount: BankAccountDetails;
}

export interface GetBankAccountInput {
  readonly userId: string;
  readonly bankAccountId: string;
}

export interface BankAccountsService {
  /**
   * Lists Bank Accounts owned by the User, ordered by Account Product.
   * Each result includes the current Transaction count for that Bank Account.
   */
  listBankAccountsForUser(userId: string): Promise<readonly BankAccountSummary[]>;

  /**
   * Finds the User's Bank Account by IBAN or creates it from imported statement details.
   * Existing Bank Accounts are returned unchanged.
   */
  ensureBankAccountForUser(input: EnsureBankAccountInput): Promise<BankAccount>;

  /**
   * Returns one Bank Account owned by the User with its current Transaction count.
   * Throws when the Bank Account does not exist inside the User Boundary.
   */
  getBankAccountForUser(input: GetBankAccountInput): Promise<BankAccountSummary>;
}
