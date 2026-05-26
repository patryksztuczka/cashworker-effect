import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { AppLayout } from "./app-layout";
import { HomeRoute } from "./home";

describe("HomeRoute", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the import workspace with accounts and import history from the API", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url === "/api/accounts") {
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

      if (url === "/api/imports") {
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

      if (url === "/api/accounts/account-1/transactions") {
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

    expect(screen.getByRole("heading", { name: "Statement import" })).toBeInTheDocument();
    expect(screen.getByLabelText("Upload PKO BP PDF statement")).toBeInTheDocument();
    expect(await screen.findAllByText("PKO KONTO ZA ZERO")).toHaveLength(2);
    expect(screen.getByText("35 entries")).toBeInTheDocument();
    expect(screen.getByText("Statement 1/2026")).toBeInTheDocument();
    expect(screen.getByText("JMP S.A. BIEDRONKA 4159 POZNAN PL")).toBeInTheDocument();
  });
});
