// The prologue: sixteen to the end of the service year (prologue:view-shows-step-card), on the door's sky, with no
// compound and no figure on a plinth. A new life never shows a card: its archetype answers every step
// (prologue:archetype-presets-answers) while the page fills as the years go by, and when the last answer is in, the
// page is the handover (prologue:printed-page-hands-over): the family the game drew turned over, the years before as fact chips, the
// money as it stands, and the world opens when Go is tapped. A life with no archetype (the setting
// `prologue.full`, or a fixed life a test starts) shows each card, one at a time, its answers greyed with the reason.
import { content, presetAges, presetAnswer } from "@japacity/content";
import type { PlayerView, ReportLine } from "@japacity/sim";
import { qualityIn } from "@japacity/sim";
import { ArrowRight, Dices } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { readPerson } from "../../shared/front-door/person";
import { FactChip } from "../../shared/ui/FactChip";
import { Waiting } from "../../shared/ui/Loader";
import { Rejection } from "../../shared/ui/Rejection";
import { ReportLines } from "../../shared/ui/ReportLines";
import { ToneTag } from "../../shared/ui/ToneTag";
import { formatMoney } from "../../shared/words/format";
import { AGE, valueWords, yearsOf } from "../../shared/words/quality";
import { requirementSentence } from "../../shared/words/requirement";
import { nextStepOf, ownWayOf, RACKS_STEP, racksAtHand } from "../../shared/words/sixteen";
import { bandWords, hasWords, hometownWords, nameOf, say, sayCount, words } from "../../shared/words/text";
import { gateLook } from "../../shared/front-door/Gate";
import { lookOf } from "../../shared/front-door/looks";
import { type Archetype, answersInOrder, archetypeOf, fullPrologue, type Home, homeOf, HOMES, homesFor, withAge, withHome } from "../../shared/front-door/archetypes";
import { DataPage, type PageFields } from "../../shared/datapage/DataPage";
import { JapacityLine, StatBox } from "../../shared/datapage/PageParts";
import { DoorAction, DoorFrame } from "../../shared/front-door/DoorFrame";
import type { DeskStep } from "../../shared/front-door/DoorDesk";
import { DeskKeys, DeskSlot } from "../../shared/front-door/DeskHost";
import { DeskStage } from "../../shared/front-door/DeskStage";
import { useDoorKeys } from "../../shared/front-door/keys";
import { FINE_POINTER, useDesk, useMedia } from "../../shared/ui/desk";
import { homePicture, LIFE_THINGS } from "../../shared/front-door/lives";
import { plannedYears } from "../../shared/front-door/planned";
import { FigurePicture, ModelPicture } from "../../shared/front-door/LookPicture";
import { readDoor } from "../../shared/datapage/door";
import { familyCard } from "../../shared/datapage/family";
import { WayChips } from "../../shared/front-door/WayChips";
import { pageOf } from "../../shared/datapage/PageSheet";
import { readyPercent, readyWords } from "../../shared/words/ready";
import { heardWords, noteAnswer, noteCard, noteSteps, readTrail, startTrail, storyChips, type Trail, trailShown, type YearChip, yearChips } from "./years";

type Prologue = NonNullable<PlayerView["prologue"]>;
type Draw = NonNullable<Prologue["draw"]>;

const FAMILY_MEANS = "quality.family-means";

/** The line the prologue's last answer ends with (prologue:closing-opens-home-charges). */
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

/** A tile's own opening lines, where content has them: where it grew up and what home was. */
function tileOpening(archetype: Pick<Archetype, "id"> | null): [string, string] | null {
  if (archetype === null) return null;
  const [where, home] = [`prologue.archetype.${archetype.id}.begin.where`, `prologue.archetype.${archetype.id}.begin.home`];
  return hasWords(where) && hasWords(home) ? [say(where), say(home)] : null;
}

/**
 * The draw as sentences, never as a bare figure (prologue:family-draw-on-first-answer, prologue:view-shows-step-card). A tile with its own opening says it in place of
 * the draw's town and means (the child of the water grew up on the lagoon, prologue:makoko-start-never-a-trap); the rest is the draw's.
 */
