// The month's lines stay in News (docs/rules/world.md R-WORLD-008), those of what was done
// mid-month too: an agent paid, the scam told straight with every tell the player saw
// (docs/rules/advice.md R-ADVICE-009).
import { content } from "@japacity/content";
import { act, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { applyEffects, readyLife, slot, toKnown } from "../../../../../packages/sim/src/route/route.journey";
import type { Game } from "../../../../../packages/sim/src/testing/play";
import { abroadGame, abroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say, words } from "../../shared/words/text";
import { PhoneApps } from "./PhoneApps";
import { reloadSeen } from "./seen";

beforeEach(() => {
  localStorage.clear();
  reloadSeen();
});

/** A scammer at the stop, past the first chapter, with cash enough for his fee (as the sim's own agent tests reach one). */
function scammerGame(): { game: Game; offer: string } {
  for (let n = 0; n < 80; n += 1) {
    const game = readyLife(content, { quiet: true, seed: `agent-${String(n)}`, qualities: { "quality.network": content.tuning.advice.networkToAsk } });
    applyEffects(game, [{ type: "activity/start-job", job: "activity.job-teacher" }]);
    toKnown(game);
    for (let month = 0; month < 6 && !game.state.chapter.done.includes("chapter.find-your-feet"); month += 1) game.endTurn();
    applyEffects(game, [{ type: "route/hear", route: "route.gulf-contract", via: "test" }]);
    game.endTurn([slot("activity.see-agent-stop", "route.gulf-contract")]);
    const item = Object.values(game.state.offer.items).find((candidate) => candidate.entry === "offer.agent-stop");
    if (item === undefined || !item.secret.fraud) continue;
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: 10_000_000, reason: "gift" }]);
    return { game, offer: item.id };
  }
  throw new Error("No seed gave a scammer.");
}

describe("News keeps the month's lines", () => {
  test("[R-WORLD-008] [R-ADVICE-009] given a scammer paid mid-month after a look, when the month ends and News opens, then the scam names him and the fee, and every tell seen follows it", async () => {
    const { game, offer } = scammerGame();
    const mid = [...game.accept({ type: "offer/choose", offer, choice: "look-office" }).lines, ...game.accept({ type: "offer/choose", offer, choice: "take" }).lines];
    game.endTurn();
    const scam = mid.find((line) => line.key === "line.offer.agent-scam");
    const tells = mid.filter((line) => line.key === "line.offer.agent-scam-tell");
    if (scam === undefined) throw new Error("The scam was not told.");
    expect(tells.length).toBeGreaterThan(0);
    const { store } = await renderWithView(<PhoneApps onClose={() => undefined} area="Ojuelegba" now={() => new Date(2026, 9, 8, 12, 5)} talk={null} />, game.view());
    act(() => {
      store.setState({ lastMonthLines: mid });
    });
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="news"]')!);
    const report = document.querySelector("[data-report]")?.textContent ?? "";
    expect(report).toContain(words(scam.key, scam.params));
    for (const tell of tells) {
      const told = words(tell.key, tell.params);
      expect(told).not.toContain("advice.tell.");
      expect(report).toContain(told);
    }
    // The fee is told once: by the scam, not again by the wallet.
    expect(report).not.toContain(words("line.wallet.fee-agent", { amount: scam.params.amount ?? 0 }));
  });
});

describe("a bill missed, as News tells it", () => {
  test("[R-WORLD-008] [R-STATUS-011] given Ada abroad holding no pounds, when a tuition instalment goes unpaid, then News says what the miss costs, not the generic hit to standing and mood", async () => {
    const game = abroadGame();
    const tuition = game.view().obligations.find((owed) => owed.entry === "obligation.tuition" && owed.due > 0);
    if (tuition === undefined) throw new Error("No tuition falls due in Ada's first month abroad.");
    game.endTurn();
    await renderWithView(<PhoneApps onClose={() => undefined} area="Peckham" now={() => new Date(2026, 9, 8, 12, 5)} talk={null} />, game.view());
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="news"]')!);
    const report = document.querySelector("[data-report]")?.textContent ?? "";
    expect(report).toMatch(/withdraws you/);
    // The content's one line for every miss is never shown as it is: each miss says its own cost.
    expect(report).not.toContain("You could not pay");
  });
});

// after landing, a story about getting the visa is not for the character.
describe("for you in News", () => {
  async function storiesShown(view: ReturnType<typeof abroadView>) {
    await renderWithView(<PhoneApps onClose={() => undefined} area="Peckham" now={() => new Date(2026, 9, 9, 12, 5)} talk={null} />, view);
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="news"]')!);
    return [...document.querySelectorAll<HTMLElement>("[data-story]")];
  }
  const refusals = { id: "news.uk-refusals-up" as const, stage: "in-force" as const, since: 0, forYou: true };

  test("[R-WORLD-019] given Ada landed on the route a story names, when News opens, then the story is not marked for you: her visa is behind her", async () => {
    const view = abroadView();
    expect(view.routes.find((route) => route.id === "route.uk-masters")?.state).toBe("departed");
    const [story] = await storiesShown({ ...view, news: [{ ...refusals, since: view.month }] });
    expect(story?.textContent).not.toContain(say("ui.news.for-you"));
  });

  test("[R-WORLD-019] given a route still in play that a story names, when News opens, then the story is marked for you", async () => {
    const view = abroadView();
    const inPlay = { ...view, routes: view.routes.map((route) => (route.id === "route.uk-masters" ? { ...route, state: "known" as const } : route)), news: [{ ...refusals, since: view.month }] };
    const [story] = await storiesShown(inPlay);
    expect(story?.textContent).toContain(say("ui.news.for-you"));
  });
});
