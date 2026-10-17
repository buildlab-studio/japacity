// The phone's apps in the lively dress (docs/design/13-the-lively-layer.md section 2): the same apps with the same jobs,
// told in cards, tiles and chips rather than document headers and paragraphs; and the words a player reads on the phone
// never say slots, a turn, banked, pages, days left or a percentage.
import type { PlayerView } from "@japacity/sim";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { todayWords } from "../../shared/words/format";
import { resetLines } from "../../shared/world/Lines";
import { PhoneApps } from "./PhoneApps";
import { phoneWords } from "./phone.words";
import { APP_IDS, reloadSeen } from "./seen";

const NOON = () => new Date(2026, 9, 13, 12, 5);

beforeEach(() => {
  resetLines();
  localStorage.clear();
  reloadSeen();
});

async function openPhone(view: PlayerView, briefs: React.ReactNode = null) {
  return renderWithView(
    <PhoneApps onClose={() => undefined} area="Ojuelegba" now={NOON} calendar={(opening) => <div data-phone-app="calendar" data-opening={opening ?? ""} />} briefs={briefs} onMap={() => undefined} />,
    view,
  );
}

function openApp(id: string): HTMLElement {
  fireEvent.click(document.querySelector<HTMLElement>(`[data-app="${id}"]`)!);
  return document.querySelector<HTMLElement>(`[data-app-screen="${id}"]`)!;
}

function back(): void {
  fireEvent.click(document.querySelector<HTMLElement>("[data-phone-back]")!);
}

/** The words no player reads (the shared rules of the waves): the engine's counting, never the life's. */
const NEVER = /\b(slots?|turns?|banked|pages?|days left)\b|%/i;

describe("the phone in the lively dress", () => {
  test("[R-WORLD-018] given the phone opens, when its lock screen shows, then the wallpaper is the plain navy with no pattern, the day is said in words, and the place stands in a pill", async () => {
    await openPhone(engineView());
    const glass = document.querySelector<HTMLElement>("[data-phone-glass]");
    expect(glass?.className).toContain("phone-wall");
    expect(glass?.className).not.toMatch(/(?<![\w-])wall(?![\w-])/);
    expect(todayWords(NOON())).toBe("Tuesday 13 October");
    expect(document.querySelector("[data-phone-home]")?.textContent).toContain("Tuesday 13 October");
    expect(document.querySelector("[data-phone-area]")?.closest(".phone-wall-pill")).not.toBeNull();
    expect([...document.querySelectorAll("[data-app]")].every((icon) => icon.className.includes("phone-app-icon"))).toBe(true);
  });

  test("[R-WORLD-018] given each app opens, when its head shows, then it carries the app's own tile and its name on the sheet, never the navy band", async () => {
    await openPhone(richView());
    for (const id of APP_IDS) {
      openApp(id);
      const head = document.querySelector<HTMLElement>("[data-app-head]");
      expect({ id, tile: head?.querySelector("[data-app-tile]")?.getAttribute("style") ?? "" }).toEqual({ id, tile: expect.stringContaining(`--app-${id}`) as string });
      expect(head?.textContent).toContain(phoneWords(`phone.app.${id}`));
      expect(head?.className).not.toMatch(/\bband\b/);
      back();
    }
  });

  for (const [name, fixture] of [
    ["a new life", engineView],
    ["a life in the middle of an application", richView],
  ] as const) {
    test(`[R-WORLD-018] [R-TEXT-005] given ${name}, when every app opens, then nothing a player reads says slots, a turn, banked, pages, days left or a percentage`, async () => {
      await openPhone(fixture());
      for (const id of APP_IDS) {
        if (id === "bank") continue; // The Bank opens on the passbook; its words are checked there.
        const screen = openApp(id);
        expect({ id, said: NEVER.exec(screen.textContent ?? "")?.[0] ?? null }).toEqual({ id, said: null });
        back();
      }
    });
  }

  test("[R-WORLD-019] given a route in play with its figure, when Japa opens, then how ready you are is a bar that fills and no percentage is written, and the road's log the shell hands stands under the way out", async () => {
    await openPhone(richView(), <section data-test-log>log</section>);
    const japa = openApp("japa");
    const meter = japa.querySelector<HTMLElement>("[data-japa-percent] [role='meter']");
    expect(meter).not.toBeNull();
    expect(meter?.getAttribute("aria-valuenow")).toBe(japa.querySelector("[data-japa-percent]")?.getAttribute("data-japa-percent"));
    expect(japa.textContent).not.toContain("%");
    const head = japa.querySelector("[data-japa-head]");
    const log = japa.querySelector("[data-test-log]");
    expect(log).not.toBeNull();
    expect(head!.compareDocumentPosition(log!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("[R-WORLD-019] [R-WORLD-021] given a life in the middle of an application, when Papers opens, then each paper is a card with its picture and its state as a chip", async () => {
    await openPhone(richView());
    const papers = openApp("papers");
    const rows = [...papers.querySelectorAll<HTMLElement>("[data-paper]")];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelector("[data-lively-card]")).not.toBeNull();
      expect(row.querySelector("[data-tile]")).not.toBeNull();
      expect(row.querySelector("[data-paper-state]")?.className).toContain("sticker-chip");
    }
  });

  test("[R-WORLD-018] [R-WORLD-021] given a life with a job, when Jobs opens, then the job held is a card with its picture and its pay as a green chip", async () => {
    const view = richView();
    await openPhone(view);
    const jobs = openApp("jobs");
    const held = jobs.querySelector<HTMLElement>("[data-job-row]");
    expect(view.job.id).not.toBeNull();
    expect(held?.querySelector("[data-tile]")?.getAttribute("data-tile")).toBe(view.job.id);
    expect(held?.querySelector("[data-money-chip]")).not.toBeNull();
  });

  test("[R-WORLD-019] given no offer waits and the phone can open the map, when Jobs opens, then the board where jobs go up stands with the way to it", async () => {
    const view = engineView();
    expect(view.offers.filter((offer) => offer.terms.job !== undefined)).toEqual([]);
    await openPhone(view);
    const jobs = openApp("jobs");
    expect(jobs.querySelector("[data-jobs-board]")?.getAttribute("data-jobs-board")).toBe("place.yaba");
    expect(jobs.querySelector("[data-jobs-board]")?.textContent).toBe(phoneWords("phone.jobs.board.go", { place: "the hub" }));
  });

  test("[R-WORLD-018] given the month's lines in News, when it opens, then each line is a chip, good news in green", async () => {
    const view = richView();
    await openPhone(view);
    const news = openApp("news");
    const lines = [...news.querySelectorAll<HTMLElement>("[data-report] li")];
    for (const line of lines) expect(line.className).toContain("sticker-chip");
    for (const line of lines.filter((one) => one.getAttribute("data-tone") === "good")) expect(line.className).toContain("bg-tint-money");
  });

  test("[R-WORLD-018] given Settings, when it opens, then the sound and the graphics stand in one card, each choice one segmented pill", async () => {
    await openPhone(engineView());
    const settings = openApp("settings");
    const card = settings.querySelector("[data-settings-card]");
    expect(card?.querySelectorAll("[role='radiogroup']")).toHaveLength(2);
    for (const group of card?.querySelectorAll("[role='radiogroup']") ?? []) expect(group.className).toContain("phone-segment");
    expect(card?.querySelectorAll(".phone-segment-on")).toHaveLength(2);
  });
});
