import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  FileClock,
  FileText,
  History,
  Landmark,
  Loader2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Account {
  readonly id: string;
  readonly iban: string;
  readonly accountProduct: string;
  readonly currency: string;
  readonly bankName: string;
  readonly transactionCount: number;
}

interface Transaction {
  readonly id: string;
  readonly operationId: string;
  readonly bookedAt: string;
  readonly valuedAt: string;
  readonly operationType: string;
  readonly amountMinor: number;
  readonly balanceAfterMinor: number;
  readonly description: string;
}

interface ImportHistoryItem {
  readonly id: string;
  readonly status: "imported" | "duplicate" | "failed";
  readonly statementNumber: string;
  readonly periodFrom: string;
  readonly periodTo: string;
  readonly importedTransactionCount: number;
  readonly errorMessage?: string | null;
  readonly createdAt: string;
}

interface ImportResult {
  readonly status: "imported" | "duplicate";
  readonly importedTransactionCount: number;
  readonly account: Account;
  readonly statement: {
    readonly number: string;
    readonly periodFrom: string;
    readonly periodTo: string;
  };
}

const API_BASE_PATH = "/api/v1";

function apiPath(path: string) {
  return `${API_BASE_PATH}${path}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function uploadStatement(file: File): Promise<ImportResult> {
  const body = new FormData();
  body.set("statement", file);

  const response = await fetch(apiPath("/imports"), {
    method: "POST",
    body,
  });

  const payload = (await readJsonResponse(response)) as ImportResult | { error: string } | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload ? payload.error : `Statement import failed: ${response.status}`,
    );
  }

  if (!payload) {
    throw new Error("Statement import failed");
  }

  return payload as ImportResult;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function HomeRoute() {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: () => fetchJson<{ accounts: Account[] }>(apiPath("/accounts")),
  });
  const importsQuery = useQuery({
    queryKey: ["imports"],
    queryFn: () => fetchJson<{ imports: ImportHistoryItem[] }>(apiPath("/imports")),
  });

  const accounts = useMemo(
    () => accountsQuery.data?.accounts ?? [],
    [accountsQuery.data?.accounts],
  );
  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
  const transactionsQuery = useQuery({
    queryKey: ["transactions", selectedAccount?.id],
    queryFn: () =>
      fetchJson<{ transactions: Transaction[] }>(
        apiPath(`/accounts/${selectedAccount!.id}/transactions`),
      ),
    enabled: Boolean(selectedAccount),
  });

  useEffect(() => {
    if (!selectedAccountId && accounts[0]) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const totals = useMemo(() => {
    const transactions = transactionsQuery.data?.transactions ?? [];

    return transactions.reduce(
      (accumulator, transaction) => {
        if (transaction.amountMinor > 0) {
          accumulator.income += transaction.amountMinor;
        }

        if (transaction.amountMinor < 0) {
          accumulator.spending += Math.abs(transaction.amountMinor);
        }

        return accumulator;
      },
      { income: 0, spending: 0 },
    );
  }, [transactionsQuery.data?.transactions]);

  const importMutation = useMutation({
    mutationFn: uploadStatement,
    onSuccess: async (result) => {
      setLastImportResult(result);
      setSelectedAccountId(result.account.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["imports"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
    },
  });

  const submitImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  return (
    <section className="grid gap-5 py-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="grid content-start gap-5">
        <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-lime-100 text-lime-800">
              <Upload aria-hidden="true" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-stone-950">Statement import</h1>
              <p className="mt-1 text-sm text-stone-600">PKO BP PDF statements for the dev user.</p>
            </div>
          </div>

          <label className="mt-5 block text-sm font-medium text-stone-800" htmlFor="statement-file">
            Upload PKO BP PDF statement
          </label>
          <input
            id="statement-file"
            aria-label="Upload PKO BP PDF statement"
            className="mt-2 block w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 file:mr-3 file:rounded-sm file:border-0 file:bg-stone-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
            type="file"
            accept="application/pdf"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              importMutation.reset();
            }}
          />

          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            type="button"
            disabled={!selectedFile || importMutation.isPending}
            onClick={submitImport}
          >
            {importMutation.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" size={16} />
            ) : (
              <FileText aria-hidden="true" size={16} />
            )}
            Import statement
          </button>

          {importMutation.error ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {importMutation.error.message}
            </p>
          ) : null}

          {lastImportResult ? <ImportResultBanner result={lastImportResult} /> : null}
        </section>

        <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-stone-950">
            <Landmark aria-hidden="true" size={18} />
            <h2 className="text-base font-semibold">Accounts</h2>
          </div>

          <div className="mt-4 grid gap-2">
            {accountsQuery.isLoading ? <SkeletonRows count={2} /> : null}
            {!accountsQuery.isLoading && accounts.length === 0 ? (
              <p className="rounded-md border border-dashed border-stone-300 p-4 text-sm text-stone-600">
                Imported bank accounts will appear here.
              </p>
            ) : null}
            {accounts.map((account) => (
              <button
                key={account.id}
                className={`rounded-md border p-3 text-left transition ${
                  selectedAccount?.id === account.id
                    ? "border-lime-600 bg-lime-50"
                    : "border-stone-200 bg-stone-50 hover:border-stone-400"
                }`}
                type="button"
                onClick={() => setSelectedAccountId(account.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-stone-950">{account.accountProduct}</span>
                  <span className="text-xs font-medium text-stone-600">
                    {account.transactionCount} entries
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-600">{formatIbanTail(account.iban)}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-stone-950">
            <History aria-hidden="true" size={18} />
            <h2 className="text-base font-semibold">Import history</h2>
          </div>
          <div className="mt-4 grid gap-3">
            {importsQuery.isLoading ? <SkeletonRows count={3} /> : null}
            {!importsQuery.isLoading && (importsQuery.data?.imports.length ?? 0) === 0 ? (
              <p className="text-sm text-stone-600">No imports yet.</p>
            ) : null}
            {importsQuery.data?.imports.map((item) => (
              <div key={item.id} className="border-l-2 border-stone-300 pl-3">
                <p className="text-sm font-semibold text-stone-950">
                  Statement {item.statementNumber}
                </p>
                <p className="text-xs text-stone-600">
                  {formatDate(item.periodFrom)} to {formatDate(item.periodTo)} ·{" "}
                  {item.importedTransactionCount} entries
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="min-w-0 rounded-lg border border-stone-300 bg-white shadow-sm">
        <div className="border-b border-stone-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-stone-500">Selected account</p>
              <h2 className="mt-1 text-2xl font-semibold text-stone-950">
                {selectedAccount?.accountProduct ?? "No account imported"}
              </h2>
              {selectedAccount ? (
                <p className="mt-1 text-sm text-stone-600">
                  {selectedAccount.bankName} · {selectedAccount.currency} ·{" "}
                  {formatIbanTail(selectedAccount.iban)}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <Metric label="Income" value={formatMoney(totals.income)} tone="income" />
              <Metric label="Spending" value={formatMoney(totals.spending)} tone="spending" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold text-stone-500 uppercase">
                <th className="px-5 py-3">Booked</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactionsQuery.isLoading ? (
                <tr>
                  <td className="px-5 py-8 text-stone-600" colSpan={5}>
                    Loading transactions...
                  </td>
                </tr>
              ) : null}
              {!transactionsQuery.isLoading &&
              (transactionsQuery.data?.transactions.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-stone-600" colSpan={5}>
                    Import a statement to populate the ledger.
                  </td>
                </tr>
              ) : null}
              {transactionsQuery.data?.transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="border-b border-stone-100 align-top last:border-0"
                >
                  <td className="px-5 py-4 font-medium text-stone-950">
                    {formatDate(transaction.bookedAt)}
                  </td>
                  <td className="px-5 py-4 text-stone-700">{transaction.operationType}</td>
                  <td className="max-w-[360px] px-5 py-4">
                    <p className="font-medium text-stone-950">{transactionTitle(transaction)}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      Value {formatDate(transaction.valuedAt)} · {transaction.operationId}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Money amountMinor={transaction.amountMinor} />
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-stone-700">
                    {formatMoney(transaction.balanceAfterMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function ImportResultBanner({ result }: { readonly result: ImportResult }) {
  const isDuplicate = result.status === "duplicate";

  return (
    <div
      className={`mt-4 rounded-md border px-3 py-3 text-sm ${
        isDuplicate
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-lime-200 bg-lime-50 text-lime-900"
      }`}
    >
      <div className="flex items-start gap-2">
        {isDuplicate ? (
          <FileClock aria-hidden="true" className="mt-0.5" size={16} />
        ) : (
          <CheckCircle2 aria-hidden="true" className="mt-0.5" size={16} />
        )}
        <div>
          <p className="font-semibold">
            {isDuplicate ? "Statement already imported" : "Statement imported"}
          </p>
          <p className="mt-0.5">
            Statement {result.statement.number} · {result.importedTransactionCount} entries
          </p>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: "income" | "spending";
}) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p
        className={
          tone === "income" ? "font-semibold text-emerald-700" : "font-semibold text-red-700"
        }
      >
        {value}
      </p>
    </div>
  );
}

function Money({ amountMinor }: { readonly amountMinor: number }) {
  if (amountMinor === 0) {
    return <span className="font-semibold text-stone-500">{formatMoney(amountMinor)}</span>;
  }

  const isIncome = amountMinor > 0;

  return (
    <span
      className={`inline-flex items-center justify-end gap-1 font-semibold ${
        isIncome ? "text-emerald-700" : "text-red-700"
      }`}
    >
      {isIncome ? (
        <ArrowDownLeft aria-hidden="true" size={14} />
      ) : (
        <ArrowUpRight aria-hidden="true" size={14} />
      )}
      {formatMoney(amountMinor)}
    </span>
  );
}

function SkeletonRows({ count }: { readonly count: number }) {
  return Array.from({ length: count }, (_, index) => (
    <div key={index} className="h-12 animate-pulse rounded-md bg-stone-100" />
  ));
}

function transactionTitle(transaction: Transaction): string {
  const location = /Lokalizacja:\s*(.*?)(?:\s+Nr ref:|$)/.exec(transaction.description)?.[1];

  if (location) {
    return location;
  }

  return transaction.description || transaction.operationType;
}

function formatMoney(amountMinor: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(amountMinor / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatIbanTail(iban: string): string {
  return `IBAN ...${iban.slice(-4)}`;
}
