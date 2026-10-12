// The moment card on screen (docs/rules/moments.md): what it shows, how it reads cropped, what it never looks like,
// when it stands and how it goes, and that it is no share card.
import type { PlayerView, ReportLine } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { engineView, fakeAuthority } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { useCardsTurn } from "../../shared/ui/stage";
import { say } from "../../shared/words/text";
import { MOMENTS } from "../../shared/moment/moment";
import { figureSize, markFile, MomentCard } from "./MomentCard";

const naira = (amount: number) => ({ currency: "NGN" as const, amount });

function line(key: string, params: ReportLine["params"], extra: Partial<ReportLine> = {}): ReportLine {
  return { key, params, tone: "plain", attention: false, counts: [], ...extra };
}

const REFUSED = line("line.route.refused", { route: "route.uk-masters", reason: "interview" }, { tone: "bad", attention: true });
const ROBBED = line("line.activity.robbed", { cash: naira(14_200_000), phone: naira(6_000_000) }, { tone: "bad", attention: true });
const WON = line("line.lottery.letter", { draw: 6, won: naira(31_400_000) }, { tone: "good", big: true, attention: true });

/** A view with a month's report, so the results sheet has something to show. */
function reportedView(): PlayerView {
  const view = engineView();
  return { ...view, report: { month: 1, lines: [], japacityBefore: null, japacityAfter: null, attention: false } };
}

