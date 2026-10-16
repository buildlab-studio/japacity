// The prologue: sixteen to the end of the service year (prologue.md R-PROLOGUE-008), on the door's sky (the door's
// the compound and the figure on its plinth are gone). A new life never shows a card: its archetype answers every step
// (R-PROLOGUE-010) while the page over the compound fills as the years go by, and when the last answer is in, the
// page is the handover (R-PROLOGUE-014): the family the game drew turned over, the years before as fact chips, the
// money as it stands, and the world opens when Go is tapped. A life with no archetype (the setting
// `prologue.full`, or a fixed life a test starts) shows each card, one at a time, its answers greyed with the reason.
import { content } from "@japacity/content";
import type { PlayerView, ReportLine } from "@japacity/sim";
import { ArrowRight, Dices } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { readPerson } from "../../authority/person";
import { FactChip } from "../../shared/ui/FactChip";
import { Rejection } from "../../shared/ui/Rejection";
import { ReportLines } from "../../shared/ui/ReportLines";
import { ToneTag } from "../../shared/ui/ToneTag";
import { formatMoney } from "../../shared/words/format";
import { AGE, valueWords, yearsOf } from "../../shared/words/quality";
import { requirementSentence } from "../../shared/words/requirement";
import { nextStepOf, ownWayOf, RACKS_STEP, racksAtHand } from "../../shared/words/sixteen";
import { bandWords, hasWords, hometownWords, nameOf, say, sayCount, words } from "../../shared/words/text";
import { gateLook } from "../../shared/frontdoor/Gate";
import { lookOf } from "../../shared/frontdoor/looks";
import { type Archetype, answersInOrder, archetypeOf, doorAnswer, fullPrologue, type Home, HOMES, withAge, withHome } from "../../shared/frontdoor/archetypes";
import { DataPage, type PageFields } from "../../shared/datapage/DataPage";
import { JapacityLine, StatBox } from "../../shared/datapage/PageParts";
import { DoorAction, DoorFrame } from "../../shared/frontdoor/DoorFrame";
import { homePicture, LIFE_THINGS } from "../../shared/frontdoor/lives";
import { plannedYears } from "../../shared/frontdoor/planned";
import { FigurePicture, ModelPicture } from "../../shared/frontdoor/LookPicture";
import { readDoor } from "../../shared/datapage/door";
import { WayChips } from "../../shared/frontdoor/WayChips";
import { pageOf } from "../../shared/datapage/PageSheet";
import { presetWait } from "../../shared/net/pace";
import { readyPercent, readyWords } from "../../shared/words/ready";
import { familyCard, noteAnswer, noteCard, readTrail, storyChips, type YearChip, yearChips } from "./years";

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

/** A tile's own opening lines, where content has them: where it grew up and what home was. */
function tileOpening(archetype: Pick<Archetype, "id"> | null): [string, string] | null {
  if (archetype === null) return null;
  const [where, home] = [`prologue.archetype.${archetype.id}.begin.where`, `prologue.archetype.${archetype.id}.begin.home`];
  return hasWords(where) && hasWords(home) ? [say(where), say(home)] : null;
}

/**
 * The draw as sentences, never as a bare figure (R-PROLOGUE-002, 008). A tile with its own opening says it in place of
 * the draw's town and means (the child of the water grew up on the lagoon, R-PROLOGUE-012); the rest is the draw's.
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

/** The draw, the qualities that have moved from nothing, and money, as they stand (R-PROLOGUE-008). No `draw` leaves the draw out. */
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

/** The archetype kept beside the save for this life, with the age and the home the front door set, unless the setting `prologue.full` asks for every card. */
export function presetArchetype(): Archetype | null {
  if (fullPrologue()) return null;
  const archetype = archetypeOf(readPerson()?.archetype);
  const door = readDoor();
  return archetype === null ? null : withHome(withAge(archetype, door?.age ?? 0), door?.home);
}

/**
 * Sends the archetype's answer at every card, once per view (R-PROLOGUE-010), and keeps each
 * answer and what its draw gave for the page (R-PROLOGUE-014). Null `answer`: the card shows (a refusal, or a card
 * with every answer shut). Online the answers leave one every `PRESET_STEP_MS`, so the longest preset stays under the
 * server's command limit and the page fills at an even pace (R-SERVER-025); offline they go at once.
 */
function usePreset(view: PlayerView, prologue: Prologue, archetype: Archetype | null): string | null {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const rejected = useGame((state) => state.rejection !== null);
  const online = useGame((state) => state.account !== null);
  const sentAt = useRef<number | null>(null);
  const leftAt = useRef<number | null>(null);
  const answer = archetype === null || rejected ? null : doorAnswer(archetype, prologue);
  useEffect(() => {
    if (answer === null || busy || sentAt.current === view.v) return;
    const go = (): void => {
      sentAt.current = view.v;
      leftAt.current = Date.now();
      noteCard(prologue.draw, prologue.lastOutcome);
      noteAnswer(prologue.step, answer, prologue.step === "draw");
      void send({ type: "prologue/choose", step: prologue.step, answer });
    };
    const wait = online ? presetWait(leftAt.current, Date.now()) : 0;
    if (wait === 0) {
      go();
      return;
    }
    const timer = window.setTimeout(go, wait);
    return () => window.clearTimeout(timer);
  }, [answer, busy, online, view.v, prologue.step, prologue.lastOutcome, prologue.draw, send]);
  return answer;
}

