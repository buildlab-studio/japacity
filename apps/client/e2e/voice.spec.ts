import { join } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

// The visa interview, spoken (docs/design/06-audio.md, section 7), inside a faked in-app browser:
// most players arrive through one. Ada's recorded life is loaded just as her application went in.
import { setpieceVoice, text } from "../../../packages/content/src/index";
import { lifeSaves } from "../../../packages/sim/src/goldens/lives.data";

const VOICED = "setpiece.credibility-interview";
const PREVIEW = process.env.PREVIEW_DIR;

/** Instagram's browser inside its Android app, and Facebook's inside its iPhone app. */
const IN_APP = {
  instagram:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 Instagram 334.0.0.42.95 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 7; panther; panther; en_US; 606558468)",
  facebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.104;FBBV/612345678;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]",
} as const;

/** Ada's recorded life up to the interview's first answer: the application has just gone in. */
function adaAtInterview(): string {
  const save = lifeSaves["ada-careful"];
  if (save === undefined) throw new Error("No recorded life ada-careful.");
  const first = save.commands.findIndex((entry) => entry.command.type === "setpiece/answer");
  return JSON.stringify({ save: { ...save, commands: save.commands.slice(0, first) }, clock: { anchor: 0 } });
}

async function seed(page: Page, options: { saveData?: boolean } = {}): Promise<string[]> {
  const voice: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/voice/")) voice.push(path);
  });
  await page.addInitScript(
    ({ stored, saveData }) => {
      if (sessionStorage.getItem("seeded") === null) {
        localStorage.setItem("japacity.save", stored);
        sessionStorage.setItem("seeded", "1");
      }
      if (saveData) Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
    },
    { stored: adaAtInterview(), saveData: options.saveData === true },
  );
  await page.goto("/?classic");
  return voice;
}

async function shoot(page: Page, name: string, project: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "") return;
  const size = project.startsWith("Pixel") ? "phone" : "desktop";
  await page.screenshot({ path: join(PREVIEW, `${name}-${size}.png`), fullPage: false });
}

function room(page: Page): Locator {
  return page.locator(`[data-scene='${VOICED}']`);
}

/** True when the two boxes share any pixel. */
function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The notice, while shown, covers neither the question nor any answer. */
async function expectNoticeClear(page: Page): Promise<void> {
  const notice = page.locator("[data-sound-notice][data-notice-here] > *");
  if ((await notice.count()) === 0) return;
  const box = await notice.boundingBox();
  if (box === null) return;
  for (const part of await room(page).locator("[data-officer] p, [data-answers='open'] button").all()) {
    const other = await part.boundingBox();
    if (other !== null) expect(overlaps(box, other), "the notice covers the question or an answer").toBe(false);
  }
}

/** Answers each question with its first answer, as soon as the answers are there, until the closing line. */
async function answerThrough(page: Page): Promise<void> {
  for (let guard = 0; guard < 8; guard += 1) {
    if ((await page.locator("[data-room='closing']").count()) > 0) return;
    const answers = room(page).locator("[data-answers='open']");
    await expect(answers).toBeVisible({ timeout: 10_000 });
    await expectNoticeClear(page);
    await answers.getByRole("button").first().click();
  }
}

for (const [app, userAgent] of Object.entries(IN_APP)) {
  test.describe(`inside ${app}'s browser`, () => {
    test.use({ userAgent });

    test("the interview is entered with a tap, spoken and shown, never waits on sound, and ends on the flat closing line", async ({ page }, info) => {
      const voice = await seed(page);
      const lobby = room(page);
      await expect(lobby.getByRole("button", { name: "Enter the interview room" })).toBeVisible();
      await lobby.scrollIntoViewIfNeeded();
      await shoot(page, `interview-lobby-${app}`, info.project.name);
      await lobby.getByRole("button", { name: "Enter the interview room" }).click();
      await expect(room(page).getByText(text[`${VOICED}.officer.greet`]!)).toBeVisible();
      // Sound plays, or the browser held it back and says so: either way the text is the scene.
      await expect(page.locator("[data-sound-notice][data-notice-here]")).toHaveAttribute("data-sound-notice", /^(on|blocked)$/);
      await expectNoticeClear(page);
      await shoot(page, `interview-room-${app}`, info.project.name);
      await answerThrough(page);
      await expect(page.locator("[data-room='closing']")).toContainText(text[`${VOICED}.officer.close`]!);
      await shoot(page, `interview-closing-${app}`, info.project.name);
      await page.getByRole("button", { name: "Leave the room" }).click();
      await expect(room(page)).toHaveCount(0);
      // Only this interview's clips, in one format.
      const known = new Set(Object.values(setpieceVoice).map((clip) => clip.clip));
      expect(voice.length).toBeGreaterThan(0);
      for (const path of voice) expect(known.has(path.replace(/^\/voice\//, "").replace(/\.(opus|mp3)$/, "")), path).toBe(true);
      expect(new Set(voice.map((path) => path.split(".").at(-1))).size).toBe(1);
    });
  });
}

test.describe("saving data", () => {
  test.use({ userAgent: IN_APP.instagram });

  test("with data-saver on, nothing is fetched, the notice says why, and the interview plays in text", async ({ page }, info) => {
    const voice = await seed(page, { saveData: true });
    await room(page).getByRole("button", { name: "Enter the interview room" }).click();
    await expect(page.locator("[data-sound-notice][data-notice-here]")).toHaveAttribute("data-sound-notice", "saver");
    await expect(room(page).locator("[data-answers='open']")).toBeVisible();
    await expectNoticeClear(page);
    await shoot(page, "interview-saver", info.project.name);
    await answerThrough(page);
    await expect(page.locator("[data-room='closing']")).toBeVisible();
    expect(voice).toEqual([]);
  });
});

test.describe("muted", () => {
  test("muted from the room's switch, nothing is fetched from then on, and the switch is remembered after a reload", async ({ page }) => {
    const voice = await seed(page);
    await room(page).getByRole("button", { name: "Mute the sound" }).click();
    const before = voice.length;
    await room(page).getByRole("button", { name: "Enter the interview room" }).click();
    await expect(room(page).locator("[data-answers='open']")).toBeVisible();
    await page.reload();
    await expect(room(page).getByRole("button", { name: "Turn the sound on" })).toHaveAttribute("aria-pressed", "true");
    expect(voice.length).toBe(before);
  });
});
