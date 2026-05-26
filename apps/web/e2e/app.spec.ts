import { expect, test } from "@playwright/test";

test("loads the home route", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Statement import" })).toBeVisible();
  await expect(page.getByLabel("Upload PKO BP PDF statement")).toBeVisible();
  await expect(page.getByRole("button", { name: "Import statement" })).toBeVisible();
});
