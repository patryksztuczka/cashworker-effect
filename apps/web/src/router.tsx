import { createBrowserRouter } from "react-router";

import { AppLayout } from "./routes/app-layout";
import { HomeRoute } from "./routes/home";

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AppLayout>
        <HomeRoute />
      </AppLayout>
    ),
  },
]);
