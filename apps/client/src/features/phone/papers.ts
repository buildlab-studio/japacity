// The papers as the phone's Papers app holds them (docs/rules/world.md R-WORLD-019; document.md R-DOCUMENT-008):
// every paper the life has or is waiting on, each with its state, what it counts toward,
// and the act that moves it. An act that is a call or a message in real life (the registry, the council, the assessment
// body) is taken on the phone; one that is a visit (the passport office, the test centre, the clinic) says where and
// opens the map on it. Pure: read from the view and content only.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { formatBand } from "../../shared/words/format";
import { savingsRoute } from "../../shared/words/savings";
import { inMonths, runningName } from "../../shared/words/text";
import { phoneWords } from "./phone.words";

/**
 * The paper acts that are a call or a message in real life, taken on the phone: the transcript asked of the registry,
 * the degree sent for assessment, the council's verification and the licence's renewal.
 */
export const PHONE_ACTS: ReadonlySet<string> = new Set(["activity.get-transcript", "activity.get-eca", "activity.request-verification", "activity.renew-licence"]);

/** Where a paper stands: held and in date, on its way (a renewal of one held among them), run out, or not yet asked for. */
export type PaperState = "held" | "coming" | "expired" | "not-yet";

export interface PaperAct {
  activity: string;
  /** `phone`: taken in the app. `visit`: taken at `place`, which the app names and opens the map on. */
  how: "phone" | "visit";
  place: string | null;
}

export interface PaperRow {
  /** The document's id, or a status id for the visa. */
  id: string;
  kind: "document" | "visa";
  state: PaperState;
  /** The month a copy is due, while one is on its way (R-DOCUMENT-008). */
  onItsWay: number | null;
  expiresMonth: number | null;
  value: number | null;
  /** The routes it counts toward, the plan's first. */
  counts: string[];
  /** The act that moves it now, or null when there is none to take. */
  act: PaperAct | null;
}

type PapersView = PlayerView;

/** The documents a route's checklist asks to be held, in its order. */
function papersAsked(route: string): string[] {
  const entry = content.route[route as keyof typeof content.route];
  return (entry?.checklist ?? []).flatMap((item) => (item.requirement.type === "document/held" ? [item.requirement.document as string] : []));
}

/** The activity that requests a document, from content: the one whose effects ask for it. */
export function requestOf(document: string): string | null {
  const entry = Object.values(content.activity).find((activity) => activity.effects.some((effect) => effect.type === "document/request" && effect.document === document));
  return entry?.id ?? null;
}

/** The first place on this side of the flight that stages an act, or null. */
export function placeOf(activity: string, where: PlayerView["place"]["where"]): string | null {
  return Object.values(content.place).find((place) => place.where === where && (place.stages as readonly string[]).includes(activity))?.id ?? null;
}

/** The act that moves a paper now: its request where the view offers it, on the phone or at its place. */
function actOf(view: PapersView, document: string): PaperAct | null {
  const activity = requestOf(document);
  if (activity === null) return null;
  const option = view.activities.find((candidate) => candidate.id === activity);
  if (option?.allowed !== true) return null;
  if (PHONE_ACTS.has(activity)) return { activity, how: "phone", place: null };
  const place = placeOf(activity, view.place.where);
  return place === null ? null : { activity, how: "visit", place };
}

/** A paper with a copy being made is on its way, a held one being renewed among them (R-DOCUMENT-008). */
function stateOf(paper: PlayerView["documents"][number]): PaperState {
  if (paper.onItsWay !== null || paper.state === "pending") return "coming";
  return paper.state === "held" ? "held" : "expired";
}

/** The plan's route, as the Bank's saved figure and Japa read it, else the way the chapters follow. */
function planOf(view: PapersView): string | null {
  return view.plan.route ?? savingsRoute(view)?.id ?? null;
}

/** The routes in play whose checklist asks for the paper, the plan's first. */
function countsOf(view: PapersView, document: string, plan: string | null): string[] {
  const routes = view.routes.filter((route) => route.state !== "unknown" && papersAsked(route.id).includes(document)).map((route) => route.id as string);
  return plan !== null && routes.includes(plan) ? [plan, ...routes.filter((route) => route !== plan)] : routes;
}

