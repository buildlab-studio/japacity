// Envelopes: the one place the real clock shows (docs/rules/clock.md R-CLOCK-032; decision 0034;
// docs/design/12-the-lived-month-and-the-files.md). A result real life makes you wait for, the English
// test's band, the endorsing body's answer, a visa decision, is worked out by the simulation as the month
// turns, as ever, and the authority holds it back until the next morning in Lagos. Nothing here reads a
// clock: `now` and the morning are given. The simulation's state never changes; only what the view says.
import { divFloor } from "./int";
import { DAY_MS, HOUR_MS, LAGOS_OFFSET_MS, MORNING_HOUR_LAGOS } from "./time";
import type { Id, PlayerView, ReportLine, RouteView } from "./types";

type DocumentEntry = PlayerView["documents"][number];

/** A result held back until its morning. `was` is the view's entry before the result landed; `held` the lines that told it. */
export type Envelope =
  | { kind: "document"; id: Id<"document">; opensAt: number; was: DocumentEntry; held: ReportLine[] }
  | { kind: "route"; id: Id<"route">; opensAt: number; was: RouteView; held: ReportLine[] };

/** The papers whose result real life delays: a board marks, a body decides. A passport is printed in life's time. */
export const REAL_WAIT_DOCUMENTS: readonly Id<"document">[] = ["document.english-test", "document.endorsement"];

/** The next 07:00 in Lagos after `now` (R-CLOCK-032): Lagos keeps UTC+1 all year. */
export function nextMorning(now: number): number {
  const lagos = now + LAGOS_OFFSET_MS;
  const dayStart = divFloor(lagos, DAY_MS) * DAY_MS;
  const morning = dayStart + MORNING_HOUR_LAGOS * HOUR_MS;
  return (lagos < morning ? morning : morning + DAY_MS) - LAGOS_OFFSET_MS;
}

function documentOf(view: PlayerView, id: Id<"document">): DocumentEntry | undefined {
  return view.documents.find((entry) => entry.id === id);
}

function routeOf(view: PlayerView, id: Id<"route">): RouteView | undefined {
  return view.routes.find((entry) => entry.id === id);
}

function linesFor(lines: readonly ReportLine[], prefix: string, param: string, id: string): ReportLine[] {
  return lines.filter((line) => line.key.startsWith(prefix) && line.params[param] === id);
}

/**
 * The results that landed between `before` and `after` which real life makes you wait for, each sealed until
 * `opensAt`. A paper's result: pending before, held after. A decision: applying before, granted or refused after.
 */
export function sealFrom(before: PlayerView, after: PlayerView, lines: readonly ReportLine[], opensAt: number): Envelope[] {
  const sealed: Envelope[] = [];
  for (const id of REAL_WAIT_DOCUMENTS) {
    const was = documentOf(before, id);
    const now = documentOf(after, id);
    if (was === undefined || now === undefined || was.state !== "pending" || now.state !== "held") continue;
    sealed.push({ kind: "document", id, opensAt, was, held: linesFor(lines, "line.document.issued", "document", id) });
  }
  for (const now of after.routes) {
    const was = routeOf(before, now.id);
    if (was === undefined || was.state !== "applying" || (now.state !== "granted" && now.state !== "refused")) continue;
    sealed.push({ kind: "route", id: now.id, opensAt, was, held: [...linesFor(lines, "line.route.granted", "route", now.id), ...linesFor(lines, "line.route.refused", "route", now.id)] });
  }
  return sealed;
}

/** True while the envelope's morning has not come. */
export const sealedAt = (envelope: Envelope, now: number): boolean => envelope.opensAt > now;

/**
 * The view as the player may see it now: every sealed result reads as it did before it landed, the paper
 * still on its way this month, the decision still pending. Envelopes whose morning has come are left as the
 * view has them and returned as `opened`, with the lines they held, for the morning to tell once.
 */
export function withhold(view: PlayerView, envelopes: readonly Envelope[], now: number): { view: PlayerView; opened: Envelope[] } {
  const opened: Envelope[] = [];
  let shown = view;
  for (const envelope of envelopes) {
    if (!sealedAt(envelope, now)) {
      opened.push(envelope);
      continue;
    }
    if (envelope.kind === "document") {
      const was = { ...envelope.was, readyMonth: view.month };
      shown = { ...shown, documents: shown.documents.map((entry) => (entry.id === envelope.id ? was : entry)) };
    } else {
      const was = { ...envelope.was, visa: envelope.was.visa === null ? null : { ...envelope.was.visa, decisionMonth: view.month } };
      shown = { ...shown, routes: shown.routes.map((entry) => (entry.id === envelope.id ? was : entry)) };
    }
  }
  return { view: shown, opened };
}

/** The lines a reply may carry now: the ones a sealed envelope holds are kept back. */
export function withholdLines(lines: readonly ReportLine[], envelopes: readonly Envelope[], now: number): ReportLine[] {
  const held = new Set(envelopes.filter((envelope) => sealedAt(envelope, now)).flatMap((envelope) => envelope.held));
  return lines.filter((line) => !held.has(line));
}