export function drawSentences(draw: Draw, archetype: Pick<Archetype, "id"> | null = null): string[] {
  const strained = content.tuning.prologue.waecStrain.under;
  const means = draw.familyMeans < strained ? "low" : draw.familyMeans < comfortableFrom() ? "middle" : "high";
  return [
    ...(tileOpening(archetype) ?? [say(`ui.prologue.town.${draw.town}`), say(`ui.prologue.means.${means}`)]),
    sayCount("ui.prologue.siblings", draw.siblings, { count: draw.siblings }),
    say(draw.parentsEducated ? "ui.prologue.parents.educated" : "ui.prologue.parents.not"),
  ];
}

function ageYears(view: PlayerView): number {
  return yearsOf(qualityIn(view, AGE));
}

/**
 * Why an answer is not open (prologue:steps-offer-legal-answers): the situation in content's words, never the threshold
 * ("your family would not have it"). A money line carries the sum it needs.
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
                noteAnswer(prologue.step, answer.id, prologue.step === "draw");
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
const GRADE = "quality.education-grade";
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

/** The draw, the qualities that have moved from nothing, and money, as they stand (prologue:view-shows-step-card). No `draw` leaves the draw out. */
function LifeSoFar({ view, draw, open = false, archetype = null }: { view: PlayerView; draw?: Draw | null; open?: boolean; archetype?: Archetype | null }) {
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
            {drawSentences(draw, archetype).map((sentence) => (
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

/** A tile's preset as the door set it: the tile, the age step and the home, each within what the door offers it (prologue:front-door-builds-a-person, prologue:front-door-three-screens). */
interface PresetChoice {
  base: Archetype;
  age: number;
  home: Home;
}

/** The tile kept beside the save for this life, with the age step and the home the front door set, unless the setting `prologue.full` asks for every card. */
function presetChoice(): PresetChoice | null {
  if (fullPrologue()) return null;
  const base = archetypeOf(readPerson()?.archetype);
  if (base === null) return null;
  const door = readDoor();
  const most = presetAges(base.preset).at(-1) ?? 0;
  const age = Math.min(Math.max(0, door?.age ?? 0), most);
  const home = homesFor(base).find((one) => one === door?.home) ?? homeOf(base);
  return { base, age, home };
}

/** The archetype kept beside the save for this life, with the age and the home the front door set, unless the setting `prologue.full` asks for every card. */
function presetArchetype(): Archetype | null {
  const choice = presetChoice();
  return choice === null ? null : withHome(withAge(choice.base, choice.age), choice.home);
}

/**
 * Plays the archetype's answer at every card (prologue:archetype-presets-answers), and keeps each answer and what its
 * draw gave for the page (prologue:printed-page-hands-over). The answer is content's `presetAnswer`, the one the server plays. Null
 * `answer`: the card shows (a refusal, or a card with every answer shut). Online, Begin sends the whole preset as one
 * request and the server plays every step (server:server-plays-prologue-preset); the page fills from the reply's trail. Offline each
 * answer goes at once as a command.
 */
function usePreset(view: PlayerView, prologue: Prologue, choice: PresetChoice | null): string | null {
  const send = useGame((state) => state.send);
  const preset = useGame((state) => state.preset);
  const busy = useGame((state) => state.busy);
  const rejected = useGame((state) => state.rejection !== null);
  const sentAt = useRef<number | null>(null);
  const answer = choice === null || rejected ? null : presetAnswer(choice.base.id, choice.age, choice.home, prologue.step, prologue.answers);
  const [id, age, home] = [choice?.base.id ?? null, choice?.age ?? 0, choice?.home ?? null];
  useEffect(() => {
    if (answer === null || id === null || home === null || busy || sentAt.current === view.v) return;
    sentAt.current = view.v;
    noteCard(prologue.draw, prologue.lastOutcome);
    if (preset !== null) {
      if (prologue.step === "draw") startTrail();
      void preset({ archetype: id, age, home }, noteSteps);
      return;
    }
    noteAnswer(prologue.step, answer, prologue.step === "draw");
    void send({ type: "prologue/choose", step: prologue.step, answer });
  }, [answer, id, age, home, busy, preset, view.v, prologue.step, prologue.lastOutcome, prologue.draw, send]);
  return answer;
}

export function PrologueView() {
  const view = useView();
  const prologue = view.prologue;
  if (prologue === null) return null;
  return <PrologueCard view={view} prologue={prologue} />;
}

function PrologueCard({ view, prologue }: { view: PlayerView; prologue: Prologue }) {
  const choice = presetChoice();
  const archetype = choice === null ? null : withHome(withAge(choice.base, choice.age), choice.home);
  const answer = usePreset(view, prologue, choice);
  // A card answered by hand keeps its trail for the page as a preset does.
  useEffect(() => {
    if (answer === null) noteCard(prologue.draw, prologue.lastOutcome);
  }, [answer, prologue.draw, prologue.lastOutcome]);
  // A new life never shows a card: the page fills as its years go by (prologue:printed-page-hands-over).
  if (answer !== null) return <PageScreen view={view} archetype={archetype} draw={prologue.draw} />;
  return (
    <DoorFrame mark="prologue" title={null}>
      <section key={view.v} aria-label={say("ui.prologue.title")} className="door-card mx-4 mt-4 mb-4 px-4 pt-4 pb-3" data-gate-sheet="card">
        <div data-prologue={prologue.step} data-v={view.v}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="label text-text-2">{say("ui.prologue.title")}</p>
            <p className="num text-[13px] text-text-2">{say("ui.profile.age", { years: ageYears(view) })}</p>
          </div>
          <Outcome prologue={prologue} />
          <div className="flex flex-col gap-3" data-prologue-card>
            <h1 className="title text-[22px] leading-tight">{words(`prologue.${prologue.step}.card`)}</h1>
            <Rejection />
            <Answers prologue={prologue} archetype={archetype} onAnswer={() => undefined} />
          </div>
          <LifeSoFar view={view} draw={prologue.draw} open={archetype === null} archetype={archetype} />
        </div>
      </section>
    </DoorFrame>
  );
}

/** True right after the prologue's last answer, while its lines are the last the player saw. */
export function prologueJustClosed(lines: readonly ReportLine[]): boolean {
  return lines.some((line) => line.key === PROLOGUE_CLOSED);
}

/**
 * The story's first step, in its own nudge words, so the handover names where to start, never a month number. A
 * trader with capital starts at the meetup or the official page; the
 * handover has its own words for a step whose nudge is not something to do. A life whose archetype takes its first
 * step somewhere of its own says that place: the nurse's job at the clinic, a trade's motor park.
 * A life in Makoko's room with no job says the racks beside it, as the band's nudge does at the same moment (activity:fish-racks-at-makoko);
 * the motor park comes after.
 */
export function firstStep(view: Pick<PlayerView, "chapter" | "scenario" | "qualities" | "pockets"> & Partial<Pick<PlayerView, "documents" | "routes" | "job" | "activities">>): string | null {
  const step = nextStepOf(view);
  if (view.chapter.current === null || step === null) return null;
  if (racksAtHand(view)) return say(RACKS_STEP);
  const own = `${view.chapter.current}.item.${step}`;
  const way = ownWayOf(view);
  if (way !== null && hasWords(`prologue.handover.step.${way.step}.${way.key}`)) return say(`prologue.handover.step.${way.step}.${way.key}`);
  if (hasWords(`prologue.handover.step.${step}`)) return say(`prologue.handover.step.${step}`);
  return hasWords(`${own}.nudge`) ? say(`${own}.nudge`) : hasWords(own) ? say(own) : null;
}


/** When the family's card turns over on the handover page; no stamp lands, and the world opens only on Go or a tap (prologue:printed-page-hands-over). */
export const TURN_MS = 450;

/**
 * About how long the years the server played in one request take to come onto the page, a chip after another, so the
 * years still read as years (prologue:archetype-presets-answers); the family turns over after the last.
 */
export const REVEAL_MS = 2000;

/** The chips the page shows before the server's fresh steps, and the pause between each of the rest (prologue:archetype-presets-answers). */
function revealOf(trail: Trail, view: PlayerView, water: boolean, total: number): { from: number; every: number } {
  const fresh = trail.fresh ?? 0;
  if (fresh <= 0) return { from: total, every: 0 };
  const earlier = trail.steps.slice(0, Math.max(0, trail.steps.length - fresh));
  const from = earlier.length === 0 ? 0 : Math.min(total, yearChips({ draw: trail.draw, steps: earlier }, view, water).length);
  return { from, every: Math.round(REVEAL_MS / Math.max(1, total - from)) };
}


/** The family the game drew, face down until it turns over once, the same height before and after. */
function Family({ draw, water, turned, hometown }: { draw: Draw | null; water: boolean; turned: boolean; hometown: string | null }) {
  const card = draw === null || !turned ? null : familyCard(draw, water, hometown);
  return (
    <div className="min-h-[64px] [perspective:600px]" data-family={card === null ? "drawing" : "turned"}>
      <div
        className={`door-card flex min-h-[64px] items-center gap-2.5 px-3.5 py-2 transition-transform duration-300 ${card === null ? "bg-tint-plain!" : ""}`}
        style={{ transform: card === null ? "rotateX(0deg)" : "rotateX(360deg)" }}
      >
        {card === null ? (
          <>
            <Dices size={22} className="shrink-0 animate-pulse" aria-hidden />
            <span className="text-[14px] font-bold">{say("ui.page.family.drawing")}</span>
          </>
        ) : (
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[15px] font-extrabold" data-family-title>
                {card.title}
              </span>
              <span className="label ml-auto shrink-0 text-text-2">{say("ui.page.family")}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1" data-family-tags>
              {card.tags.map((tag) => (
                <ToneTag key={tag.words} tone={tag.tone}>
                  {tag.words}
                </ToneTag>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Chips({ chips, mark }: { chips: readonly YearChip[]; mark?: string }) {
  if (chips.length === 0) return null;
  return (
    <div className="mt-1.5 grid grid-cols-2 gap-1.5" {...(mark === undefined ? {} : { [mark]: "" })}>
      {chips.map((chip) => (
        // Where the life starts is said in a line of its own across the page (prologue:front-door-three-screens).
        <div key={chip.id} className={`min-w-0 ${chip.id === "home" ? "col-span-2" : ""}`}>
          <FactChip id={chip.id} icon={chip.icon} label={chip.label} note={chip.note} state={chip.state} />
        </div>
      ))}
    </div>
  );
}


/** The home a life starts in, from where it lives in the view: one of the door's homes, or none for a place that is not one. */
function homeIn(view: PlayerView): Home | null {
  const id = view.home.place?.slice("place.".length) ?? null;
  return HOMES.find((home) => home === id) ?? null;
}

/**
 * Where the life starts (prologue:front-door-three-screens, prologue:printed-page-hands-over): the home's picture over the story's own chip of where the character
 * sleeps and when its rent or living costs fall next, read from the life (the obligations it opened), never the door.
 */
function StartsIn({ home, chip }: { home: Home | null; chip: YearChip }) {
  const picture = home === null ? null : homePicture(home);
  return (
    <div className="door-card min-w-0 flex-1 p-2.5" data-starts-in={home ?? ""}>
      {picture === null ? null : "src" in picture ? (
        <span className="mb-2 block h-[70px] rounded-[12px] bg-cover" style={{ backgroundImage: `url(${picture.src})`, backgroundPosition: "center 50%" }} aria-hidden />
      ) : (
        <span className="mb-2 flex h-[70px] items-center justify-center rounded-[12px] bg-tint-study" aria-hidden>
          <ModelPicture model={picture.model} size={64} />
        </span>
      )}
      <FactChip id={chip.id} icon={chip.icon} label={chip.label} note={chip.note} state={chip.state} />
    </div>
  );
}

/**
 * The page after Begin (prologue:printed-page-hands-over), in the door's dress: "Your page, printed" over the
 * travel data page with the life's thing slapped on it; you cheering on a sticker beside where you start and when rent
 * is next due; the family the game drew; the years before as chips with the story's own; the money and japacity as they
 * stand; and where this life can lead. While the years go by (`onDone` absent) the family is still face down and the
 * chips fill as the trail has them; as the handover the family turns over once and the world opens when Go is tapped,
 * or the page. No stamp lands: the page takes none before a visa.
 */
function PageScreen({ view, archetype, draw, onDone }: { view: PlayerView; archetype: Archetype | null; draw: Draw | null; onDone?: () => void }) {
  const person = readPerson();
  const handover = onDone !== undefined;
  const online = useGame((state) => state.preset !== null);
  const [turned, setTurned] = useState(false);
  const done = useRef(false);
  const finish = (): void => {
    if (done.current || onDone === undefined) return;
    done.current = true;
    onDone();
  };
  const trail = readTrail();
  const kept = draw ?? trail.draw;
  const water = archetype?.id === "water";
  const lived = yearChips(trail, view, water);
  // The years the server played in one request come on one after another, as the handover opens (prologue:archetype-presets-answers).
  const [reveal] = useState(() => (handover ? revealOf(trail, view, water, lived.length) : { from: lived.length, every: 0 }));
  const [brought, setBrought] = useState(reveal.from);
  const revealing = handover && brought < lived.length;
  useEffect(() => {
    if (!handover) return;
    if (revealing) {
      const timer = window.setTimeout(() => setBrought((count) => count + 1), reveal.every);
      return () => window.clearTimeout(timer);
    }
    trailShown();
    // The page waits for the player: ten facts are not read in three seconds.
    const timer = window.setTimeout(() => setTurned(true), TURN_MS);
    return () => window.clearTimeout(timer);
  }, [handover, revealing, brought, reveal.every]);

  const look = gateLook(person?.look);
  const desk = useDesk();
  const fine = useMedia(FINE_POINTER);
  // prologue:printed-page-hands-over: on a desk Enter is Go.
  useDoorKeys(desk && handover, (key) => {
    if (key !== "go") return false;
    finish();
    return true;
  });
  const waiting = !handover && online && trail.steps.length === 0;
  // On a desk the wait stands in the panel, and the stage keeps the page as Begin left it.
  if (waiting && desk)
    return (
      <div data-page-running="" data-page-waiting="" data-v={view.v}>
        <DeskSlot fill={{ mark: "years", look, steps: deskSteps(), stage: null, title: say("prologue.door.page.title") }} foot={null}>
          <div className="px-5 pt-[18vh]">
            <Waiting words={say("ui.page.family.drawing")} />
          </div>
        </DeskSlot>
      </div>
    );
  // Online the server plays the years in one request (server:server-plays-prologue-preset): until its first step is in, the page is the splash's
  // wait in the page's own frame, its words where the opening's stand and the bar under them.
  if (waiting)
    return (
      <div data-page-running="" data-page-waiting="" data-v={view.v}>
        <DoorFrame mark="years" look={look} title={null}>
          <div className="px-4 pt-[calc(22vh+130px)]">
            <Waiting words={say("ui.page.family.drawing")} />
          </div>
        </DoorFrame>
      </div>
    );

  const base = pageOf(view, person);
  // The family and where it is from print on the page as its card turns over; until then their lines wait (prologue:front-door-builds-a-person, prologue:printed-page-hands-over).
  const shown = handover && turned && kept !== null;
  // chapter:first-chapter-mission-card: the way out the years heard of is said under So far as the life is handed over.
  const heard = handover ? heardWords(trail) : null;
  const page: PageFields = {
    ...base,
    ...(heard === null ? {} : { heard }),
    photo: lookOf(look)?.picture ?? "",
    family: shown ? familyCard(kept, water, view.hometown).means : "",
    from: shown && view.hometown !== null ? hometownWords(view.hometown) : "",
  };
  // While the years go by, the years the tile will pass and has not yet are listed as not yet, and fill as they are lived.
  const going = handover && !revealing ? null : lived.slice(0, handover ? brought : lived.length);
  const years = going === null || archetype === null ? (going ?? lived) : [...going, ...plannedYears(archetype).flatMap((planned): YearChip[] => (going.some((chip) => chip.id === planned.id) ? [] : [{ id: planned.id, icon: planned.icon, label: planned.label, note: planned.note ?? null, state: planned.state ?? null }]))];
  // Where the life starts stands beside the cheering figure with the home's picture; the story's other chips stay in the grid.
  const told = handover ? storyChips(view) : [];
  const starts = told.find((chip) => chip.id === "home") ?? null;
  const story = told.filter((chip) => chip !== starts);
  const step = handover ? firstStep(view) : null;
  const naira = view.pockets.NGN.bank + view.pockets.NGN.cash;
  const home = homeIn(view);
  const named = person !== null && person.name !== "";
  const foot = handover ? (
    <>
      {step === null ? null : (
        <p className="mb-2.5 text-center text-[15px] font-bold" data-first-step>
          {say("prologue.handover.first", { step })}
        </p>
      )}
      <DoorAction word={say("ui.prologue.start")} then={say("ui.door.begin.then")} onClick={finish} />
    </>
  ) : undefined;
  const title = named ? say(handover ? "ui.door.page.printed" : "prologue.door.page.title") : words(PROLOGUE_CLOSED);
  const line = named && handover ? say("ui.door.page.over", { name: person.name }) : say("ui.profile.age", { years: ageYears(view) });
  const yearsPart = (
    <div className="mx-4 mt-4 flex flex-col" data-prologue-handover={handover ? "" : undefined}>
      {kept === null && !handover ? null : <Family draw={kept} water={water} turned={handover && turned} hometown={view.hometown} />}
      {/* The heading only over chips: a page with no years yet shows no empty heading. */}
      {years.length === 0 ? null : <h2 className="mt-4 text-[14px] font-bold text-text-2">{say(handover ? "ui.page.years" : "ui.page.years.running")}</h2>}
      <Chips chips={years} mark="data-years" />
      {story.length === 0 ? null : <Chips chips={story} mark="data-handover-story" />}
      {handover ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <StatBox label={say("ui.page.money")} value={formatMoney(naira, "NGN")} mark="money" />
            <StatBox label={say("ui.page.ready")} value={readyWords(readyPercent(view) ?? 0)} mark="ready" />
          </div>
          <JapacityLine />
        </>
      ) : null}
    </div>
  );
  const ways =
    archetype === null ? null : (
      <div className="mt-4 mb-4 px-4">
        <p className="mb-2.5 text-center text-[13px] text-text-2">{say("ui.door.page.lead")}</p>
        <WayChips id={archetype.id} mark="data-page-ways" />
      </div>
    );
  // prologue:printed-page-hands-over: on a desk the years fill the desk the door stood on; the page on the stage prints in place at the handover.
  if (desk)
    return (
      <div data-page-handover={handover ? "" : undefined} data-page-running={handover ? undefined : ""} data-v={view.v}>
        <DeskSlot
          fill={{
            mark: handover ? "handover" : "years",
            look,
            steps: deskSteps(),
            stage: (
              <DeskStage
                look={look}
                style={person?.style}
                page={<DataPage page={page} print={handover} />}
                onPage={
                  handover && archetype !== null ? (
                    <span className="sticker-cut door-deal absolute top-[46px] right-[-14px] z-[2]" style={{ rotate: "10deg" }} aria-hidden>
                      <ModelPicture model={LIFE_THINGS[archetype.id].tile} size={64} />
                    </span>
                  ) : null
                }
                life={null}
                home={null}
                cheer={handover}
              />
            ),
            title,
            line,
            keys: handover && fine ? <DeskKeys keys={[{ caps: [say("ui.door.keys.enter")], does: say("ui.prologue.start") }]} /> : null,
          }}
          foot={foot ?? null}
        >
          {starts === null ? null : (
            <div className="mx-4 mt-4">
              <StartsIn home={home} chip={starts} />
            </div>
          )}
          {yearsPart}
          {ways}
        </DeskSlot>
      </div>
    );
  return (
    <div onClick={handover ? finish : undefined} data-page-handover={handover ? "" : undefined} data-page-running={handover ? undefined : ""} data-v={view.v}>
      <DoorFrame mark={handover ? "handover" : "years"} look={look} title={null} {...(foot === undefined ? {} : { foot })}>
        <div className="px-5 pt-4 text-center">
          {/* A life with no name of its own (a fixed life a test starts) is told by the prologue's closing line instead. */}
          <h1 className="text-[24px] leading-tight font-bold">{title}</h1>
          <p className="mt-0.5 text-[14px] text-text-2">{line}</p>
        </div>
        <div className="relative mx-5 mt-4 -rotate-2" data-gate-sheet={handover ? "handover" : "years"}>
          <DataPage page={page} print />
          {archetype === null ? null : (
            <span className="sticker-cut absolute top-[46px] right-[-14px] z-[2]" style={{ rotate: "10deg" }} aria-hidden>
              <ModelPicture model={LIFE_THINGS[archetype.id].tile} size={64} />
            </span>
          )}
        </div>
        <div className="mx-4 mt-5 flex items-start gap-3">
          <span className="sticker-cut shrink-0" style={{ rotate: "-5deg" }} aria-hidden>
            <span className="door-photo relative block h-[150px] w-[112px] overflow-hidden rounded-[18px]">
              <FigurePicture look={look} style={person?.style} view="cheer" className="absolute bottom-[-6px] left-1/2 h-[160px] max-w-none -translate-x-1/2" />
            </span>
          </span>
          {starts === null ? null : <StartsIn home={home} chip={starts} />}
        </div>
        {yearsPart}
        {ways}
      </DoorFrame>
    </div>
  );
}

/** The desk's band after Begin: every step done, and no way back (prologue:front-door-three-screens). */
function deskSteps(): DeskStep[] {
  return ["ui.life.title", "ui.door.life", "ui.door.home"].map((key) => ({ title: say(key), state: "done", onGo: null }));
}

/** The page as the handover (prologue:printed-page-hands-over): shown once, right after the prologue's last answer. */
export function PageHandover({ onDone }: { onDone: () => void }) {
  const view = useView();
  return <PageScreen view={view} archetype={presetArchetype()} draw={null} onDone={onDone} />;
}
