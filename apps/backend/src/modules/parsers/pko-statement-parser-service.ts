import type { ParsedBankStatement } from "../statements/interface";
import type { TransactionDetails } from "../transactions/interface";
import type { StatementParserService } from "./interface";

interface TextItem {
  readonly str: string;
  readonly transform: readonly number[];
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfWorker = typeof import("pdfjs-dist/legacy/build/pdf.worker.mjs");

const transactionPattern =
  /^(\d{2}\.\d{2}\.\d{4})\s+(\S+)\s+(.+?)\s+(-?[\d ]+,\d{2})\s+(-?[\d ]+,\d{2})$/;
const dateLinePattern = /^(\d{2}\.\d{2}\.\d{4})(?:\s+(.*))?$/;

export function createLivePkoStatementParserService(): StatementParserService {
  return {
    async parsePkoBankStatementPdf(pdf) {
      const text = await extractPdfText(pdf);
      const lines = text
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      const period = requireMatch(
        text,
        /WYCIĄG za okres\s+(\d{2}\.\d{2}\.\d{4})\s+-\s+(\d{2}\.\d{2}\.\d{4})/,
        "statement period",
      );
      const statement = requireMatch(
        text,
        /Nr:\s*([0-9]+\/[0-9]{4})\s+Data:\s*(\d{2}\.\d{2}\.\d{4})/,
        "statement number",
      );
      const iban = requireMatch(text, /Nr IBAN:\s*([A-Z]{2}\s*\d{2}(?:\s*\d{4}){6})/, "IBAN").at(
        1,
      );
      const accountProduct = requireMatch(text, /Rodzaj rachunku:\s*([^\n]+)/, "account product").at(
        1,
      );
      const currency = requireMatch(text, /Waluta rachunku:\s*([A-Z]{3})/, "currency").at(1);

      if (!iban || !accountProduct || !currency) {
        throw new Error("Missing account fields");
      }

      return {
        account: {
          bankName: "PKO BP SA",
          iban: normalizeIban(iban),
          accountProduct: accountProduct.trim(),
          currency,
        },
        statement: {
          number: requiredGroup(statement, 1),
          issuedAt: parsePolishDate(requiredGroup(statement, 2)),
          periodFrom: parsePolishDate(requiredGroup(period, 1)),
          periodTo: parsePolishDate(requiredGroup(period, 2)),
        },
        transactions: parseTransactions(lines),
      };
    },
  };
}

export function createTestStatementParserService(
  parsedStatement: ParsedBankStatement,
): StatementParserService {
  return {
    async parsePkoBankStatementPdf() {
      return parsedStatement;
    },
  };
}

async function extractPdfText(pdf: Uint8Array): Promise<string> {
  installPdfRuntimePolyfills();
  const pdfjs: PdfJs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker: PdfWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  (globalThis as typeof globalThis & { pdfjsWorker?: PdfWorker }).pdfjsWorker = worker;
  const data = new Uint8Array(pdf.byteLength);
  data.set(pdf);
  const document = await pdfjs.getDocument({ data, useWorkerFetch: false }).promise;
  const pages = await Promise.all(
    Array.from({ length: document.numPages }, async (_, pageIndex) => {
      const page = await document.getPage(pageIndex + 1);
      const content = await page.getTextContent();
      const rows: Array<{ y: number; items: TextItem[] }> = [];

      for (const rawItem of content.items) {
        const item = rawItem as TextItem;
        if (!item.str.trim()) {
          continue;
        }

        const y = Math.round(item.transform[5] ?? 0);
        const existingRow = rows.find((row) => Math.abs(row.y - y) <= 2);

        if (existingRow) {
          existingRow.items.push(item);
        } else {
          rows.push({ y, items: [item] });
        }
      }

      rows.sort((left, right) => right.y - left.y);
      return rows
        .map((row) =>
          row.items
            .slice()
            .sort((left, right) => (left.transform[4] ?? 0) - (right.transform[4] ?? 0))
            .map((item) => item.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter(Boolean)
        .join("\n");
    }),
  );

  return pages.join("\n");
}

function installPdfRuntimePolyfills() {
  const runtime = globalThis as typeof globalThis & {
    DOMMatrix?: typeof MinimalDOMMatrix;
    ImageData?: typeof MinimalImageData;
    Path2D?: typeof MinimalPath2D;
  };

  runtime.DOMMatrix ??= MinimalDOMMatrix;
  runtime.ImageData ??= MinimalImageData;
  runtime.Path2D ??= MinimalPath2D;
}

class MinimalDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  is2D = true;
  isIdentity = true;

  constructor(init?: string | readonly number[]) {
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }

  multiply() {
    return this;
  }

  translate() {
    return this;
  }

  scale() {
    return this;
  }
}

class MinimalImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
}

class MinimalPath2D {}

function parseTransactions(lines: readonly string[]): TransactionDetails[] {
  const transactions: TransactionDetails[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const row = line ? transactionPattern.exec(line) : null;

    if (!row) {
      continue;
    }

    const valueLine = dateLinePattern.exec(lines[index + 1] ?? "");

    if (!valueLine) {
      throw new Error(`Missing value date for operation ${requiredGroup(row, 2)}`);
    }

    const descriptionLines = [valueLine[2] ?? ""].filter(Boolean);
    let cursor = index + 2;

    while (cursor < lines.length) {
      const line = lines[cursor];

      if (!line || transactionPattern.test(line) || isNonDescriptionLine(line)) {
        break;
      }

      descriptionLines.push(line);
      cursor += 1;
    }

    transactions.push({
      operationId: requiredGroup(row, 2),
      bookedAt: parsePolishDate(requiredGroup(row, 1)),
      valuedAt: parsePolishDate(requiredGroup(valueLine, 1)),
      operationType: requiredGroup(row, 3),
      amountMinor: parseMoneyMinor(requiredGroup(row, 4)),
      balanceAfterMinor: parseMoneyMinor(requiredGroup(row, 5)),
      description: descriptionLines.join(" ").replace(/\s+/g, " ").trim(),
    });
  }

  if (transactions.length === 0) {
    throw new Error("No PKO transactions found");
  }

  return transactions;
}

function isNonDescriptionLine(line: string): boolean {
  return (
    line.startsWith("Saldo ") ||
    line.startsWith("strona ") ||
    line.startsWith("www.pkobp.pl") ||
    line.startsWith("WYCIĄG ") ||
    line.startsWith("Nr rachunku/karty:") ||
    line.startsWith("Nr: ") ||
    line.startsWith("Data operacji ") ||
    line.startsWith("Data waluty ") ||
    line.startsWith("Niniejszy dokument ") ||
    line.startsWith("Powszechna Kasa ") ||
    line.startsWith("Sąd Rejonowy ") ||
    line.startsWith("NIP: ") ||
    line.startsWith("Informacja o Bankowym Funduszu Gwarancyjnym") ||
    line.startsWith("Środki na rachunku ") ||
    line.startsWith("Szczegółowy zakres ") ||
    line.startsWith("Zadbaj o wygodę ") ||
    line.startsWith("Po każdej zrobionej ") ||
    line.startsWith("Jeśli korzystasz ") ||
    line.startsWith("Aby korzystać ") ||
    line.startsWith("Podstawa prawna: ")
  );
}

function requireMatch(text: string, pattern: RegExp, label: string): RegExpExecArray {
  const match = pattern.exec(text);

  if (!match) {
    throw new Error(`Missing ${label}`);
  }

  return match;
}

function requiredGroup(match: RegExpExecArray, index: number): string {
  const value = match[index];

  if (!value) {
    throw new Error(`Missing match group ${index}`);
  }

  return value;
}

function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function parsePolishDate(value: string): string {
  const [day, month, year] = value.split(".");

  return `${year}-${month}-${day}`;
}

function parseMoneyMinor(value: string): number {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");

  return Math.round(Number(normalized) * 100);
}
