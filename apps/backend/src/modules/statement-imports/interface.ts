import type { BankAccountSummary } from "../bank-accounts/interface";
import type { ParsedBankStatement } from "../statements/interface";

export interface StatementImport {
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
  readonly parsed: ParsedBankStatement;
}

export interface ImportStatementResult {
  readonly status: "imported" | "duplicate";
  readonly importId: string;
  readonly importedTransactionCount: number;
  readonly account: BankAccountSummary;
  readonly statement: ParsedBankStatement["statement"];
}

export interface StatementImportsService {
  /**
   * Imports one parsed bank statement into the User's Budget Data.
   * Returns a duplicate result when the file hash or statement identity was already imported.
   */
  importBankStatement(input: ImportStatementInput): Promise<ImportStatementResult>;

  /**
   * Lists statement import history for the User, ordered by creation time descending.
   */
  listStatementImportsForUser(userId: string): Promise<readonly StatementImport[]>;
}
