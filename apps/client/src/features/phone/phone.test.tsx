import { content, text } from "@japacity/content";
import type { Command, PlayerView } from "@japacity/sim";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { soundStore } from "../../shared/sound/sound";
import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import type { PairTalk } from "./apps/Chats";
import { familyFeedLines } from "./feed";
import { PhoneApps } from "./PhoneApps";
import { APP_IDS, marksOf, reloadSeen, waitingOf } from "./seen";
import { todayWords } from "../../shared/words/format";
import { inMonths, nameOf } from "../../shared/words/text";
import { phoneWords } from "./phone.words";
import { resetLines, tell } from "../../shared/world/Lines";
import { TOLD_LANE } from "./Phone";
import { handBrief } from "../../shared/world/briefHanded";
import { GRAPHICS_KEY, SEEN_KEY } from "../../shared/kept/storage";

const NOON = () => new Date(2026, 9, 8, 12, 5);

beforeEach(() => {
  // The corner starts empty, as a new screen does: a line told in the last test is not this one's.
  resetLines();
  localStorage.clear();
  reloadSeen();
});

async function openPhone(view: PlayerView, extra: { talk?: PairTalk; onClose?: () => void } = {}) {
  // The shell hands the phone its Calendar (R-WORLD-002), as App does; the phone knows only that it is a screen.
  return renderWithView(<PhoneApps onClose={extra.onClose ?? (() => undefined)} area="Ojuelegba" now={NOON} talk={extra.talk ?? null} calendar={(opening) => <div data-phone-app="calendar" data-opening={opening ?? ""} />} />, view);
}

