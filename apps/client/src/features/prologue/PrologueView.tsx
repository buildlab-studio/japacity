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
import { formatMoney, playerMonth } from "../../shared/words/format";
import { requirementSentence } from "../../shared/words/requirement";
import { nameOf, say, sayCount, words } from "../../shared/words/text";
import { valueWords } from "../quality/QualityView";

type Prologue = NonNullable<PlayerView["prologue"]>;
type Draw = NonNullable<Prologue["draw"]>;

const AGE = "quality.age-months";
const FAMILY_MEANS = "quality.family-means";
const MONTHS_IN_YEAR = 12;

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
  const months = view.qualities.find((quality) => quality.id === AGE)?.value ?? 0;
  return Math.floor(months / MONTHS_IN_YEAR);
}

/** Why an answer is not open: its requirements in words, from content (R-PROLOGUE-003). */
function whyNot(step: string, answer: string): string[] {
  const entry = content.prologue[step]?.answers.find((candidate) => candidate.id === answer);
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

/** What the last answer moved, beyond what the life so far already says. */
function lastLines(lines: readonly ReportLine[]): ReportLine[] {
  return lines.filter((line) => !SAID_IN_LIFE.has(line.key));
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

/** The handover: the last answer's outcome, the life as it now stands, and the way into the first month. */
export function PrologueHandover({ onDone }: { onDone: () => void }) {
  const view = useView();
  const lines = useGame((state) => state.lines);
  const shown = lastLines(lines);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-6" data-prologue-handover>
      <p className="text-sm font-semibold tracking-wide text-muted uppercase">{say("ui.prologue.title")}</p>
      <Card tone="attention" className="flex flex-col gap-3">
        <h1 className="text-2xl leading-snug font-semibold">{words(PROLOGUE_CLOSED)}</h1>
        <p className="text-muted">{say("ui.profile.age", { years: ageYears(view) })}</p>
        {shown.length === 0 ? null : <ReportLines lines={shown} />}
      </Card>
      <LifeSoFar view={view} />
      <Button variant="primary" onClick={onDone} autoFocus>
        {say("ui.prologue.start", { month: playerMonth(view.month) })}
        <ArrowRight size={18} />
      </Button>
    </main>
  );
}