/** The lines arrive as a command's answer, as an act's would. */
async function arrive(store: Awaited<ReturnType<typeof renderWithView>>["store"], authority: Awaited<ReturnType<typeof renderWithView>>["authority"], lines: ReportLine[]): Promise<void> {
  authority.linesNext(lines);
  await act(() => store.getState().send({ type: "wallet/move", currency: "NGN", amount: 1, to: "cash" }));
  // The staged wins pass first, as the world's corner passes them (the card's own line at once).
  act(() => {
    while (store.getState().moments.length > 0) store.getState().nextMoment();
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the moment card on screen", () => {
  test("[R-MOMENT-002] given the one chance, when the card stands, then it holds the kicker, the title, the line, the figure with its caption, the new phone, and the game's mark with its address in the corner", async () => {
    const { store, authority } = await renderWithView(<MomentCard over="world" />, engineView());
    await arrive(store, authority, [ROBBED]);
    const card = await screen.findByRole("dialog", { name: say("moment.robbed.kicker") });
    const face = card.querySelector<HTMLElement>("[data-moment-card='robbed']")!;
    expect(face.dataset["momentTone"]).toBe("bad");
    expect(within(face).getByText(say("moment.robbed.title"))).toBeDefined();
    expect(within(face).getByText(say("moment.robbed.line"))).toBeDefined();
    expect(face.querySelector("[data-moment-figure]")?.getAttribute("data-moment-figure")).toBe("14200000");
    expect(within(face).getByText(say("moment.robbed.caption"))).toBeDefined();
    expect(within(face).getByText(say("moment.robbed.phone", { phone: naira(6_000_000) }))).toBeDefined();
    const sign = face.querySelector<HTMLElement>("[data-moment-sign]")!;
    expect(sign.querySelector("img")?.getAttribute("src")).toBe(markFile("dark"));
    expect(sign.querySelector("img")?.getAttribute("alt")).toBe("Japacity");
    expect(sign.textContent).toBe("japacity.app");
    // The sign-off is the card's last part, so a crop of the card keeps it.
    expect(face.lastElementChild).toBe(sign);
  });

  test("[R-MOMENT-002] given a win, then the card is drawn light, and its mark is the one for a light ground", async () => {
    const { store, authority } = await renderWithView(<MomentCard over="world" />, engineView());
    await arrive(store, authority, [WON]);
    const card = await screen.findByRole("dialog", { name: say("moment.won.kicker") });
    const face = card.querySelector<HTMLElement>("[data-moment-card='won']")!;
    expect(face.dataset["momentTone"]).toBe("good");
    expect(face.className).toContain("panel");
    expect(face.querySelector("[data-moment-mark]")?.getAttribute("src")).toBe(markFile("light"));
  });

  test("[R-MOMENT-003] given the card, then it stands centred no wider than 380 px, 16 px in from the sides, with the line, the figure, the kicker and the address at their sizes", async () => {
    const { store, authority } = await renderWithView(<MomentCard over="world" />, engineView());
    await arrive(store, authority, [ROBBED]);
    const card = await screen.findByRole("dialog", { name: say("moment.robbed.kicker") });
    const screenOf = document.querySelector<HTMLElement>("[data-moment-screen]")!;
    expect(screenOf.className).toMatch(/\bfixed inset-0\b/);
    expect(screenOf.className).toMatch(/\bitems-center justify-center\b/);
    expect(screenOf.className).toContain("px-4");
    expect(screenOf.className).toContain("env(safe-area-inset-top)");
    const face = card.querySelector<HTMLElement>("[data-moment-card]")!;
    expect(face.className).toContain("max-w-[380px]");
    expect(face.querySelector("[data-moment-line]")?.className).toContain("text-[27px]");
    expect(face.querySelector("[data-moment-kicker]")?.className).toContain("text-[13px]");
    expect(face.querySelector("[data-moment-address]")?.className).toContain("text-[17px]");
    expect(face.querySelector("[data-moment-caption]")?.className).toContain("text-[16px]");
    expect(Number(face.querySelector("[data-moment-size]")?.getAttribute("data-moment-size"))).toBe(figureSize("₦142,000"));
    // The longest sum the game can show still stands at 44 px or more, one line inside 348 px of card.
    expect(figureSize("₦12,500,000")).toBe(44);
    expect(Math.min(...["24", "35%", "₦25,000", "₦142,000", "₦1,600,000", "CA$12,500,000"].map(figureSize))).toBeGreaterThanOrEqual(44);
    expect(figureSize("24")).toBe(88);
  });

  test("[R-MOMENT-004] given every card, then the figure carries no sign and stands in the card's own ink, never green or red, and nothing on it is an alert, a tick, a reference or a bank", async () => {
    const { store, authority } = await renderWithView(<MomentCard over="world" />, engineView());
    for (const told of [ROBBED, WON, REFUSED]) {
      await arrive(store, authority, [told]);
      const card = await screen.findByRole("dialog");
      const figure = card.querySelector<HTMLElement>("[data-moment-figure]")!;
      await waitFor(() => expect(figure.textContent).not.toBe(""));
      expect(figure.textContent).not.toMatch(/[+−-]/);
      for (const element of [figure, ...figure.querySelectorAll<HTMLElement>("*")]) expect(element.className).not.toMatch(/\btext-(?:in|out|good|bad|green|red)/);
      expect(card.querySelector("[role='alert']")).toBeNull();
      expect(card.textContent).not.toMatch(/alert|credit|debit|transaction|receipt|\bref\b|reference|account|balance|transfer|bank|stamp|NGN/i);
      expect(card.querySelector("svg.lucide-check, svg.lucide-circle-check, svg.lucide-badge-check")).toBeNull();
      fireEvent.click(card);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
  });

  test("[R-MOMENT-006] given a card over the world, when Close is pressed or the dimmed world is tapped, then it goes; until then the share card waits its turn", async () => {
    const { store, authority } = await renderWithView(<MomentCard over="world" />, engineView());
    let turn: boolean | null = null;
    function Probe() {
      turn = useCardsTurn();
      return null;
    }
    render(
      <GameProvider store={store}>
        <Probe />
      </GameProvider>,
    );
    await arrive(store, authority, [ROBBED]);
    const card = await screen.findByRole("dialog", { name: say("moment.robbed.kicker") });
    expect(turn).toBe(false);
    fireEvent.click(within(card).getByRole("button", { name: say("moment.close") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(turn).toBe(true);
    await arrive(store, authority, [WON]);
    await screen.findByRole("dialog", { name: say("moment.won.kicker") });
    fireEvent.click(document.querySelector("[data-moment-screen]")!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("[R-MOMENT-006] given the results open, then a card waiting does not stand over the world instead, and a run of months shows its cards one after another", async () => {
    const view = reportedView();
    const authority = fakeAuthority(view);
    const store = createGameStore(authority);
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <MomentCard over="world" />
      </GameProvider>,
    );
    act(() => store.setState({ reportOpen: true, momentCards: [{ line: ROBBED, view, before: null }, { line: WON, view, before: null }] }));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => store.setState({ reportOpen: false }));
    const first = await screen.findByRole("dialog", { name: say("moment.robbed.kicker") });
    fireEvent.click(first);
    expect(await screen.findByRole("dialog", { name: say("moment.won.kicker") })).toBeDefined();
  });

  test("[R-MOMENT-006] given no screen for moment cards (the old month page), when a moment's line comes, then none is kept, so the share card's turn is never held", async () => {
    const view = engineView();
    const authority = fakeAuthority(view);
    const store = createGameStore(authority);
    await store.getState().refresh();
    authority.linesNext([ROBBED]);
    await store.getState().send({ type: "wallet/move", currency: "NGN", amount: 1, to: "cash" });
    expect(store.getState().momentCards).toEqual([]);
    const down = store.getState().momentScreen();
    authority.linesNext([ROBBED]);
    await store.getState().send({ type: "wallet/move", currency: "NGN", amount: 1, to: "cash" });
    expect(store.getState().momentCards.map((card) => card.line.key)).toEqual([ROBBED.key]);
    down();
    expect(store.getState().momentCards).toEqual([]);
  });

  test("[R-MOMENT-007] given a card, then it offers nothing to share or save, draws no image, and sends and counts nothing", async () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    const fetched = vi.spyOn(globalThis, "fetch");
    const canvas = vi.spyOn(document, "createElement");
    const { store, authority } = await renderWithView(<MomentCard over="world" />, engineView());
    const sent = authority.sent.length;
    await arrive(store, authority, [WON]);
    const card = await screen.findByRole("dialog", { name: say("moment.won.kicker") });
    expect(within(card).getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual([say("moment.close")]);
    expect(card.textContent).not.toMatch(/share|save|download/i);
    fireEvent.click(card);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(beacon).not.toHaveBeenCalled();
    expect(fetched).not.toHaveBeenCalled();
    expect(canvas.mock.calls.filter(([tag]) => tag === "canvas")).toEqual([]);
    // The only command sent is the act that brought the line.
    expect(authority.sent.length).toBe(sent + 1);
  });

  test("[R-MOMENT-008] given every entry of the moments' list, when its card stands, then it has its words, the line, the figure, the mark and the address", async () => {
    const view = engineView();
    const authority = fakeAuthority(view);
    const store = createGameStore(authority);
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <MomentCard over="world" />
      </GameProvider>,
    );
    const params: Record<string, ReportLine["params"]> = {
      "line.route.refused": { route: "route.uk-masters", reason: "credibility" },
      "line.route.granted": { route: "route.uk-masters" },
      "line.activity.robbed": { cash: naira(14_200_000), phone: naira(6_000_000) },
      "line.offer.agent-scam": { agent: "offer.agent-stop.who.1", amount: naira(2_500_000) },
      "line.lottery.letter": { draw: 6, won: naira(31_400_000) },
      "line.activity.lotto-won": { tickets: 3, stake: naira(60_000), won: naira(5_000_000) },
      "line.route.departed": { route: "route.uk-masters" },
      "line.chapter.closed": { chapter: "chapter.build-the-file" },
      "line.route.endorsement-refused": { route: "route.uk-talent" },
      "line.route.road-fraud": { route: "route.road" },
    };
    // the deposit's card reads its figure from the month's lines where the pitch was
    // taken, and the endorsement's refusal has its own kicker.
    const deposit = [line("line.wallet.fee-agent", { amount: naira(30_000_000) }, { tone: "bad" }), line("line.offer.taken", { offer: "offer.road-cousin", choice: "take" })];
    const kickers: Record<string, string> = { "line.route.endorsement-refused": "moment.refused.kicker.endorsement" };
    for (const entry of MOMENTS) {
      const made = line(entry.key, params[entry.key] ?? {}, { big: true, tone: entry.tone === "bad" ? "bad" : "good" });
      act(() => store.setState({ momentCards: [{ line: made, view, before: null, ...(entry.kind === "deposit" ? { told: [...deposit, made] } : {}) }] }));
      const card = await screen.findByRole("dialog", { name: say(kickers[entry.key] ?? `moment.${entry.kind}.kicker`) });
      expect(card.querySelector(`[data-moment-card='${entry.kind}']`)).not.toBeNull();
      expect(card.querySelector("[data-moment-line]")?.textContent).not.toMatch(/^moment\.|\{/);
      expect(card.querySelector("[data-moment-figure]")).not.toBeNull();
      expect(card.querySelector("[data-moment-mark]")).not.toBeNull();
      expect(card.querySelector("[data-moment-address]")?.textContent).toBe("japacity.app");
      act(() => store.setState({ momentCards: [] }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
  });
});
