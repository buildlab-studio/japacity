import { describe, expect, test } from "vitest";

import { nextMorning, sealFrom, withhold, withholdLines } from "./envelope";
import { DAY_MS, HOUR_MS } from "./time";
import type { PlayerView, ReportLine, RouteView } from "./types";

/** A moment in Lagos on a day of October 2026, from the epoch of 1 October 2026 00:00 UTC: Lagos is UTC+1, so 07:00 Lagos is 06:00 UTC. */
const OCTOBER_2026 = 1_790_812_800_000;
const lagos = (day: number, hour: number, minute = 0) => OCTOBER_2026 + (day - 1) * DAY_MS + (hour - 1) * HOUR_MS + minute * 60_000;

const ENGLISH = "document.english-test";
const TALENT = "route.uk-talent";

function viewWith(documents: PlayerView["documents"], routes: RouteView[] = [], month = 4): PlayerView {
  return { month, documents, routes } as unknown as PlayerView;
}

const pending = { id: ENGLISH, state: "pending", readyMonth: 4, expiresMonth: null, value: null, onItsWay: null } as PlayerView["documents"][number];
const held = { id: ENGLISH, state: "held", readyMonth: 4, expiresMonth: 28, value: 70, onItsWay: null } as PlayerView["documents"][number];
const applying = { id: TALENT, state: "applying", visa: { submittedMonth: 10, decisionMonth: 11 } } as unknown as RouteView;
const granted = { id: TALENT, state: "granted", visa: { submittedMonth: 10, decisionMonth: 11 } } as unknown as RouteView;

const band: ReportLine = { key: "line.document.issued-band-met", params: { document: ENGLISH, band: 7, needed: 6 }, tone: "good", attention: true, counts: [] };
const visa: ReportLine = { key: "line.route.granted", params: { route: TALENT }, tone: "good", big: true, attention: true, counts: [] };
const pay: ReportLine = { key: "line.wallet.pay", params: {}, tone: "good", attention: false, counts: [] };

describe("the next morning in Lagos", () => {
  test("[R-CLOCK-032] given an evening, when the morning is worked out, then it is seven the next day in Lagos", () => {
    expect(nextMorning(lagos(11, 21))).toBe(lagos(12, 7));
  });
  test("[R-CLOCK-032] given a time before seven, when the morning is worked out, then it is seven that same day", () => {
    expect(nextMorning(lagos(12, 6, 59))).toBe(lagos(12, 7));
    expect(nextMorning(lagos(12, 7))).toBe(lagos(13, 7));
  });
});

describe("sealing a result", () => {
  test("[R-CLOCK-032] given the English result and a visa decision landing with the month, when sealed, then both are envelopes with their lines held and a passport is not", () => {
    const before = viewWith([pending, { ...pending, id: "document.passport" }], [applying]);
    const after = viewWith([held, { ...held, id: "document.passport", value: null }], [granted]);
    const sealed = sealFrom(before, after, [band, visa, pay], lagos(12, 7));
    expect(sealed.map((envelope) => [envelope.kind, envelope.id, envelope.opensAt])).toEqual([
      ["document", ENGLISH, lagos(12, 7)],
      ["route", TALENT, lagos(12, 7)],
    ]);
    expect(sealed[0]?.held).toEqual([band]);
    expect(sealed[1]?.held).toEqual([visa]);
  });

  test("[R-CLOCK-032] given a result already held before the month, when sealed, then nothing is sealed", () => {
    expect(sealFrom(viewWith([held]), viewWith([held]), [band], lagos(12, 7))).toEqual([]);
  });
});

describe("withholding a sealed result", () => {
  const sealed = sealFrom(viewWith([pending], [applying]), viewWith([held], [granted], 5), [band, visa, pay], lagos(12, 7));

  test("[R-CLOCK-032] given the evening before, when the view is shown, then the paper is still on its way this month, the decision still pending, and their lines are kept back", () => {
    const shown = withhold(viewWith([held], [granted], 5), sealed, lagos(11, 23));
    expect(shown.opened).toEqual([]);
    expect(shown.view.documents[0]).toEqual({ ...pending, readyMonth: 5 });
    expect(shown.view.routes[0]).toEqual({ ...applying, visa: { submittedMonth: 10, decisionMonth: 5 } });
    expect(withholdLines([band, visa, pay], sealed, lagos(11, 23))).toEqual([pay]);
  });

  test("[R-CLOCK-032] given the morning has come, when the view is shown, then the result stands and the envelopes are opened with their lines", () => {
    const shown = withhold(viewWith([held], [granted], 5), sealed, lagos(12, 7));
    expect(shown.view.documents[0]).toEqual(held);
    expect(shown.view.routes[0]).toEqual(granted);
    expect(shown.opened.flatMap((envelope) => envelope.held)).toEqual([band, visa]);
    expect(withholdLines([band, visa, pay], sealed, lagos(12, 7) + HOUR_MS)).toEqual([band, visa, pay]);
  });

  test("[R-CLOCK-032] given a day passes, when the same envelopes are read again, then the answer is the same (a reload changes nothing)", () => {
    expect(withhold(viewWith([held], [granted], 5), sealed, lagos(12, 7) + DAY_MS).opened).toHaveLength(2);
    expect(withhold(viewWith([held], [granted], 5), sealed, lagos(12, 6)).opened).toHaveLength(0);
  });
});
