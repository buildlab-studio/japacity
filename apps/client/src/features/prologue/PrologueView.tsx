// The prologue: sixteen to the end of the service year, one card at a time
// (prologue.md R-PROLOGUE-008), over the family compound with the character at
// the gate (R-PROLOGUE-009). The card and its answers come from the view; an
// answer not open is greyed with the reason. With an archetype kept beside the
// save, its preset answers are sent for it and only the cards it leaves open
// show, each headed by a short beat of what the draws decided (R-PROLOGUE-010);
// the setting `prologue.full` shows every card. When the last card is answered
// the handover says who the person is and opens the first month.
import { content } from "@japacity/content";
import type { PlayerView, ReportLine } from "@japacity/sim";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { readPerson } from "../../authority/person";
import { Rejection } from "../../shared/ui/Rejection";
import { ReportLines } from "../../shared/ui/ReportLines";
import { formatMoney } from "../../shared/words/format";
import { AGE, valueWords, yearsOf } from "../../shared/words/quality";
import { requirementSentence } from "../../shared/words/requirement";
import { gradeShort, nextStepOf, ownWayOf, sixteenPath } from "../../shared/words/sixteen";
import { bandWords, hasWords, nameOf, say, sayCount, words } from "../../shared/words/text";
import { Gate, GateSheet } from "../../shared/frontdoor/Gate";
import { type Archetype, answersInOrder, archetypeOf, fullPrologue, handoverKind, presetAnswer, withAge } from "../../shared/frontdoor/archetypes";
import { readDoor } from "../../shared/datapage/door";

type Prologue = NonNullable<PlayerView["prologue"]>;
type Draw = NonNullable<Prologue["draw"]>;

const FAMILY_MEANS = "quality.family-means";

/** The line the prologue's last answer ends with (R-PROLOGUE-006). */
export const PROLOGUE_CLOSED = "line.prologue.closed";

/** Lines the life so far already says in words, so the answer's outcome does not say them twice. */
const SAID_IN_LIFE = new Set(["line.prologue.drawn", "line.prologue.parents-educated", PROLOGUE_CLOSED]);

/** The means a family must reach to pay for a private university, from content's own answer. */
function comfortableFrom(): number {
  const answers = content.prologue.university?.answers ?? [];
  for (const answer of answers) {
    for (const requirement of answer.requires) {
      if (requirement.type === "quality/min" && requirement.quality === FAMILY_MEANS) return requirement.value;
    }
  }
  return content.quality[FAMILY_MEANS]?.max ?? 0;
}

/** The draw as sentences, never as a bare figure (R-PROLOGUE-002, 008). */
export function drawSentences(draw: Draw): string[] {
  const strained = content.tuning.prologue.waecStrain.under;
  const means = draw.familyMeans < strained ? "low" : draw.familyMeans < comfortableFrom() ? "middle" : "high";
  return [
    say(`ui.prologue.town.${draw.town}`),
    say(`ui.prologue.means.${means}`),
    sayCount("ui.prologue.siblings", draw.siblings, { count: draw.siblings }),
    say(draw.parentsEducated ? "ui.prologue.parents.educated" : "ui.prologue.parents.not"),
  ];
}

function ageYears(view: PlayerView): number {
  return yearsOf(view.qualities.find((quality) => quality.id === AGE)?.value ?? 0);
}

/**
 * Why an answer is not open (R-PROLOGUE-003): the situation in content's words, never the threshold
 *: "your family would not have it". A money line carries the sum it needs.
 * Only an answer content has no words for falls back to its requirements.
 */
export function whyNot(step: string, answer: string): string[] {
  const entry = content.prologue[step]?.answers.find((candidate) => candidate.id === answer);
  const own = `prologue.${step}.answer.${answer}.why`;
  if (hasWords(own)) {
    const money = entry?.requires.find((requirement) => requirement.type === "money/min");
    return [say(own, money?.type === "money/min" && typeof money.amount === "number" ? { amount: formatMoney(money.amount, money.currency) } : {})];
  }
  return (entry?.requires ?? []).map((requirement) => requirementSentence(requirement));
}

