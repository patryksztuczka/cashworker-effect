import { expect, test } from "@playwright/test";

test("loads the home route", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /cashworker web/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check backend health" })).toBeVisible();
});
