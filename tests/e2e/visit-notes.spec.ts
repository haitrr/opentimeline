import { test, expect } from "@playwright/test";

test.describe("Visit notes", () => {
  test("can add a note to a visit and see it rendered on the timeline", async ({ page }) => {
    await page.goto("/");

    // Open Places panel and navigate to a place with confirmed visits
    await page.getByRole("button", { name: /places/i }).first().click();
    const firstPlace = page.locator('li [role="button"][aria-label]').first();
    await firstPlace.waitFor({ state: "visible", timeout: 10000 });
    await firstPlace.click();

    // Wait for the place detail modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Find the first Edit visit button (✎) inside the dialog
    const placeDialog = page.locator('[role="dialog"]').first();
    const editBtn = placeDialog.getByRole("button", { name: /edit visit/i }).first();
    await editBtn.waitFor({ state: "visible", timeout: 5000 });
    await editBtn.click();

    // Wait for the Edit Visit dialog (nested)
    const editVisitDialog = page.getByRole("dialog", { name: /edit visit/i });
    await expect(editVisitDialog).toBeVisible({ timeout: 5000 });

    // Fill in the notes textarea
    const notesTextarea = editVisitDialog.getByLabel(/notes/i);
    await notesTextarea.fill("**Test note** from E2E");

    // Click Save scoped to the edit visit dialog
    await editVisitDialog.getByRole("button", { name: /^save$/i }).click();

    // Wait for dialog to close (allow time for API round-trip)
    await expect(editVisitDialog).not.toBeVisible({ timeout: 10000 });

    // The rendered markdown should appear in the visit card
    await expect(page.getByText("Test note from E2E")).toBeVisible({ timeout: 5000 });
  });
});
