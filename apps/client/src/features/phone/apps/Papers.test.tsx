// The Papers app (docs/rules/world.md R-WORLD-018, R-WORLD-019, R-WORLD-030; document.md R-DOCUMENT-008; the maintainer,
// 10 Oct 2026, 23:00 and 23:32): every paper with its state and what it counts toward; the calls and messages taken on
// the phone through the act's own card, the passport a visit that opens the map on the passport office; and a paper
// that landed or moved told on the wallpaper, tappable into Papers, opening nothing by itself.
import type { PlayerView, ReportLine } from "@japacity/sim";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useGame } from "../../../authority/GameProvider";
import { CITY_LAST_KEY } from "../../../shared/days/standing";
import { newGame, recordedGame, richView, viewAfter } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { nowLineWords } from "../../../shared/words/acts";
import { formatBand } from "../../../shared/words/format";
import { forMonths, inMonths, nameOf, runningName, say } from "../../../shared/words/text";
import { PHONE_ACTS, paperNotices, papersMarkOf, papersOf, placeOf, requestOf } from "../papers";
import { PhoneApps } from "../PhoneApps";
import { phoneWords } from "../phone.words";
import { marksOf, reloadSeen, waitingOf } from "../seen";

const UK = "route.uk-masters";
const PASSPORT = "document.passport";
const TRANSCRIPT = "document.transcript";
const GET_TRANSCRIPT = "activity.get-transcript";
const NOON = () => new Date(2026, 9, 11, 12, 0);

beforeEach(() => {
  localStorage.clear();
  reloadSeen();
});

/** A stand-in for the shell's card: its button sends the act at once, as the card's own does for a paper (R-ACTIVITY-015). */
function StandInCard({ id }: { id: string }) {
  const send = useGame((state) => state.send);
  return (
    <button type="button" data-stand-in-card={id} onClick={() => void send({ type: "activity/now", activity: id as typeof GET_TRANSCRIPT, param: null })}>
      {nameOf(id)}
    </button>
  );
}

async function openPhone(view: PlayerView, start: string | null = null, onMap?: (stop: string) => void) {
  return renderWithView(<PhoneApps onClose={() => undefined} area="Ojuelegba" now={NOON} talk={null} start={start} cards={(ids) => <StandInCard id={ids[0] ?? ""} />} {...(onMap === undefined ? {} : { onMap })} />, view);
}

/** Ada with the UK master's looked into: the passport, the transcript and the English result asked for, none held. */
function adaPlanned(): PlayerView {
  const view = viewAfter(newGame("scenario.ada"), [
    { type: "route/hear", route: UK, via: "test" },
    { type: "route/look-into", route: UK },
  ]);
  if (view.routes.find((route) => route.id === UK)?.state !== "known") throw new Error("Ada has not looked into the master's.");
  return view;
}

function line(key: string, params: ReportLine["params"]): ReportLine {
  return { key, params, tone: "good", attention: false, counts: [] };
}

/** The view with a month's report carrying these lines. */
function withReport(view: PlayerView, lines: ReportLine[]): PlayerView {
  return { ...view, report: { month: view.month - 1, lines, japacityBefore: null, japacityAfter: null, attention: false } };
}

