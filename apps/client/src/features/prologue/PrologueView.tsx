// The prologue: sixteen to the end of the service year, one card at a time
// (prologue.md R-PROLOGUE-008). The card and its answers come from the view;
// an answer not open is greyed with the reason. Above the card, what the last
// answer's draw decided; below it, the life so far in sentences. When the last
// card is answered the handover says so and opens the first month.
import { content } from "@japacity/content";
import type { PlayerView, ReportLine } from "@japacity/sim";
import { ArrowRight } from "lucide-react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Panel";
import { Rejection } from "../../shared/ui/Rejection";
import { ReportLines } from "../../shared/ui/ReportLines";
import { formatMoney } from "../../shared/words/format";
import { AGE, valueWords, yearsOf } from "../../shared/words/quality";
import { requirementSentence } from "../../shared/words/requirement";
import { bandWords, hasWords, nameOf, say, sayCount, words } from "../../shared/words/text";

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

function Answers({ prologue }: { prologue: Prologue }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  return (
    <ul className="flex flex-col gap-2">
      {prologue.answers.map((answer) => {
        const label = words(`prologue.${prologue.step}.answer.${answer.id}`);
        const reasons = answer.allowed ? [] : whyNot(prologue.step, answer.id);
        return (
          <li key={answer.id} className="flex flex-col gap-1" data-answer={answer.id}>
            <Button
              variant={answer.allowed ? "secondary" : "quiet"}
              className="w-full justify-start text-left"
              disabled={busy || !answer.allowed}
              onClick={() => void send({ type: "prologue/choose", step: prologue.step, answer: answer.id })}
            >
              <span className="flex-1 py-2">{label}</span>
              {answer.allowed ? <ArrowRight size={18} className="shrink-0" /> : null}
            </Button>
            {reasons.length === 0 ? null : (
              <p className="pl-4 text-sm text-muted">
                {say("ui.prologue.not-open")} {reasons.join(" ")}
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

/** What the last answer moved, beyond what the life so far already says, each said as the situation. */
function lastLines(lines: readonly ReportLine[]): ReportLine[] {
  return lines.filter((line) => !SAID_IN_LIFE.has(line.key)).flatMap((line) => situationLine(line, lines) ?? []);
}

function Outcome({ prologue }: { prologue: Prologue }) {
  const lines = useGame((state) => state.lines);
  const shown = lastLines(lines);
  if (prologue.lastOutcome === null && shown.length === 0) return null;
  return (
    <Card tone="attention" className="flex flex-col gap-2" data-prologue-outcome>
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{say("ui.prologue.then")}</h2>
      {prologue.lastOutcome === null ? null : <p className="text-lg font-medium">{words(prologue.lastOutcome)}</p>}
      {shown.length === 0 ? null : <ReportLines lines={shown} />}
    </Card>
  );
}

/** The draw, the qualities that have moved from nothing, and money, as they stand (R-PROLOGUE-008). No `draw` leaves the draw out. */
function LifeSoFar({ view, draw }: { view: PlayerView; draw?: Draw | null }) {
  const held = view.qualities.filter((quality) => quality.id !== AGE && quality.value !== 0 && content.quality[quality.id]?.shown === true);
  const naira = view.pockets.NGN.bank + view.pockets.NGN.cash;
  return (
    <section aria-label={say("ui.prologue.so-far")} className="flex flex-col gap-3" data-life-so-far>
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{say("ui.prologue.so-far")}</h2>
      <Card className="flex flex-col gap-3">
        {draw === undefined ? null : draw === null ? (
          <p className="text-muted">{say("ui.prologue.not-drawn")}</p>
        ) : (
          <ul className="flex flex-col gap-1" data-draw>
            {drawSentences(draw).map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ul>
        )}
        <p className="font-medium">{naira === 0 ? say("ui.prologue.money.none") : say("ui.prologue.money", { amount: formatMoney(naira, "NGN") })}</p>
        {held.length === 0 ? null : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-sm">
            {held.map(({ id, value }) => (
              <div key={id} className="flex flex-col">
                <dt className="text-muted">{nameOf(id)}</dt>
                <dd className="font-semibold">{valueWords(id, value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </section>
  );
}

export function PrologueView() {
  const view = useView();
  const prologue = view.prologue;
  if (prologue === null) return null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-6" data-prologue={prologue.step} data-v={view.v}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold tracking-wide text-muted uppercase">{say("ui.prologue.title")}</p>
        <p className="text-sm text-muted">{say("ui.profile.age", { years: ageYears(view) })}</p>
      </div>
      <Outcome prologue={prologue} />
      <Card className="flex flex-col gap-4" data-prologue-card>
        <h1 className="text-2xl leading-snug font-semibold">{words(`prologue.${prologue.step}.card`)}</h1>
        <Rejection />
        <Answers prologue={prologue} />
      </Card>
      <LifeSoFar view={view} draw={prologue.draw} />
    </main>
  );
}

/** True right after the prologue's last answer, while its lines are the last the player saw. */
export function prologueJustClosed(lines: readonly ReportLine[]): boolean {
  return lines.some((line) => line.key === PROLOGUE_CLOSED);
}

/** The story's first step, in its own nudge words, so the handover names where to start, never a month number. */
export function firstStep(view: Pick<PlayerView, "chapter">): string | null {
  const step = view.chapter.items.find((item) => !item.met)?.id ?? null;
  if (view.chapter.current === null || step === null) return null;
  const own = `${view.chapter.current}.item.${step}`;
  return hasWords(`${own}.nudge`) ? say(`${own}.nudge`) : hasWords(own) ? say(own) : null;
}

/** The handover: the last answer's outcome, the life as it now stands, and the way into the first month. */
export function PrologueHandover({ onDone }: { onDone: () => void }) {
  const view = useView();
  const lines = useGame((state) => state.lines);
  const shown = lastLines(lines);
  const step = firstStep(view);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-6" data-prologue-handover>
      <p className="text-sm font-semibold tracking-wide text-muted uppercase">{say("ui.prologue.title")}</p>
      <Card tone="attention" className="flex flex-col gap-3">
        <h1 className="text-2xl leading-snug font-semibold">{words(PROLOGUE_CLOSED)}</h1>
        <p className="text-muted">{say("ui.profile.age", { years: ageYears(view) })}</p>
        {shown.length === 0 ? null : <ReportLines lines={shown} />}
      </Card>
      <LifeSoFar view={view} />
      {step === null ? null : (
        <p className="text-lg font-medium" data-first-step>
          {say("prologue.handover.first", { step })}
        </p>
      )}
      <Button variant="primary" onClick={onDone} autoFocus>
        {say("ui.prologue.start")}
        <ArrowRight size={18} />
      </Button>
    </main>
  );
}
