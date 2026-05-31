import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { AppLayout } from "./app-layout";
import { HomeRoute } from "./home";

function renderHomeRoute() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <AppLayout>
          <HomeRoute />
        </AppLayout>
      ),
    },
  ]);

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("HomeRoute", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the import workspace with accounts and import history from the API", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url === "/api/v1/accounts") {
        return Response.json({
          accounts: [
            {
              id: "account-1",
              iban: "PL50102040270000110221038296",
              accountProduct: "PKO KONTO ZA ZERO",
              currency: "PLN",
              bankName: "PKO BP SA",
              transactionCount: 35,
            },
          ],
        });
      }

      if (url === "/api/v1/imports") {
        return Response.json({
          imports: [
            {
              id: "import-1",
              status: "imported",
              statementNumber: "1/2026",
              periodFrom: "2026-01-12",
              periodTo: "2026-02-12",
              importedTransactionCount: 35,
              createdAt: "2026-05-26T12:00:00.000Z",
            },
          ],
        });
      }

      if (url === "/api/v1/accounts/account-1/transactions") {
        return Response.json({
          transactions: [
            {
              id: "transaction-1",
              operationId: "6542MX95120208116",
              bookedAt: "2026-02-11",
              valuedAt: "2026-02-09",
              operationType: "ZAKUP PRZY UŻYCIU KARTY",
              amountMinor: -9412,
              balanceAfterMinor: 201692,
              description: "Karta:425125******6501 Lokalizacja: JMP S.A. BIEDRONKA 4159 POZNAN PL",
            },
          ],
        });
      }

      return Response.json({ error: "unexpected request" }, { status: 500 });
    });

    renderHomeRoute();

    expect(screen.getByRole("heading", { name: "Statement import" })).toBeInTheDocument();
    expect(screen.getByLabelText("Upload PKO BP PDF statement")).toBeInTheDocument();
    expect(await screen.findAllByText("PKO KONTO ZA ZERO")).toHaveLength(2);
    expect(screen.getByText("35 entries")).toBeInTheDocument();
    expect(screen.getByText("Statement 1/2026")).toBeInTheDocument();
    expect(screen.getByText("JMP S.A. BIEDRONKA 4159 POZNAN PL")).toBeInTheDocument();
  });

  it("posts statement uploads to the versioned imports API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);

      if (url === "/api/v1/accounts") {
        return Response.json({ accounts: [] });
      }

      if (url === "/api/v1/imports" && init?.method === "POST") {
        return Response.json(
          {
            status: "imported",
            importedTransactionCount: 1,
            account: {
              id: "account-1",
              iban: "PL00102000000000000000000000",
              accountProduct: "PKO KONTO ZA ZERO",
              currency: "PLN",
              bankName: "PKO BP SA",
              transactionCount: 1,
            },
            statement: {
              number: "1/2026",
              periodFrom: "2026-01-12",
              periodTo: "2026-02-12",
            },
          },
          { status: 201 },
        );
      }

      if (url === "/api/v1/imports") {
        return Response.json({ imports: [] });
      }

      if (url === "/api/v1/accounts/account-1/transactions") {
        return Response.json({ transactions: [] });
      }

      return Response.json({ error: "unexpected request" }, { status: 500 });
    });

    renderHomeRoute();

    fireEvent.change(screen.getByLabelText("Upload PKO BP PDF statement"), {
      target: {
        files: [new File(["%PDF"], "statement.pdf", { type: "application/pdf" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import statement" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => String(url) === "/api/v1/imports" && init?.method === "POST",
        ),
      ).toBe(true);
    });
  });
});
