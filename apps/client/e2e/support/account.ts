// A life past its first chapter on a faked server, for the specs that open the account's sheets (guest.spec.ts,
// sheets.spec.ts): the guest and the life saved with Google, the view the server answers, and the way past the second
// chapter's card, which the asks wait for (account:guest-secures-the-life).
import { start } from "@japacity/sim/testing";

import { expect, type Page } from "@playwright/test";

import { content } from "../../../../packages/content/src/index";
import { accountView } from "../../src/shared/testing/fixtures";
import { type Answer, clockAt } from "./api";

export const CLOCK = clockAt(3);
export const GUEST = accountView({ id: "account-guest", state: "guest" });
/** The same life once kept with Google: Google's address is the code's address too (GET /api/account's ways). */
export const KEPT_WITH_GOOGLE = { ...GUEST, state: "secured", ways: { google: "ada@example.com", email: "ada@example.com", passkeys: 0 } };

/**
 * The second chapter's mission card opens over the world as it loads, handed by its person (docs/design/09-the-games-look.md section 4);
 * the asks wait until its Let's go is pressed (account:guest-secures-the-life).
 */
export async function pastTheCard(page: Page): Promise<void> {
  const card = page.locator("[data-brief='chapter.build-the-file']");
  await expect(card).toBeVisible({ timeout: 20_000 });
  // The keep-this-life ask never stands over the card (account:guest-secures-the-life: never over a moment or another card that is up).
  await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog", { name: "Save this life" })).toHaveCount(0);
  await card.getByRole("button", { name: "Let's go" }).click();
  await expect(card).toHaveCount(0);
}

/** A guest's life past its first chapter, so the early win is in and the first ask is due. */
export function pastFirstChapter(): Answer {
  const game = start({ scenario: "scenario.banker", content });
  game.grant(1);
  const view = game.view();
  // The file's own items, none met yet: the first chapter's items under the file's id would name steps it does not have.
  const items = (content.chapter["chapter.build-the-file"]?.items ?? []).map((item) => ({ id: item.id, met: false }));
  return { body: { ok: true, view: { ...view, chapter: { ...view.chapter, done: ["chapter.find-your-feet"], current: "chapter.build-the-file", items } }, lines: [], clock: CLOCK } };
}