function tile(id: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-app="${id}"]`);
  if (found === null) throw new Error(`No tile for ${id}.`);
  return found;
}

function openApp(id: string): void {
  fireEvent.click(tile(id));
}

function main(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-ask-main]");
  if (found === null) throw new Error("No sheet is open.");
  return found;
}

/** The commands sent, without the version stamp. */
function sent(authority: { sent: Command[] }): unknown[] {
  return authority.sent.map((command) => {
    const rest: Partial<Command> = { ...command };
    delete rest.basedOn;
    return rest;
  });
}

/** Tunde's rich view with a job offer open, a job held and the Friday draw with a result. */
function busyView(): PlayerView {
  const base = richView();
  const odds = content.tuning.lottery.odds;
  return {
    ...base,
    offers: [
      ...base.offers,
      { id: "offer-20", entry: "offer.job", openedMonth: 11, expiresMonth: 13, terms: { job: "activity.job-teacher" }, signs: [], choices: [{ id: "accept", allowed: true, pick: null }, { id: "decline", allowed: true, pick: null }] },
    ],
    lottery: {
      ticket: 50_000,
      maxTickets: 5,
      draw: 7,
      closesTick: 14,
      onSale: false,
      tickets: 2,
      numbers: [12, 31],
      jackpot: 500_000_000,
      rolledOver: false,
      odds,
      fingerprint: "ab".repeat(32),
      last: { draw: 7, revealed: "cd", beaconRound: 1, beaconRandomness: "ef", listHash: "01", count: 40, odds, jackpot: 400_000_000, winners: [{ tier: "jackpot", tickets: [], amount: 0 }, { tier: "small", tickets: [31, 5], amount: 100_000 }], nextJackpot: 500_000_000 },
    },
  };
}

describe("the handset", () => {
  test("[R-WORLD-018] given the phone opens, when it rises, then the wallpaper shows the time, the month and the area, and the grid holds the apps four across, the Calendar first", async () => {
    await openPhone(engineView());
    expect(document.querySelector("[data-phone-time]")?.textContent).toBe("12:05");
    expect(screen.getByText(todayWords(NOON()))).toBeTruthy();
    expect(document.querySelector("[data-phone-area]")?.textContent).toBe("Ojuelegba");
    const grid = screen.getByRole("list", { name: "Apps" });
    expect(grid.className).toContain("grid-cols-4");
    expect([...grid.querySelectorAll("[data-app]")].map((app) => app.getAttribute("data-app"))).toEqual([...APP_IDS]);
    expect(APP_IDS[0]).toBe("calendar");
    expect([...grid.querySelectorAll("[data-app]")].map((app) => (app as HTMLElement).style.background)).toEqual(APP_IDS.map((id) => `var(--app-${id})`));
    // The tilt at rest is a transform, so the grow can carry it away on the compositor (R-WORLD-023).
    expect(document.querySelector("[data-handset]")?.className).toContain("handset-rest");
  });

  test("[R-WORLD-018] given the phone, when the grow button is tapped and tapped again, then it grows to nearly the whole screen and comes back", async () => {
    await openPhone(engineView());
    const phone = document.querySelector("[data-phone]");
    expect(phone?.getAttribute("data-grown")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Make the phone bigger" }));
    expect(phone?.getAttribute("data-grown")).toBe("true");
    // Grown, the handset is laid out at the screen's width, straight, and gets there by one transform from the box it
    // left, never by animating its edges (R-WORLD-023). The width is the screen's up to the centred column's
    // (decision 0025), so on a phone the whole screen and on a laptop the
    // column of phone width the band and the thumbs stand in.
    const handset = document.querySelector("[data-handset]");
    expect(handset?.className).toContain("w-[calc(100%-16px)]");
    expect(handset?.parentElement?.hasAttribute("data-centred-column")).toBe(true);
    expect(handset?.parentElement?.className).toContain("inset-0");
    expect(handset?.className).toContain("handset-grown");
    expect(handset?.className).toContain("motion-handset");
    expect(handset?.className).not.toMatch(/transition-\[|duration-/);
    fireEvent.click(screen.getByRole("button", { name: "Make the phone smaller" }));
    expect(phone?.getAttribute("data-grown")).toBe("false");
    expect(document.querySelector("[data-handset]")?.className).toContain("handset-rest");
  });

  test("[R-WORLD-026] [R-WORLD-018] given a line told over the phone, at rest or grown, when it shows, then it stands in a lane of its own above the handset, never inside the glass on an icon or a button", async () => {
    // The trap: "You quit" sitting on the Jobs and Market icons, or on Send money home.
    await openPhone(engineView());
    act(() => tell("You quit"));
    const told = document.querySelector<HTMLElement>("[data-phone] [data-told]")!;
    expect(told.textContent).toBe("You quit");
    const lane = told.closest<HTMLElement>("[data-phone-told-lane]")!;
    expect(lane.parentElement?.hasAttribute("data-handset")).toBe(true);
    expect(lane.className).toContain("bottom-full");
    expect(document.querySelector("[data-phone-glass]")?.contains(told)).toBe(false);
    // Grown, the handset leaves the lane's room above it, so the lane is never off the top of the screen.
    fireEvent.click(screen.getByRole("button", { name: "Make the phone bigger" }));
    expect(document.querySelector("[data-handset]")?.className).toContain(TOLD_LANE);
  });

  test("[R-STATUS-003] [R-WORLD-018] given what the wallpaper tells is taller than its room, when the phone's home shows, then the notices stand whole and the grid scrolls under them above the home bar, never out of reach", async () => {
    // The trap: the status clock's banner pushing the last row of apps under the home bar.
    await renderWithView(<PhoneApps onClose={() => undefined} area="Peckham" now={NOON} talk={null} warnings={<div style={{ height: 2000 }} data-tall-notice />} />, engineView());
    const notices = document.querySelector<HTMLElement>("[data-wallpaper-room]")!;
    expect(notices.contains(document.querySelector("[data-tall-notice]"))).toBe(true);
    expect(notices.className).toContain("overflow-y-auto");
    expect(notices.className).toContain("min-h-0");
    const grid = screen.getByRole("list", { name: "Apps" });
    expect(notices.contains(grid)).toBe(true);
    expect(document.querySelector("[data-tall-notice]")!.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notices.contains(document.querySelector("[data-home-bar]"))).toBe(false);
  });

  test("[R-WORLD-018] given an app is open, when Back is tapped, then the grid returns, and the home bar puts the phone away", async () => {
    const onClose = vi.fn();
    await openPhone(engineView(), { onClose });
    openApp("news");
    expect(document.querySelector('[data-app-screen="news"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(document.querySelector("[data-app-screen]")).toBeNull();
    expect(screen.getByRole("list", { name: "Apps" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Put the phone away" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  for (const [name, fixture] of [
    ["a new life", engineView],
    ["a life in the middle of an application", richView],
    ["a life with a job offer and a draw result", busyView],
  ] as const) {
    test(`[R-WORLD-018] given ${name}, when each app opens, then it shows its own one screen from the view`, async () => {
      await openPhone(fixture());
      for (const id of APP_IDS) {
        openApp(id);
        expect(document.querySelector(`[data-app-screen="${id}"] [data-phone-app="${id}"]`)).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Back" }));
      }
    });
  }
});

describe("the dots", () => {
  test("[R-WORLD-018] given a bill due, a job offer, a draw result and the month's news, when nothing has been seen, then those apps carry a dot and Bank, Japa and Settings do not", () => {
    const waiting = waitingOf(marksOf(busyView()), {});
    expect(waiting).toMatchObject({ bills: true, jobs: true, lotto: true, news: true, chats: true, bank: false, japa: false, settings: false });
  });

  test("[R-WORLD-018] given an app with a dot, when it is opened, then the dot goes, the device keeps what was seen under one key, and it stays gone after a reload", async () => {
    await openPhone(busyView());
    expect(tile("jobs").querySelector("[data-dot]")).not.toBeNull();
    openApp("jobs");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(tile("jobs").querySelector("[data-dot]")).toBeNull();
    expect(Object.keys(localStorage)).toEqual([SEEN_KEY]);
    const kept = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, string>;
    expect(kept.jobs).toBe(marksOf(busyView()).jobs);
    act(() => reloadSeen());
    expect(tile("jobs").querySelector("[data-dot]")).toBeNull();
    expect(tile("bills").querySelector("[data-dot]")).not.toBeNull();
  });

  test("[R-WORLD-018] given the job offer seen, when a new offer arrives, then the dot comes back", () => {
    const view = busyView();
    const seen = { jobs: marksOf(view).jobs };
    const next = { ...view, offers: [...view.offers, { ...view.offers.at(-1)!, id: "offer-21" }] };
    expect(waitingOf(marksOf(view), seen).jobs).toBe(false);
    expect(waitingOf(marksOf(next), seen).jobs).toBe(true);
  });
});

describe("the acts", () => {
  test("[R-WORLD-018] given Bank, when Change money is chosen and its card confirmed, then the conversion the wallet sends is sent", async () => {
    const view = engineView();
    const { authority } = await openPhone(view);
    openApp("bank");
    fireEvent.click(screen.getByRole("button", { name: "Change money" }));
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="change"]')!);
    expect(document.querySelector("[data-ask-form]")?.getAttribute("data-ask-form")).toBe("card");
    fireEvent.click(main());
    const quarter = Math.floor(view.pockets.NGN.bank / 4 / 100) * 100;
    await waitFor(() => expect(sent(authority)).toEqual([{ type: "wallet/convert", from: "NGN", to: "GBP", amount: quarter, via: "bank" }]));
  });

  test("[R-WORLD-018] given Bank, when Move money is chosen for all the cash and its card confirmed, then the move is sent", async () => {
    const view = engineView();
    const { authority } = await openPhone(view);
    openApp("bank");
    fireEvent.click(screen.getByRole("button", { name: "Move money" }));
    fireEvent.click(screen.getByRole("radio", { name: "All of it" }));
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="move"]')!);
    fireEvent.click(main());
    await waitFor(() => expect(sent(authority)).toEqual([{ type: "wallet/move", currency: "NGN", amount: view.pockets.NGN.cash, to: "bank" }]));
    expect(await screen.findByText("Money moved")).toBeTruthy();
  });

  test("[R-WORLD-018] given Jobs with a job held and an offer, when quit and take are confirmed on their cards, then the quit and the offer's accept are sent", async () => {
    const { authority } = await openPhone(busyView());
    openApp("jobs");
    fireEvent.click(screen.getAllByRole("button", { name: "Quit" })[0]!);
    expect(main().textContent).toContain("Yes, quit");
    fireEvent.click(main());
    await waitFor(() => expect(sent(authority)).toEqual([{ type: "activity/quit" }]));
    // One main button at the foot repeats the offer picked: "Take it" and the job.
    fireEvent.click(screen.getByRole("button", { name: /^Take it/ }));
    fireEvent.click(main());
    await waitFor(() => expect(sent(authority).at(-1)).toEqual({ type: "offer/choose", offer: "offer-20", choice: "accept" }));
  });

  test("[R-WORLD-019] given Bills with a loan due, when its slip is paid, then this month's part is paid and the upkeep is taken at the month's end", async () => {
    const view = richView();
    const { authority } = await openPhone(view);
    openApp("bills");
    expect(document.querySelector('[data-bill="obligation-9"]')?.getAttribute("data-due")).toBe("true");
    const upkeep = view.obligations.find((owed) => owed.entry === "obligation.upkeep");
    expect(document.querySelector(`[data-bill="${upkeep?.id ?? ""}"] [data-pay]`)).toBeNull();
    fireEvent.click(document.querySelector<HTMLElement>('[data-pay="obligation-9"]')!);
    expect(document.querySelector("[data-ask-form]")?.getAttribute("data-ask-form")).toBe("slip");
    fireEvent.click(main());
    await waitFor(() => expect(sent(authority)).toEqual([{ type: "obligation/pay", obligation: "obligation-9", amount: 12_400_000 }]));
  });

  test("[R-WORLD-018] given a sheet open in an app, when Not now is tapped, then nothing is sent", async () => {
    const { authority } = await openPhone(richView());
    openApp("bills");
    fireEvent.click(document.querySelector<HTMLElement>('[data-pay="obligation-9"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(document.querySelector("[data-ask-main]")).toBeNull());
    expect(authority.sent).toEqual([]);
  });
});

describe("what the phone carries", () => {
  test("[R-WORLD-019] given a life, when Chats opens the family group, then the group's posts show as bubbles from their senders, one a month at most", async () => {
    const view = { ...engineView(), month: 3 };
    await openPhone(view);
    openApp("chats");
    fireEvent.click(document.querySelector<HTMLElement>('[data-chat-row="family"]')!);
    const feed = familyFeedLines(view);
    expect(feed).toHaveLength(4);
    expect(new Set(feed.map((line) => line.month)).size).toBe(feed.length);
    for (const line of feed) expect(screen.getAllByText(line.words).length).toBeGreaterThan(0);
  });

  test("[R-WORLD-018] given the family group's thread open in Chats, when the way back is looked for, then there is one, the app's Back: it returns to the chats, and once more to the grid", async () => {
    // The trap: the app's back arrow and a "Chats" link under it, two ways back stacked.
    await openPhone({ ...engineView(), month: 3 });
    openApp("chats");
    fireEvent.click(document.querySelector<HTMLElement>('[data-chat-row="family"]')!);
    expect(screen.getAllByRole("button", { name: phoneWords("phone.back") })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: phoneWords("phone.app.chats") })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: phoneWords("phone.back") }));
    expect(document.querySelector('[data-chat-row="family"]')).not.toBeNull();
    expect(document.querySelector("[data-phone-home]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: phoneWords("phone.back") }));
    expect(document.querySelector("[data-phone-home]")).not.toBeNull();
  });

  test("[R-WORLD-019] given the visa granted, when the feed is read, then the billing that waits for the news has started", () => {
    const view = richView();
    const granted = { ...view, routes: view.routes.map((route) => ({ ...route, state: "granted" as const })) };
    expect(familyFeedLines(view).some((line) => line.id === "family.roof")).toBe(false);
    expect(familyFeedLines(granted).some((line) => line.id === "family.roof")).toBe(true);
  });

  test("[R-WORLD-019] given a partner online, when their chat opens, then their messages show and a phrase is said from chips, nothing typed", async () => {
    const base = richView();
    const bond = { id: "bond-1", role: "partner" as const, stage: "partner" as const, label: "player" as const, person: null, pair: "pair-1", lastMomentMonth: null, cooldownUntil: null, partnerMonth: null, consent: null, moments: null, pending: { mine: null, theirs: null }, standIn: null, facts: null };
    const view = { ...base, people: { ...base.people, bonds: [bond] } } as PlayerView;
    const said = vi.fn<PairTalk["say"]>(() => Promise.resolve({ ok: true, message: { id: "m-2", conversation: "c-1", sender: "me", phrase: "phrase.hello", fill: null, sentAt: 2, readAt: null } } as Awaited<ReturnType<PairTalk["say"]>>));
    const talk: PairTalk = {
      pair: () => Promise.resolve({ ok: true, pair: { them: "them" } } as Awaited<ReturnType<PairTalk["pair"]>>),
      conversation: () => Promise.resolve({ ok: true, pair: "pair-1", messages: [{ id: "m-1", conversation: "c-1", sender: "them", phrase: "phrase.miss-you", fill: null, sentAt: 1, readAt: null }] } as Awaited<ReturnType<PairTalk["conversation"]>>),
      say: said,
    };
    await openPhone(view, { talk });
    openApp("chats");
    fireEvent.click(document.querySelector<HTMLElement>('[data-chat-row="bond-1"]')!);
    expect(await screen.findByText(text["phrase.miss-you.name"] ?? "")).toBeTruthy();
    expect(document.querySelector("input, textarea")).toBeNull();
    fireEvent.click(screen.getAllByRole("radio", { name: text["phrase.hello.name"] ?? "" })[0]!);
    fireEvent.click(document.querySelector<HTMLElement>("[data-say]")!);
    await waitFor(() => expect(said).toHaveBeenCalledWith("pair-1", "phrase.hello", null));
  });

  test("[R-WORLD-019] given papers held and on the way, when Japa opens, then the plan shows its percent and steps, and its papers' step opens the Papers app, the box under the bed", async () => {
    const view = richView();
    await openPhone(view);
    openApp("japa");
    expect(document.querySelector("[data-japa-percent]")?.getAttribute("data-japa-percent")).toBe("64");
    expect(document.querySelectorAll("[data-steps] [data-met]")).toHaveLength(view.routes[0]!.checklist.length);
    // The reminder says the paper and when, each once (R-TEXT-008).
    const reminder = document.querySelector("[data-reminder='paper']");
    expect(reminder?.textContent).toBe(`${phoneWords("phone.japa.paper-ready", { paper: nameOf("document.transcript") })}${inMonths(12, view.month)}`);
    // The step opens the Papers app, one source for the papers.
    fireEvent.click(document.querySelector<HTMLElement>("[data-open-papers]")!);
    expect(document.querySelector("[data-app-screen]")?.getAttribute("data-app-screen")).toBe("papers");
    expect(screen.getByText("The box under the bed")).toBeTruthy();
    const states = new Map([...document.querySelectorAll("[data-paper]")].map((paper) => [paper.getAttribute("data-paper"), paper.getAttribute("data-state")]));
    expect(view.documents.map((paper) => states.get(paper.id))).toEqual(["held", "held", "coming"]);
  });

  test("[R-WORLD-018] given a draw result, when Lotto opens, then the next draw, the tickets held and the last result show, with the matched ticket lit", async () => {
    await openPhone(busyView());
    openApp("lotto");
    expect(document.querySelector("[data-next-draw]")?.getAttribute("data-next-draw")).toBe("7");
    expect(document.querySelector("[data-held]")?.getAttribute("data-held")).toBe("2");
    expect([...document.querySelectorAll("[data-matched]")].map((ticket) => ticket.textContent)).toEqual(["31"]);
    expect(screen.getByText("Your ticket 31 won.")).toBeTruthy();
  });

  test("[R-WORLD-008] given a month's report, when News opens, then the report's lines are kept there with the stories", async () => {
    const view = richView();
    await openPhone(view);
    openApp("news");
    expect(document.querySelector("[data-report]")?.querySelectorAll("li").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-story]")).toHaveLength(view.news.length);
  });
});

describe("settings", () => {
  test("[R-WORLD-021] given Settings, when it opens, then it offers no choice of look: the game has one, painted by the world's clock (decision 0025)", async () => {
    await openPhone(engineView());
    openApp("settings");
    expect(screen.queryByRole("radio", { name: "Danfo" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Adire" })).toBeNull();
    expect(screen.queryByText("Look")).toBeNull();
    expect(document.documentElement.dataset.ui).toBeUndefined();
  });

  test("[R-WORLD-022] given Settings, when the sound is turned off and on, then the existing mute follows", async () => {
    await openPhone(engineView());
    openApp("settings");
    fireEvent.click(screen.getByRole("radio", { name: "Off" }));
    expect(soundStore.getState().muted).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "On" }));
    expect(soundStore.getState().muted).toBe(false);
  });

  test("[R-WORLD-018] given Settings, when a graphics choice is made, then the city's kept choice holds it", async () => {
    await openPhone(engineView());
    openApp("settings");
    fireEvent.click(screen.getByRole("radio", { name: "High" }));
    expect(localStorage.getItem(GRAPHICS_KEY)).toBe("high");
  });
});

describe("the brief's dot on Japa", () => {
  test("[R-WORLD-018] [R-WORLD-004] given a brief handed (design page 13 section 4), when the phone's marks are read, then Japa carries a dot until it is opened, and a new brief brings it back", () => {
    const view = engineView();
    expect(waitingOf(marksOf(view), {}).japa).toBe(false);
    handBrief(view.scenario, "chapter.find-your-feet");
    expect(marksOf(view).japa).toBe("chapter.find-your-feet");
    expect(waitingOf(marksOf(view), {}).japa).toBe(true);
    expect(waitingOf(marksOf(view), { japa: "chapter.find-your-feet" }).japa).toBe(false);
    handBrief(view.scenario, "chapter.build-the-file");
    expect(waitingOf(marksOf(view), { japa: "chapter.find-your-feet" }).japa).toBe(true);
  });
});
