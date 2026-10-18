// Checks a browser test makes of the whole screen: text that must never reach the player.
import { expect, type Page } from "@playwright/test";

/** What is wrong, as the failure says it, and the text that shows it. */
export type Broken = readonly [string, RegExp];

/** A raw object and a missing value, wrong on every screen. */
export const NEVER_SHOWN: readonly Broken[] = [
  ["a raw object", /\[object Object\]/],
  ["a missing value", /\bundefined\b|\bNaN\b/],
];

/** A game words key (a line, the interface, a rejection) with no words for it. */
export const NO_WORDS: Broken = ["a words key with no words", /\b(?:line|ui|reject)\.[a-z-]+\.[a-z-]+/];

/** The page's text as the player could read it. */
export async function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.textContent);
}

/** None of `broken` on screen; `when` says where the test stands, `read` reads the text looked through. */
export async function expectNothingBroken(page: Page, when: string, broken: readonly Broken[], read: (page: Page) => Promise<string> = bodyText): Promise<void> {
  const shown = await read(page);
  for (const [what, pattern] of broken) expect(shown.match(pattern)?.[0], `${what} on screen ${when}`).toBeUndefined();
}
