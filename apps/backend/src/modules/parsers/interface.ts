import type { ParsedBankStatement } from "../statements/interface";

export interface StatementParserService {
  /**
   * Parses a PKO Bank Statement PDF into Cashworker Bank Account, statement, and Transaction data.
   * Throws when the PDF text does not contain the expected PKO statement structure.
   */
  parsePkoBankStatementPdf(pdf: Uint8Array): Promise<ParsedBankStatement>;
}