/** The visa as a paper once it is granted, and the status held after the flight. */
function visaRow(view: PapersView): PaperRow | null {
  if (view.status !== null) return { id: view.status.entry, kind: "visa", state: "held", onItsWay: null, expiresMonth: null, value: null, counts: [], act: null };
  const granted = view.routes.find((route) => route.state === "granted");
  const status = granted === undefined ? null : (content.route[granted.id]?.status ?? null);
  return status === null || granted === undefined ? null : { id: status, kind: "visa", state: "held", onItsWay: null, expiresMonth: null, value: null, counts: [granted.id], act: null };
}

/**
 * Every paper the life has or is waiting on (R-WORLD-019): the visa first once granted; then the papers the plan's
 * route asks for in its order, each held, on its way, run out or not yet; then any other paper the life holds.
 */
export function papersOf(view: PapersView): PaperRow[] {
  const plan = planOf(view);
  const asked = plan === null ? [] : papersAsked(plan);
  const held = view.documents.map((paper) => paper.id as string);
  const order = [...asked, ...held.filter((id) => !asked.includes(id))];
  const rows: PaperRow[] = order.map((id) => {
    const paper = view.documents.find((candidate) => candidate.id === id);
    const counts = countsOf(view, id, plan);
    const act = actOf(view, id);
    if (paper === undefined) return { id, kind: "document", state: "not-yet", onItsWay: null, expiresMonth: null, value: null, counts, act };
    return { id, kind: "document", state: stateOf(paper), onItsWay: paper.onItsWay, expiresMonth: paper.expiresMonth, value: paper.value, counts, act };
  });
  const visa = visaRow(view);
  return visa === null ? rows : [visa, ...rows];
}

/** The paper lines of the month that tell a paper landed or moved, by the line's last word (document.md's lines). */
const NOTICE_LINES: Readonly<Record<string, string>> = {
  issued: "issued",
  "issued-band": "issued-band",
  // A paper bought from a scammer lands as any other: the phone never tells which is fake (R-ADVICE-008).
  faked: "issued",
  hastened: "hastened",
  requested: "requested",
  expired: "expired",
  voided: "voided",
};

/** A paper landing or moving, told on the phone (R-WORLD-030): `kind` picks the words, `document` the paper. */
export interface PaperNotice {
  kind: string;
  document: string;
  /** The month a copy is now due, for a paper on its way or brought forward. */
  month: number | null;
  /** The English result's band times ten. */
  band: number | null;
}

/** The month's paper notices, from the report's lines, in their order. */
export function paperNotices(view: Pick<PlayerView, "report">): PaperNotice[] {
  return (view.report?.lines ?? []).flatMap((line) => {
    const kind = line.key.startsWith("line.document.") ? NOTICE_LINES[line.key.slice("line.document.".length)] : undefined;
    const document = line.params.document;
    if (kind === undefined || typeof document !== "string") return [];
    const month = typeof line.params.month === "number" ? line.params.month : null;
    const band = typeof line.params.band === "number" ? line.params.band : null;
    return [{ kind, document, month, band }];
  });
}

/** The Papers app's mark (R-WORLD-018's dot): the month's paper notices, empty when none landed or moved. */
export function papersMarkOf(view: Pick<PlayerView, "report">): string {
  const notices = paperNotices(view);
  return notices.length === 0 ? "" : `${String(view.report?.month ?? 0)}:${notices.map((notice) => `${notice.kind}.${notice.document}`).join(",")}`;
}

/** A paper notice's words: the paper's own where the phone has them ("The council has verified your licence."), else the kind's. */
export function paperNoticeWords(notice: PaperNotice, month: number): string {
  const own = `phone.papers.notice.${notice.kind}.${notice.document}`;
  const key = phoneWords(own) === own ? `phone.papers.notice.${notice.kind}` : own;
  return phoneWords(key, { paper: runningName(notice.document), when: notice.month === null ? "" : inMonths(notice.month, month), band: notice.band === null ? "" : formatBand(notice.band) });
}