/**
 * The one line under an answer, with what it costs where it opens a bill: the home card's living costs
 * a month. Null when content has no line for it.
 */
export function answerHint(step: string, answer: string): string | null {
  const key = `prologue.${step}.answer.${answer}.hint`;
  if (!hasWords(key)) return null;
  const opens = content.prologue[step]?.answers.find((candidate) => candidate.id === answer)?.effects.find((effect) => effect.type === "obligation/open");
  const amount = opens?.type === "obligation/open" && typeof opens.amount === "number" ? opens.amount : null;
  const currency = opens?.type === "obligation/open" ? (content.obligation[opens.obligation]?.currency ?? "NGN") : "NGN";
  return say(key, amount === null ? {} : { amount: formatMoney(amount, currency) });
}

/** True when an answer's line says a cost, which shows whether the answer is open or not. */
function costsSaid(step: string, answer: string): boolean {
  return content.prologue[step]?.answers.find((candidate) => candidate.id === answer)?.effects.some((effect) => effect.type === "obligation/open") === true;
}

function Answers({ prologue, archetype, onAnswer }: { prologue: Prologue; archetype: Archetype | null; onAnswer: () => void }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  return (
    <ul className="flex flex-col gap-1.5">
      {answersInOrder(archetype, prologue.step, prologue.answers).map((answer) => {
        const label = words(`prologue.${prologue.step}.answer.${answer.id}`);
        const hint = answerHint(prologue.step, answer.id);
        const reasons = answer.allowed ? [] : whyNot(prologue.step, answer.id);
        return (
          <li key={answer.id} className="flex flex-col gap-0.5" data-answer={answer.id}>
            <button
              type="button"
              className={`press flex min-h-12 w-full items-center gap-2 rounded-[5px] px-3 py-2 text-left text-[16px] font-extrabold ${answer.allowed ? "bg-sheet-muted text-text" : "bg-transparent text-text-2 opacity-70"}`}
              disabled={busy || !answer.allowed}
              onClick={() => {
                onAnswer();
                void send({ type: "prologue/choose", step: prologue.step, answer: answer.id });
              }}
            >
              <span className="flex-1">{label}</span>
              {answer.allowed ? <ArrowRight size={18} className="shrink-0" /> : null}
            </button>
            {hint !== null && (answer.allowed || costsSaid(prologue.step, answer.id)) ? <p className="px-3 text-[12px] leading-snug text-text-2">{hint}</p> : null}
            {reasons.length === 0 ? null : (
              <p className="px-3 text-[12px] leading-snug text-text-2">
                {say("prologue.not-for-you")} {reasons.join(" ")}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const QUALITY_LINES = new Set(["line.quality.gain", "line.quality.loss", "line.quality.drift"]);
const GRADE = "quality.edu-grade";
const GRADED = "line.prologue.graded";

/**
 * A line that would tell a quality's figure, told as the situation instead: a
 * quality with bands keeps its band line; one with levels says the level it is at ("Education now:
 * Secondary school"); another says what moved in the prologue's own words, or only which way ("Portfolio
 * up."). The degree's grade is said by its name. Null: the line is said by another already.
 */
export function situationLine(line: ReportLine, all: readonly ReportLine[] = []): ReportLine | null {
  const { quality, value, grade } = line.params;
  if (line.key === GRADED && typeof grade === "number" && hasWords(`${GRADE}.value.${String(grade)}`)) {
    return { ...line, key: "prologue.line.graded", params: { grade: say(`${GRADE}.value.${String(grade)}`) } };
  }
  if (!QUALITY_LINES.has(line.key) || typeof quality !== "string" || typeof value !== "number" || bandWords(quality, value) !== null) return line;
  // The grade is said once, by the graded line.
  if (quality === GRADE && all.some((other) => other.key === GRADED)) return null;
  const level = `${quality}.value.${String(value)}`;
  if (hasWords(level)) return { ...line, key: "prologue.line.level", params: { quality: nameOf(quality), level: say(level) } };
  const way = line.key.slice("line.quality.".length);
  const moved = `prologue.line.${quality}.${way}`;
  return hasWords(moved) ? { ...line, key: moved, params: {} } : { ...line, key: `prologue.line.moved.${way}`, params: { quality: nameOf(quality) } };
}

const SETTLEMENT = "prologue.settlement.outcome.";
const EARNED = "line.wallet.gig";

/** What the last answer moved, beyond what the life so far already says, each said as the situation. The master's settlement is said as itself, not as side work. */
function lastLines(lines: readonly ReportLine[], outcome: string | null = null): ReportLine[] {
  const settled = outcome?.startsWith(SETTLEMENT) === true;
  return lines
    .filter((line) => !SAID_IN_LIFE.has(line.key))
    .flatMap((line) => situationLine(line, lines) ?? [])
    .map((line) => (settled && line.key === EARNED ? { ...line, key: "prologue.line.settlement" } : line));
}

function Outcome({ prologue }: { prologue: Prologue }) {
  const lines = useGame((state) => state.lines);
  const shown = lastLines(lines, prologue.lastOutcome);
  if (prologue.lastOutcome === null && shown.length === 0) return null;
  return (
    <div className="mb-3 flex flex-col gap-1 border-l-4 border-l-action pl-3" data-prologue-outcome>
      <h2 className="label text-text-2">{say("ui.prologue.then")}</h2>
      {prologue.lastOutcome === null ? null : <p className="text-[15px] font-bold">{words(prologue.lastOutcome)}</p>}
      {shown.length === 0 ? null : <ReportLines lines={shown} />}
    </div>
  );
}

/** What the draws decided while the preset played, as a short beat at the head of the card shown next (R-PROLOGUE-010). */
function Beat({ beats }: { beats: readonly string[] }) {
  if (beats.length === 0) return null;
  return (
    <div className="mb-3 flex flex-col gap-0.5 border-l-4 border-l-action pl-3 text-[14px] leading-snug" data-prologue-outcome data-beat>
      {beats.map((beat) => (
        <p key={beat}>{beat}</p>
      ))}
    </div>
  );
}

/** The draw, the qualities that have moved from nothing, and money, as they stand (R-PROLOGUE-008). No `draw` leaves the draw out. */
function LifeSoFar({ view, draw, open = false }: { view: PlayerView; draw?: Draw | null; open?: boolean }) {
  const held = view.qualities.filter((quality) => quality.id !== AGE && quality.value !== 0 && content.quality[quality.id]?.shown === true);
  const naira = view.pockets.NGN.bank + view.pockets.NGN.cash;
  return (
    <details open={open} aria-label={say("ui.prologue.so-far")} className="mt-3 border-t border-sheet-line pt-2 text-[14px]" data-life-so-far>
      <summary className="label cursor-pointer py-1 text-text-2">{say("ui.prologue.so-far")}</summary>
      <div className="flex flex-col gap-2 pt-1">
        {draw === undefined ? null : draw === null ? (
          <p className="text-text-2">{say("ui.prologue.not-drawn")}</p>
        ) : (
          <ul className="flex flex-col gap-0.5" data-draw>
            {drawSentences(draw).map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ul>
        )}
        <p className="font-bold">{naira === 0 ? say("ui.prologue.money.none") : say("ui.prologue.money", { amount: formatMoney(naira, "NGN") })}</p>
        {held.length === 0 ? null : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
            {held.map(({ id, value }) => (
              <div key={id} className="flex flex-col">
                <dt className="text-text-2">{nameOf(id)}</dt>
                <dd className="font-bold">{valueWords(id, value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </details>
  );
}

/** The archetype kept beside the save for this life, with the age the front door set, unless the setting `prologue.full` asks for every card. */
export function presetArchetype(): Archetype | null {
  if (fullPrologue()) return null;
  const archetype = archetypeOf(readPerson()?.archetype);
  return archetype === null ? null : withAge(archetype, readDoor()?.age ?? 0);
}

/**
 * Sends the archetype's preset answer while the card's is allowed (R-PROLOGUE-010), once per view, and
 * keeps the outcomes the draws gave on the way, for the card shown next. Null `answer`: the card shows.
 */
function usePreset(view: PlayerView, prologue: Prologue, archetype: Archetype | null): { answer: string | null; beats: string[]; told: () => void } {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const rejected = useGame((state) => state.rejection !== null);
  const sentAt = useRef<number | null>(null);
  const outcomes = useRef<string[]>([]);
  const drawTold = useRef(false);
  const answer = archetype === null || rejected ? null : presetAnswer(archetype, prologue);
  useEffect(() => {
    if (answer === null || busy || sentAt.current === view.v) return;
    sentAt.current = view.v;
    if (prologue.lastOutcome !== null) outcomes.current.push(prologue.lastOutcome);
    void send({ type: "prologue/choose", step: prologue.step, answer });
  }, [answer, busy, view.v, prologue.step, prologue.lastOutcome, send]);
  const beats = archetype === null ? [] : [...(prologue.draw !== null && !drawTold.current ? drawSentences(prologue.draw).slice(0, 2) : []), ...[...outcomes.current, ...(prologue.lastOutcome === null ? [] : [prologue.lastOutcome])].map((key) => words(key))];
  return {
    answer,
    beats: [...new Set(beats)],
    told: () => {
      outcomes.current = [];
      if (prologue.draw !== null) drawTold.current = true;
    },
  };
}

export function PrologueView() {
  const view = useView();
  const prologue = view.prologue;
  if (prologue === null) return null;
  return <PrologueCard view={view} prologue={prologue} />;
}

function PrologueCard({ view, prologue }: { view: PlayerView; prologue: Prologue }) {
  const archetype = presetArchetype();
  const { answer, beats, told } = usePreset(view, prologue, archetype);
  if (answer !== null)
    return (
      <Gate mark="prologue">
        <GateSheet mark="years" label={say("ui.door.years")}>
          <div className="flex items-baseline justify-between gap-3" data-prologue-years data-v={view.v}>
            <p className="title text-[20px]">{say("ui.door.years")}</p>
            <p className="num text-[14px] text-text-2">{say("ui.profile.age", { years: ageYears(view) })}</p>
          </div>
        </GateSheet>
      </Gate>
    );
  return (
    <Gate mark="prologue">
      <GateSheet key={view.v} mark="card" label={say("ui.prologue.title")}>
        <div data-prologue={prologue.step} data-v={view.v}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="label text-text-2">{say("ui.prologue.title")}</p>
            <p className="num text-[13px] text-text-2">{say("ui.profile.age", { years: ageYears(view) })}</p>
          </div>
          {archetype === null ? <Outcome prologue={prologue} /> : <Beat beats={beats} />}
          <div className="flex flex-col gap-3" data-prologue-card>
            <h1 className="title text-[22px] leading-tight">{words(`prologue.${prologue.step}.card`)}</h1>
            <Rejection />
            <Answers prologue={prologue} archetype={archetype} onAnswer={told} />
          </div>
          <LifeSoFar view={view} draw={prologue.draw} open={archetype === null} />
        </div>
      </GateSheet>
    </Gate>
  );
}

/** True right after the prologue's last answer, while its lines are the last the player saw. */
export function prologueJustClosed(lines: readonly ReportLine[]): boolean {
  return lines.some((line) => line.key === PROLOGUE_CLOSED);
}

/**
 * The story's first step, in its own nudge words, so the handover names where to start, never a month number (the
 * A trader with capital starts at the meetup or the official page; the
 * handover has its own words for a step whose nudge is not something to do. A life whose archetype takes its first
 * step somewhere of its own says that place: the nurse's job at the clinic, a trade's motor park.
 */
export function firstStep(view: Pick<PlayerView, "chapter" | "scenario" | "qualities" | "pockets"> & Partial<Pick<PlayerView, "documents" | "routes" | "job">>): string | null {
  const step = nextStepOf(view);
  if (view.chapter.current === null || step === null) return null;
  const own = `${view.chapter.current}.item.${step}`;
  const way = ownWayOf(view);
  if (way !== null && hasWords(`prologue.handover.step.${way.step}.${way.key}`)) return say(`prologue.handover.step.${way.step}.${way.key}`);
  if (hasWords(`prologue.handover.step.${step}`)) return say(`prologue.handover.step.${step}`);
  return hasWords(`${own}.nudge`) ? say(`${own}.nudge`) : hasWords(own) ? say(own) : null;
}

/**
 * The home the last card chose, by the living costs it opened (R-PROLOGUE-006), from content's own answers: each
 * answer names the upkeep it opens, the family's or Makoko's (R-PROLOGUE-012).
 */
function homeChosen(view: PlayerView): { answer: string; amount: number } | null {
  for (const answer of content.prologue.home?.answers ?? []) {
    for (const effect of answer.effects) {
      if (effect.type !== "obligation/open" || typeof effect.amount !== "number") continue;
      const owed = view.obligations.find((obligation) => obligation.entry === effect.obligation && obligation.amount === effect.amount);
      if (owed !== undefined && hasWords(`prologue.handover.home.${answer.id}`)) return { answer: answer.id, amount: owed.amount };
    }
  }
  return null;
}

/**
 * The story the prologue built, kept at the handover: a shop's capital and what it can do now, a
 * grade that keeps doors shut and the one it does not, and where the character sleeps.
 */
function storyLines(view: PlayerView): string[] {
  const told: string[] = [];
  if (sixteenPath(view) === "capital") told.push(say("prologue.handover.capital", { amount: formatMoney(view.pockets.NGN.bank + view.pockets.NGN.cash, "NGN") }));
  if (gradeShort(view)) told.push(say("prologue.handover.grade-short"));
  const home = homeChosen(view);
  if (home !== null) told.push(say(`prologue.handover.home.${home.answer}`, { amount: formatMoney(home.amount, "NGN") }));
  return told;
}

/** The handover: who the person is and what they were, the story the prologue built, and the way into the first month (R-PROLOGUE-010). */
export function PrologueHandover({ onDone }: { onDone: () => void }) {
  const view = useView();
  const lines = useGame((state) => state.lines);
  const person = readPerson();
  const archetype = presetArchetype();
  const shown = archetype === null ? lastLines(lines) : [];
  const step = firstStep(view);
  const story = storyLines(view);
  return (
    <Gate mark="handover">
      <GateSheet
        mark="handover"
        label={say("ui.prologue.title")}
        foot={
          <>
            {step === null ? null : (
              <p className="mb-2 text-[15px] font-bold" data-first-step>
                {say("prologue.handover.first", { step })}
              </p>
            )}
            <button type="button" className="btn-main" onClick={onDone} autoFocus>
              <span>{say("ui.prologue.start")}</span>
              <ArrowRight size={18} />
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-2" data-prologue-handover>
          <p className="label text-text-2">{say("ui.prologue.title")}</p>
          {person === null ? null : <h1 className="title text-[26px] leading-none">{person.name}</h1>}
          {archetype === null ? null : (
            <p className="text-[15px] font-bold" data-handover-archetype>
              {handoverKind(archetype, view)}
            </p>
          )}
          {person === null ? <h1 className="title text-[22px] leading-tight">{words(PROLOGUE_CLOSED)}</h1> : null}
          <p className="text-[13px] text-text-2">{say("ui.profile.age", { years: ageYears(view) })}</p>
          {story.length === 0 ? null : (
            <div className="flex flex-col gap-1.5 text-[15px]" data-handover-story>
              {story.map((sentence) => (
                <p key={sentence}>{sentence}</p>
              ))}
            </div>
          )}
          {shown.length === 0 ? null : <ReportLines lines={shown} />}
          <LifeSoFar view={view} open={archetype === null} />
        </div>
      </GateSheet>
    </Gate>
  );
}
