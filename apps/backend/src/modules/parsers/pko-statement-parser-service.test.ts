import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createLivePkoStatementParserService } from "./pko-statement-parser-service";

const pkoStatementPdfUrl = new URL(
  "../../../../../docs/Wyciag_1_50102040270000110221038296_20260212662989201.pdf",
  import.meta.url,
);
const pkoStatementPdfPath = fileURLToPath(pkoStatementPdfUrl.href);

describe("PKO statement parser", () => {
  it("extracts account, statement metadata, and transactions from a real PKO PDF", async () => {
    const pdf = await readFile(pkoStatementPdfPath);

    const statement = await createLivePkoStatementParserService().parsePkoBankStatementPdf(pdf);

    expect(statement.account).toEqual({
      bankName: "PKO BP SA",
      iban: "PL00102000000000000000000000",
      accountProduct: "PKO KONTO ZA ZERO",
      currency: "PLN",
    });
    expect(statement.statement).toEqual({
      number: "1/2026",
      issuedAt: "2026-02-12",
      periodFrom: "2026-01-12",
      periodTo: "2026-02-12",
    });
    expect(statement.transactions).toHaveLength(35);
    const openingEntry = statement.transactions[0]!;
    const incomingTransfer = statement.transactions[1]!;

    expect(openingEntry).toEqual({
      operationId: "6512BG06100933174",
      bookedAt: "2026-01-12",
      valuedAt: "2026-01-12",
      operationType: "OTWARCIE RACHUNKU",
      amountMinor: 0,
      balanceAfterMinor: 0,
      description: "",
    });
    expect(incomingTransfer).toMatchObject({
      operationId: "6512FE01100330425",
      operationType: "PRZELEW PRZYCHODZĄCY",
      amountMinor: 50_000,
      balanceAfterMinor: 50_000,
    });
    expect(incomingTransfer.description).toContain("ANNA MARIA NOWAK");
  });
});
