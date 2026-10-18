// The context pill in the app heads (world:phone-rises-over-scene):
// the phone's contract carries a few words of what is there now, drawn as a pill beside the app's name; Jobs, Lotto, Bills
// and Bank fill it from the view, and nothing counts days.
import type { PlayerView } from "@japacity/sim";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { abroadView, engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { resetLines } from "../../shared/world/Lines";
import { shortNaira } from "./apps/passbook.words";
import { appContext } from "./context";
import { PhoneApps } from "./PhoneApps";
import { APP_IDS, reloadSeen } from "./seen";
import { say } from "../../shared/words/text";

beforeEach(() => {
  resetLines();
  localStorage.clear();
  reloadSeen();
});

type Owed = PlayerView["obligations"][number];

/** A bill as the view carries it, from an entry: nothing due now unless said. */
function owed(entry: string, more: Partial<Owed> = {}): Owed {
  return { id: `o-${entry}`, entry, due: 0, missed: 0, outstanding: 0, state: "active", openedMonth: 0, ...more } as unknown as Owed;
}

/** Nothing a pill says counts days. */
const DAYS = /\bdays?\b/i;

describe("the context pill's words", () => {
  test("[world:phone-rises-over-scene] given the hunt's open jobs and an offer waiting, when Jobs' pill is read, then the offer comes first, else the jobs open", () => {
    const base = engineView();
    const hunt = { id: "activity.job-hunt", allowed: true, params: ["activity.job-a", "activity.job-b", "activity.job-c", "activity.job-d", "activity.job-e"] } as unknown as PlayerView["activities"][number];
    const open: PlayerView = { ...base, activities: [hunt], offers: [] };
    expect(appContext("jobs", open)).toBe(say("phone.context.jobs.open", { count: 5 }));
    expect(appContext("jobs", open)).toBe("5 open");
    const offer = { ...base.offers[0], id: "offer-9", entry: "offer.job" } as unknown as PlayerView["offers"][number];
    expect(appContext("jobs", { ...open, offers: [offer] })).toBe("1 offer");
    expect(appContext("jobs", { ...open, activities: [] })).toBeNull();
  });

  test("[world:phone-rises-over-scene] given jobs open on the board and no offer, when Jobs opens, then its screen counts the same jobs the pill counts and never says there is nothing", async () => {
    // The trap: the pill saying "8 open" over "No job offers right now."
    const base = engineView();
    const hunt = { id: "activity.job-hunt", allowed: true, params: ["activity.job-a", "activity.job-b", "activity.job-c"] } as unknown as PlayerView["activities"][number];
    const view: PlayerView = { ...base, activities: [hunt], offers: [] };
    expect(appContext("jobs", view)).toBe("3 open");
    await renderWithView(<PhoneApps onClose={() => undefined} area="Yaba" talk={null} />, view);
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="jobs"]')!);
    expect(document.querySelector("[data-app-context]")?.textContent).toBe("3 open");
    const said = document.querySelector<HTMLElement>("[data-jobs-none]")!;
    expect(said.textContent).toBe(say("phone.jobs.offers.board", { count: 3 }));
    expect(document.body.textContent).not.toContain(say("phone.jobs.offers.none"));
  });

  test("[world:phone-rises-over-scene] [luck:kiosk-sells-lotto-tickets] given a life in Lagos, when Lotto's pill is read, then it says the draw is on Friday; abroad with no online draw it says nothing", () => {
    expect(appContext("lotto", engineView())).toBe("Draw on Friday");
    const abroad = abroadView();
    expect(appContext("lotto", { ...abroad, lottery: null })).toBeNull();
  });

  test("[world:phone-rises-over-scene] [obligation:prepaid-entries-skip-first-charge] given bills, when Bills' pill is read, then what is due now is counted, else the next rent is said in months", () => {
    const base = engineView();
    expect(appContext("bills", { ...base, obligations: [owed("obligation.upkeep", { due: 1 }), owed("obligation.salary-loan", { due: 2 })] })).toBe("2 to pay");
    expect(appContext("bills", { ...base, obligations: [owed("obligation.upkeep", { due: 1 })] })).toBe("1 to pay");
    // The year's rent paid on moving in at month 0 is next taken at month 12: from month 8, in three months.
    const rent = appContext("bills", { ...base, month: 8, obligations: [owed("obligation.rent-compound")] });
    expect(rent).toBe("Rent in 3 months");
    expect(appContext("bills", { ...base, obligations: [] })).toBeNull();
  });

  test("[world:phone-rises-over-scene] [wallet:passbook-against-plan-cost] given the passbook, when Bank's pill is read, then it names the next stamp, the target last, and all in once every stamp is reached", () => {
    const base = engineView();
    const book = (stamps: { at: number; month: number | null; target: boolean }[]): PlayerView => ({ ...base, passbook: { held: 0, target: null, stamps, pace: null, months: null, roads: [], best: null } });
    expect(appContext("bank", book([{ at: 100_000_000, month: 3, target: false }, { at: 250_000_000, month: null, target: false }]))).toBe(`Next stamp ${shortNaira(250_000_000)}`);
    expect(appContext("bank", book([{ at: 900_000_000, month: null, target: true }]))).toBe(say("phone.context.bank.target", { amount: shortNaira(900_000_000) }));
    expect(appContext("bank", book([{ at: 100_000_000, month: 3, target: false }]))).toBe("All in");
    expect(appContext("bank", { ...base, passbook: null })).toBeNull();
  });

  test("[world:phone-rises-over-scene] given every app on a rich life and a new one, when the pills are read, then only Jobs, Lotto, Bills and Bank have one, and none counts days", () => {
    for (const view of [engineView(), richView()]) {
      for (const id of APP_IDS) {
        const said = appContext(id, view);
        const fills = ["jobs", "lotto", "bills", "bank"].includes(id);
        expect({ id, none: fills || said === null }).toEqual({ id, none: true });
        expect(DAYS.test(said ?? "")).toBe(false);
      }
    }
    expect(APP_IDS.filter((id) => appContext(id, { ...richView(), ended: true }) !== null)).toEqual([]);
  });
});

describe("the pill in the app's head", () => {
  test("[world:phone-rises-over-scene] given the phone open on a rich life, when Lotto and Bills open, then the pill stands beside the app's name with the view's words, and an app with nothing to say has none", async () => {
    const view = richView();
    await renderWithView(<PhoneApps onClose={() => undefined} area="Ojuelegba" calendar={() => <div data-phone-app="calendar" />} onMap={() => undefined} />, view);
    for (const id of ["lotto", "bills", "chats"]) {
      fireEvent.click(document.querySelector<HTMLElement>(`[data-app="${id}"]`)!);
      const head = document.querySelector<HTMLElement>("[data-app-head]")!;
      const pill = head.querySelector("[data-app-context]");
      const said = appContext(id, view);
      expect({ id, pill: pill?.textContent ?? null }).toEqual({ id, pill: said });
      // The pill stands beside the name, in the same row.
      expect(pill === null || pill.parentElement?.querySelector("h2")?.textContent === say(`phone.app.${id}`)).toBe(true);
      fireEvent.click(document.querySelector<HTMLElement>("[data-phone-back]")!);
    }
    expect(appContext("lotto", view)).not.toBeNull();
  });
});
