// The papers as the phone's Papers app holds them (world:phone-holds-what-phones-hold; document:paper-on-its-way):
// every paper the life has or is waiting on, each with its state, what it counts toward,
// and the act that moves it. An act that is a call or a message in real life (the registry, the council, the assessment
// body) is taken on the phone; one that is a visit (the passport office, the test centre, the clinic) says where and
// opens the map on it. Pure: read from the view and content only.
import { content } from "@japacity/content";
import type { PlayerView, Requirement } from "@japacity/sim";

import { formatBand } from "../../shared/words/format";
import { savingsRoute } from "../../shared/words/savings";
import { inMonths, runningName, say } from "../../shared/words/text";

/**
 * The paper acts that are a call or a message in real life, taken on the phone: the transcript asked of the registry,
 * the degree sent for assessment, the council's verification and the licence's renewal.
 */
export const PHONE_ACTS: ReadonlySet<string> = new Set(["activity.get-transcript", "activity.get-eca", "activity.request-verification", "activity.renew-licence", "activity.degree-english"]);

/** Where a paper stands: held and in date, on its way (a renewal of one held among them), run out, or not yet asked for. */
type PaperState = "held" | "coming" | "expired" | "not-yet";

interface PaperAct {
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
  /** The month a copy is due, while one is on its way (document:paper-on-its-way). */
  onItsWay: number | null;
  expiresMonth: number | null;
  value: number | null;
  /** The routes it counts toward, the plan's first. */
  counts: string[];
  /** The act that moves it now, or null when there is none to take. */
  act: PaperAct | null;
}

type PapersView = PlayerView;

/** True when the act that asks for a paper is open to this life by what it is: every quality it asks is met (a degree for the statement). */
function appliesTo(view: PapersView, document: string): boolean {
  const activity = requestOf(document);
  const entry = activity === null ? undefined : content.activity[activity as keyof typeof content.activity];
  return (entry?.requires ?? []).every((need) => need.type !== "quality/min" || (view.qualities.find((quality) => quality.id === need.quality)?.value ?? 0) >= need.value);
}

/** What the act that asks for a paper costs in naira, for choosing the cheaper of two papers that meet the same item. */
function nairaCost(document: string): number {
  const activity = requestOf(document);
  const entry = activity === null ? undefined : content.activity[activity as keyof typeof content.activity];
  return (entry?.cost ?? []).reduce((sum, cost) => sum + (cost.currency === "NGN" && typeof cost.amount === "number" ? cost.amount : 0), 0);
}

/**
 * The one paper an item met by any of several asks this life for (document:who-sits-the-english-test, document:degree-english-statement):
 * one held or on its way, else the cheapest whose act this life can take (the degree's statement for a graduate), else the first.
 * So the English test is listed only where it is still needed.
 */
function onePaperOf(view: PapersView, documents: readonly string[]): string | null {
  const have = documents.find((document) => view.documents.some((paper) => paper.id === document));
  if (have !== undefined) return have;
  const open = documents.filter((document) => appliesTo(view, document));
  if (open.length === 0) return documents[0] ?? null;
  return [...open].sort((a, b) => nairaCost(a) - nairaCost(b))[0] ?? null;
}

/** The documents one item asks for: the paper it names, or the one paper of an item any of several papers meet. */
function itemPapers(view: PapersView, requirement: Requirement): string[] {
  if (requirement.type === "document/held") return [requirement.document];
  if (requirement.type !== "any" || !requirement.of.every((option) => option.type === "document/held")) return [];
  const one = onePaperOf(view, requirement.of.flatMap((option) => (option.type === "document/held" ? [option.document as string] : [])));
  return one === null ? [] : [one];
}

/** The documents a route's checklist asks this life to hold, in its order. */
function papersAsked(view: PapersView, route: string): string[] {
  const entry = content.route[route as keyof typeof content.route];
  return (entry?.checklist ?? []).flatMap((item) => itemPapers(view, item.requirement));
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

/** A paper with a copy being made is on its way, a held one being renewed among them (document:paper-on-its-way). */
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
  const routes = view.routes.filter((route) => route.state !== "unknown" && papersAsked(view, route.id).includes(document)).map((route) => route.id as string);
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
 * Every paper the life has or is waiting on (world:phone-holds-what-phones-hold): the visa first once granted; then the papers the plan's
 * route asks for in its order, each held, on its way, run out or not yet; then any other paper the life holds.
 */
export function papersOf(view: PapersView): PaperRow[] {
  const plan = planOf(view);
  const asked = plan === null ? [] : papersAsked(view, plan);
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

/**
 * The plan's English when its own item is the degree and no paper (route:degree-meets-masters-english): the item's id, its words' key
 * and whether it is met, so the box says the degree stands as the English. Null for a plan whose English is a paper.
 */
export function degreeEnglishOf(view: PapersView): { route: string; met: boolean } | null {
  const plan = planOf(view);
  const entry = plan === null ? undefined : content.route[plan as keyof typeof content.route];
  const english = entry?.checklist.find((item) => item.id === "english");
  if (plan === null || english === undefined || english.requirement.type !== "quality/min") return null;
  const { quality, value } = english.requirement;
  // Read from the life's own quality, since a way only heard of has no checklist worked out yet.
  return { route: plan, met: (view.qualities.find((held) => held.id === quality)?.value ?? 0) >= value };
}

/** The paper lines of the month that tell a paper landed or moved, by the line's last word (document.md's lines). */
const NOTICE_LINES: Readonly<Record<string, string>> = {
  issued: "issued",
  "issued-band": "issued-band",
  // A paper bought from a scammer lands as any other: the phone never tells which is fake (advice:agent-loss-is-the-fee).
  faked: "issued",
  hastened: "hastened",
  requested: "requested",
  expired: "expired",
  voided: "voided",
};

/** A paper landing or moving, told on the phone (world:month-passes-as-lived): `kind` picks the words, `document` the paper. */
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

/** The Papers app's mark (world:phone-rises-over-scene's dot): the month's paper notices, empty when none landed or moved. */
export function papersMarkOf(view: Pick<PlayerView, "report">): string {
  const notices = paperNotices(view);
  return notices.length === 0 ? "" : `${String(view.report?.month ?? 0)}:${notices.map((notice) => `${notice.kind}.${notice.document}`).join(",")}`;
}

/** A paper notice's words: the paper's own where the phone has them ("The council has verified your licence."), else the kind's. */
export function paperNoticeWords(notice: PaperNotice, month: number): string {
  const own = `phone.papers.notice.${notice.kind}.${notice.document}`;
  const key = say(own) === own ? `phone.papers.notice.${notice.kind}` : own;
  return say(key, { paper: runningName(notice.document), when: notice.month === null ? "" : inMonths(notice.month, month), band: notice.band === null ? "" : formatBand(notice.band) });
}