export function PrologueView() {
  const view = useView();
  const prologue = view.prologue;
  if (prologue === null) return null;
  return <PrologueCard view={view} prologue={prologue} />;
}

function PrologueCard({ view, prologue }: { view: PlayerView; prologue: Prologue }) {
  const archetype = presetArchetype();
  const answer = usePreset(view, prologue, archetype);
  // A card answered by hand keeps its trail for the page as a preset does.
  useEffect(() => {
    if (answer === null) noteCard(prologue.draw, prologue.lastOutcome);
  }, [answer, prologue.draw, prologue.lastOutcome]);
  // A new life never shows a card: the page fills as its years go by (R-PROLOGUE-014).
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
 * The story's first step, in its own nudge words, so the handover names where to start, never a month number (the
 * A trader with capital starts at the meetup or the official page; the
 * handover has its own words for a step whose nudge is not something to do. A life whose archetype takes its first
 * step somewhere of its own says that place: the nurse's job at the clinic, a trade's motor park.
 * A life in Makoko's room with no job says the racks beside it, as the band's nudge does at the same moment (R-ACTIVITY-017;
 * ; the motor park comes after.
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


/** When the family's card turns over on the handover page; no stamp lands, and the world opens only on Go or a tap (R-PROLOGUE-014). */
export const TURN_MS = 450;


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
              <span className="label ml-auto shrink-0 text-[9px] text-text-2">{say("ui.page.family")}</span>
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
        // Where the life starts is said in a line of its own across the page (R-PROLOGUE-013).
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
 * Where the life starts (R-PROLOGUE-013, 014): the home's picture over the story's own chip of where the character
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
 * The page after Begin (R-PROLOGUE-014), in the door's dress (the door's second design): "Your page, printed" over the
 * travel data page with the life's thing slapped on it; you cheering on a sticker beside where you start and when rent
 * is next due; the family the game drew; the years before as chips with the story's own; the money and japacity as they
 * stand; and where this life can lead. While the years go by (`onDone` absent) the family is still face down and the
 * chips fill as the trail has them; as the handover the family turns over once and the world opens when Go is tapped,
 * or the page. No stamp lands: the page takes none before a visa.
 */
function PageScreen({ view, archetype, draw, onDone }: { view: PlayerView; archetype: Archetype | null; draw: Draw | null; onDone?: () => void }) {
  const person = readPerson();
  const handover = onDone !== undefined;
  const [turned, setTurned] = useState(false);
  const done = useRef(false);
  const finish = (): void => {
    if (done.current || onDone === undefined) return;
    done.current = true;
    onDone();
  };
  useEffect(() => {
    if (!handover) return;
    // The page waits for the player: ten facts are not read in three seconds.
    const timers = [window.setTimeout(() => setTurned(true), TURN_MS)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // The page's timeline runs once, as the handover opens.
  }, [handover]);

  const trail = readTrail();
  const kept = draw ?? trail.draw;
  const water = archetype?.id === "water";
  const base = pageOf(view, person);
  // The family and where it is from print on the page as its card turns over; until then their lines wait (R-PROLOGUE-009, 014).
  const shown = handover && turned && kept !== null;
  const look = gateLook(person?.look);
  const page: PageFields = {
    ...base,
    photo: lookOf(look)?.picture ?? "",
    family: shown ? familyCard(kept, water, view.hometown).means : "",
    from: shown && view.hometown !== null ? hometownWords(view.hometown) : "",
  };
  const lived = yearChips(trail, view, water);
  // While the years go by, the years the tile will pass and has not yet are listed as not yet, and fill as they are lived.
  const years = handover || archetype === null ? lived : [...lived, ...plannedYears(archetype).flatMap((planned): YearChip[] => (lived.some((chip) => chip.id === planned.id) ? [] : [{ id: planned.id, icon: planned.icon, label: planned.label, note: planned.note ?? null, state: planned.state ?? null }]))];
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
  return (
    <div onClick={handover ? finish : undefined} data-page-handover={handover ? "" : undefined} data-page-running={handover ? undefined : ""} data-v={view.v}>
      <DoorFrame mark={handover ? "handover" : "years"} look={look} title={null} {...(foot === undefined ? {} : { foot })}>
        <div className="px-5 pt-4 text-center">
          {/* A life with no name of its own (a fixed life a test starts) is told by the prologue's closing line instead. */}
          <h1 className="text-[24px] leading-tight font-bold">{named ? say(handover ? "ui.door.page.printed" : "prologue.door.page.title") : words(PROLOGUE_CLOSED)}</h1>
          <p className="mt-0.5 text-[14px] text-text-2">{named && handover ? say("ui.door.page.over", { name: person.name }) : say("ui.profile.age", { years: ageYears(view) })}</p>
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
        {archetype === null ? null : (
          <div className="mt-4 mb-4 px-4">
            <p className="mb-2.5 text-center text-[13px] text-text-2">{say("ui.door.page.lead")}</p>
            <WayChips id={archetype.id} mark="data-page-ways" />
          </div>
        )}
      </DoorFrame>
    </div>
  );
}

/** The page as the handover (R-PROLOGUE-014): shown once, right after the prologue's last answer. */
export function PageHandover({ onDone }: { onDone: () => void }) {
  const view = useView();
  return <PageScreen view={view} archetype={presetArchetype()} draw={null} onDone={onDone} />;
}
