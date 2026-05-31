import type { BankAccountDetails } from "../bank-accounts/interface";
import type { TransactionDetails } from "../transactions/interface";

export interface ParsedBankStatement {
  readonly account: BankAccountDetails;
  readonly statement: BankStatementMetadata;
  readonly transactions: readonly TransactionDetails[];
}

export interface BankStatementMetadata {
  readonly number: string;
  readonly issuedAt: string;
  readonly periodFrom: string;
  readonly periodTo: string;
}
