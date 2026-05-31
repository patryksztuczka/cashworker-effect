export interface TransactionDetails {
  readonly operationId: string;
  readonly bookedAt: string;
  readonly valuedAt: string;
  readonly operationType: string;
  readonly amountMinor: number;
  readonly balanceAfterMinor: number;
  readonly description: string;
}

export interface Transaction extends TransactionDetails {
  readonly id: string;
  readonly userId: string;
  readonly bankAccountId: string;
  readonly statementImportId: string;
  readonly createdAt: string;
}

export interface ListBankAccountTransactionsInput {
  readonly userId: string;
  readonly bankAccountId: string;
}

export interface RecordStatementTransactionsInput {
  readonly userId: string;
  readonly bankAccountId: string;
  readonly statementImportId: string;
  readonly transactions: readonly TransactionDetails[];
}

export interface TransactionsService {
  /**
   * Lists Transactions for one Bank Account owned by the User, ordered by Booked Date descending.
   */
  listTransactionsForBankAccount(
    input: ListBankAccountTransactionsInput,
  ): Promise<readonly Transaction[]>;

  /**
   * Records Transactions imported from one statement.
   * Duplicate Operation Identifiers for the same Bank Account are ignored by the implementation.
   */
  recordTransactionsForStatementImport(
    input: RecordStatementTransactionsInput,
  ): Promise<readonly Transaction[]>;
}
