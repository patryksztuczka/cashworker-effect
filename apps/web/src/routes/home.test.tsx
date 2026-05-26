import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { queryClient } from "../query-client";
import { AppLayout } from "./app-layout";
import { HomeRoute } from "./home";

describe("HomeRoute", () => {
  it("renders the application shell", async () => {
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

    expect(screen.getByText("Cashworker")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Check backend health" })).toBeInTheDocument();
  });
});