describe("the Papers app", () => {
  test("[R-WORLD-018] [R-WORLD-019] given the phone, when its apps are read, then Papers sits beside Japa with its own tint, and the papers box's acts are in it", async () => {
    await openPhone(adaPlanned());
    const apps = [...document.querySelectorAll("[data-app]")].map((app) => app.getAttribute("data-app"));
    expect(apps.indexOf("papers")).toBe(apps.indexOf("japa") + 1);
    expect(document.querySelector<HTMLElement>('[data-app="papers"]')?.style.background).toBe("var(--app-papers)");
    expect(PHONE_ACTS).toEqual(new Set(["activity.get-transcript", "activity.get-eca", "activity.request-verification", "activity.renew-licence"]));
  });

  test("[R-WORLD-019] [R-DOCUMENT-008] given Ada with the master's looked into and no paper yet, when Papers opens, then every paper the plan asks for is there, not yet, counting toward the master's, the transcript a call on the phone and the passport a visit to the passport office", async () => {
    const view = adaPlanned();
    const onMap = vi.fn();
    await openPhone(view, null, onMap);
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="papers"]')!);
    const rows = [...document.querySelectorAll<HTMLElement>("[data-paper]")];
    expect(rows.map((row) => row.dataset.paper)).toEqual(expect.arrayContaining([PASSPORT, TRANSCRIPT, "document.english-test"]));
    for (const row of rows) {
      expect(row.dataset.state).toBe("not-yet");
      expect(row.textContent).toContain(phoneWords("phone.papers.not-yet"));
      expect(row.querySelector("[data-paper-counts]")?.textContent).toBe(phoneWords("phone.papers.for", { routes: runningName(UK) }));
    }
    const transcript = document.querySelector<HTMLElement>(`[data-paper="${TRANSCRIPT}"] [data-paper-act]`);
    expect(transcript?.dataset.actHow).toBe("phone");
    expect(transcript?.textContent).toBe(nameOf(GET_TRANSCRIPT));
    const passport = document.querySelector<HTMLElement>(`[data-paper="${PASSPORT}"] [data-paper-act]`);
    expect(passport?.dataset.actHow).toBe("visit");
    expect(passport?.dataset.actPlace).toBe("place.passport-office");
    expect(passport?.textContent).toBe(phoneWords("phone.papers.at", { place: say("place.passport-office.name") }));
    fireEvent.click(passport!);
    expect(onMap).toHaveBeenCalledWith("place.passport-office");
    // The English result waits on the passport: no act is offered for it yet.
    expect(document.querySelector('[data-paper="document.english-test"] [data-paper-act]')).toBeNull();
  });

  test("[R-WORLD-019] [R-ACTIVITY-015] [R-WORLD-026] given the transcript's act on the phone, when it is tapped, then its card opens in Papers, and once sent the registry's answer is told in the corner and the list comes back", async () => {
    const { authority } = await openPhone(adaPlanned());
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="papers"]')!);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-paper-act="${GET_TRANSCRIPT}"]`)!);
    expect(document.querySelector("[data-paper-card]")?.getAttribute("data-paper-card")).toBe(GET_TRANSCRIPT);
    const now = line(`line.activity.get-transcript.now`, { activity: GET_TRANSCRIPT, month: 3 });
    authority.linesNext([now]);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-stand-in-card="${GET_TRANSCRIPT}"]`)!);
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "activity/now", activity: GET_TRANSCRIPT }));
    expect(await screen.findByText(nowLineWords(now))).toBeTruthy();
    expect(document.querySelector("[data-paper-card]")).toBeNull();
    expect(document.querySelector("[data-papers]")).not.toBeNull();
  });

  test("[R-WORLD-003] [R-WORLD-019] given the phone opened on Papers with an act, as the nudge's step opens it, then that act's card shows at once", async () => {
    await openPhone(adaPlanned(), `papers:${GET_TRANSCRIPT}`);
    expect(document.querySelector("[data-paper-card]")?.getAttribute("data-paper-card")).toBe(GET_TRANSCRIPT);
  });

  test("[R-WORLD-019] given an act not offered, when the phone opens on it, then Papers opens on its list", async () => {
    await openPhone(adaPlanned(), "papers:activity.renew-licence");
    expect(document.querySelector("[data-paper-card]")).toBeNull();
    expect(document.querySelector("[data-papers]")).not.toBeNull();
  });

  test("[R-WORLD-019] [R-DOCUMENT-008] given papers held, run out and on their way, when they are read, then each says its state in words with no month number, and a held paper being renewed is on its way", () => {
    const view = richView();
    const rows = papersOf(view);
    const state = (id: string) => rows.find((row) => row.id === id)?.state;
    expect(state(PASSPORT)).toBe("held");
    expect(state(TRANSCRIPT)).toBe("coming");
    const renewing = viewAfter(newGame("scenario.tunde"), [{ type: "document/request", document: PASSPORT }]);
    expect(papersOf(renewing).find((row) => row.id === PASSPORT)?.state).toBe("coming");
    const lapsed: PlayerView = { ...view, documents: view.documents.map((paper) => (paper.id === PASSPORT ? { ...paper, state: "expired", expiresMonth: null } : paper)) };
    expect(papersOf(lapsed).find((row) => row.id === PASSPORT)?.state).toBe("expired");
    expect(forMonths(130, view.month)).not.toMatch(/month \d/i);
  });

  test("[R-WORLD-019] given a visa granted, when Papers opens, then the visa leads the list, held, named as the status it gives", async () => {
    const view = recordedGame("ada-careful", 1).view();
    const granted = view.routes.find((route) => route.state === "granted");
    if (granted === undefined) throw new Error("No visa granted.");
    const [first] = papersOf(view);
    expect(first).toMatchObject({ kind: "visa", state: "held" });
    await openPhone(view);
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="papers"]')!);
    const visa = document.querySelector<HTMLElement>('[data-paper][data-kind="visa"]');
    expect(visa?.textContent).toContain(nameOf(first?.id ?? ""));
    expect(visa?.textContent).toContain(phoneWords("phone.papers.visa"));
  });

  test("[R-WORLD-019] given the papers' acts, when they are read from content, then each paper's request is found, the calls are on the phone, and the passport is staged at the passport office alone", () => {
    expect(requestOf(TRANSCRIPT)).toBe(GET_TRANSCRIPT);
    expect(requestOf(PASSPORT)).toBe("activity.get-passport");
    expect(placeOf("activity.get-passport", "home")).toBe("place.passport-office");
    for (const call of PHONE_ACTS) expect(placeOf(call, "home")).toBeNull();
  });
});

describe("a result sealed until the morning", () => {
  test("[R-CLOCK-032] given the English result sealed, pending in the month it was due, when Papers opens, then its card says it comes tomorrow at seven, and a result due later still says when", async () => {
    const view = adaPlanned();
    const pending = (readyMonth: number): PlayerView => ({ ...view, documents: [...view.documents, { id: "document.english-test", state: "pending", readyMonth, expiresMonth: null, value: null, onItsWay: readyMonth }] });
    await openPhone(pending(view.month));
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="papers"]')!);
    expect(document.querySelector('[data-paper="document.english-test"] [data-paper-state]')?.textContent).toBe("Comes in the morning");
    expect(papersOf(pending(view.month + 1)).find((row) => row.id === "document.english-test")?.state).toBe("coming");
    cleanup();
    await openPhone(pending(view.month + 1));
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="papers"]')!);
    expect(document.querySelector('[data-paper="document.english-test"] [data-paper-state]')?.textContent).toBe(phoneWords("phone.papers.pending", { when: inMonths(view.month + 1, view.month) }));
  });
});

describe("a paper that lands or moves", () => {
  const issued = line("line.document.issued", { document: TRANSCRIPT });
  const verified = line("line.document.issued", { document: "document.nmcn-verification" });

  test("[R-WORLD-030] [R-DOCUMENT-008] given the transcript issued at the month's end, when the phone opens, then the wallpaper tells it, Papers carries the dot, nothing opens by itself, and a tap opens Papers, after which the line and the dot are gone", async () => {
    const view = withReport(adaPlanned(), [issued]);
    expect(waitingOf(marksOf(view), {}).papers).toBe(true);
    await openPhone(view);
    // Never an interruption: the phone opens on its home screen.
    expect(document.querySelector("[data-app-screen]")).toBeNull();
    const notice = document.querySelector<HTMLElement>(`[data-paper-notice="issued.${TRANSCRIPT}"]`);
    // A notice names its app over its words, as the after set's lock screen does.
    expect(notice?.querySelector("[data-notice-words]")?.textContent).toBe("Your transcript is ready to collect.");
    expect(notice?.textContent).toBe(`${phoneWords("phone.app.papers")}Your transcript is ready to collect.`);
    expect(document.querySelector('[data-app="papers"] [data-dot]')).not.toBeNull();
    fireEvent.click(notice!);
    expect(document.querySelector("[data-app-screen]")?.getAttribute("data-app-screen")).toBe("papers");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(document.querySelector("[data-paper-notices]")).toBeNull();
    expect(document.querySelector('[data-app="papers"] [data-dot]')).toBeNull();
  });

  test("[R-WORLD-030] given the council's verification issued, a paper run out, the English result out and a copy on its way, when the notices are read, then each is told in its own words, and a month with no paper line has none and no dot", () => {
    const view = withReport(adaPlanned(), [
      verified,
      line("line.document.expired", { document: PASSPORT }),
      line("line.document.issued-band", { document: "document.english-test", band: 65 }),
      line("line.document.requested", { document: TRANSCRIPT, month: adaPlanned().month + 2 }),
      line("line.activity.rest", {}),
    ]);
    const notices = paperNotices(view);
    expect(notices.map((notice) => `${notice.kind}.${notice.document}`)).toEqual([
      "issued.document.nmcn-verification",
      `expired.${PASSPORT}`,
      "issued-band.document.english-test",
      `requested.${TRANSCRIPT}`,
    ]);
    expect(phoneWords("phone.papers.notice.issued.document.nmcn-verification")).toBe("The council has verified your licence.");
    expect(phoneWords("phone.papers.notice.issued-band", { band: formatBand(65) })).toBe(`Your English result is out: band ${formatBand(65)}.`);
    expect(phoneWords("phone.papers.notice.requested", { paper: runningName(TRANSCRIPT), when: inMonths(view.month + 2, view.month) })).toMatch(/^Your degree transcript is on its way, ready in 2 months\.$/);
    expect(papersMarkOf(withReport(adaPlanned(), [line("line.activity.rest", {})]))).toBe("");
    expect(papersMarkOf({ report: null })).toBe("");
  });

  test("[R-WORLD-030] given a paper notice and the character on the street, when the phone opens, then the paper is told all the same, as a message from the office, while the month's own lines wait for home", async () => {
    localStorage.setItem(CITY_LAST_KEY, JSON.stringify(["place.yaba"]));
    await openPhone(withReport(adaPlanned(), [verified]));
    expect(document.querySelector('[data-paper-notice="issued.document.nmcn-verification"] [data-notice-words]')?.textContent).toBe("The council has verified your licence.");
  });
});

