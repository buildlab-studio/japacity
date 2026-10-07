import { expect, test } from "@playwright/test";

test("a new player picks a life, ends a month and reads the report", async ({ page }) => {
  await page.goto("/");

  // A fresh browser has no save, so the life chooser comes first.
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await page.getByRole("button", { name: /^Live this life/ }).first().click();

  await expect(page.getByRole("heading", { name: "Month 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "End month" }).click();

  const report = page.getByRole("dialog");
  await expect(report).toBeVisible();
  await expect(report.getByRole("heading", { name: "Month 1" })).toBeVisible();
  await expect(report.getByText(/^Japacity: /)).toBeVisible();

  await report.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Month 2", exact: true })).toBeVisible();

  // The life survives a reload.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Month 2", exact: true })).toBeVisible();
});
