// The agent's sheet in the world (docs/rules/advice.md R-ADVICE-005, 006, 009, 013). The world's
// card form, inside the sheet the shell opens for a tapped thing: who he is, his line with the fee,
// what he says he does (knows someone inside, or will chase it for you) and which paper that brings
// how many months sooner, the fee as the cost, the one tell that shows at once, and three free looks
// that find the rest before any fee is paid. It never names his kind and never counts his tells:
// what he was is told after, in the report line. The promise and the papers he leaves behind are
// the same card with their own choices.
import type { OfferView as Offer, ReportLine, ReportParam } from "@japacity/sim";
import { Banknote, BookUser, BookX, Building2, Check, Eye, IdCard, MessageSquareWarning, ShieldCheck, Timer, TrendingDown, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { cue } from "../../shared/sound/cues";
import { Mark } from "../../shared/ui/Mark";
import { Rejection } from "../../shared/ui/Rejection";
import { formatMoney } from "../../shared/words/format";
import { tidyLines } from "../../shared/words/lines";
import { hasWords, inMonths, nameOf, runningName, say, words } from "../../shared/words/text";
import { afterPaying, plannedCosts } from "../../shared/words/cost";
import { adviceWords } from "./advice.words";

/** Every entry of the agent family starts with this (R-ADVICE-005). */
const FAMILY = "offer.agent-";
const PROMISE = "offer.agent-promise";
const PAPERS = "offer.agent-papers";
const TAKE = "take";
const DECLINE = "decline";
/** A look's choice id starts with this; the same id in `signs` marks the look as done (R-ADVICE-006). */
const LOOK = "look-";

export function inAgentFamily(entry: string): boolean {
  return entry.startsWith(FAMILY);
}

function feeOf(offer: Offer): number | null {
  const fee = offer.terms.fee;
  return typeof fee === "number" ? fee : null;
}

function paramsOf(offer: Offer): Record<string, ReportParam> {
  const fee = feeOf(offer);
  return fee === null ? {} : { fee: { currency: "NGN", amount: fee } };
}

/** Who stands there: his drawn name (`<entry>.who.<n>.name`), or the entry's name when none was drawn (R-ADVICE-010). */
function whoOf(offer: Offer): string {
  const agent = offer.terms.agent;
  return typeof agent === "string" && hasWords(`${agent}.name`) ? nameOf(agent) : nameOf(offer.entry);
}

/** What he says he does, the paper he names ("" for none) and the months sooner (R-ADVICE-013). Null when the offer carries none. */
function pitchOf(offer: Offer): { pitch: string; paper: string; months: number } | null {
  const { pitch, paper, months } = offer.terms;
  if (typeof pitch !== "string" || typeof paper !== "string" || typeof months !== "number") return null;
  return { pitch, paper, months };
}

/** The office a paper comes from, in the sheet's words: the registry for a transcript, else the office. */
function deskOf(paper: string): string {
  const key = `advice.desk.${paper}`;
  return adviceWords(hasWords(key) ? key : "advice.desk");
}

/** R-ADVICE-013: his claim in plain words, then what it would bring forward and by how much. */
function Pitch({ offer }: { offer: Offer }) {
  const said = pitchOf(offer);
  if (said === null) return null;
  const moves =
    said.paper === ""
      ? adviceWords("advice.moves.none")
      : adviceWords(said.months === 1 ? "advice.moves.one" : "advice.moves", { document: runningName(said.paper), desk: deskOf(said.paper), count: said.months });
  return (
    <section className="flex flex-col gap-1 rounded-[5px] bg-sheet-2 px-3 py-2 text-[15px] leading-snug" data-agent-pitch={said.pitch}>
      <p data-agent-says-he>{words(`${offer.entry}.pitch.${said.pitch}`)}</p>
      <p className="font-semibold" data-agent-moves>
        {moves}
      </p>
    </section>
  );
}

/** The looks on this offer, in content's order. */
function looksOf(offer: Offer): Offer["choices"] {
  return offer.choices.filter((choice) => choice.id.startsWith(LOOK));
}

/** The tells the player has seen: the offer's signs less the marks of looks done. */
function tellsOf(offer: Offer): string[] {
  const marks = new Set(looksOf(offer).map((choice) => choice.id));
  return offer.signs.filter((sign) => !marks.has(sign));
}

/** The agent's version of the route's checklist, as item names (R-ADVICE-005). */
function saysOf(offer: Offer): string[] {
  const says = offer.terms.says;
  const route = offer.terms.route;
  if (typeof says !== "string" || says === "" || typeof route !== "string") return [];
  return says.split(",").map((item) => words(`${route}.item.${item}.name`));
}

/**
 * The lines of a reply the sheet shows: the agent's own and the papers' (R-ADVICE-006, 009), not the
 * ledger's or the generic "you answered" line, which the month's report keeps. Every line when none is.
 */
const TOLD = ["line.offer.agent-", "line.offer.look-", "line.document."];

function toldLines(lines: readonly ReportLine[]): ReportLine[] {
  const told = lines.filter((line) => TOLD.some((prefix) => line.key.startsWith(prefix)));
  return told.length > 0 ? told : tidyLines(lines);
}

type Choose = (offer: Offer, choice: string) => Promise<ReportLine[] | null>;

function useChoose(): { choose: Choose; idle: boolean } {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const ended = useView().ended;
  const choose: Choose = async (offer, choice) => {
    const reply = await send({ type: "offer/choose", offer: offer.id, choice });
    return reply?.ok === true ? reply.lines : null;
  };
  return { choose, idle: !busy && !ended };
}

/** Who he is and his line. The sheet's own head names the agent; what he leaves behind carries its title. */
function Head({ offer, titled }: { offer: Offer; titled: boolean }) {
  return (
    <div>
      <p className="label text-text-2" data-agent-who>
        {whoOf(offer)}
      </p>
      {titled ? <h3 className="title text-[21px] leading-tight">{words(`${offer.entry}.title`, paramsOf(offer))}</h3> : null}
      <p className="mt-2 text-[15px] leading-snug text-text-2" data-agent-line>
        {words(`${offer.entry}.body`, paramsOf(offer))}
      </p>
    </div>
  );
}

function Cost({ fee }: { fee: number }) {
  return (
    <div className="flex items-baseline justify-between border-y border-sheet-line py-2.5" data-agent-fee>
      <span className="text-[14px] font-semibold">{say("ui.world.costs")}</span>
      <span className="num text-[26px]">{formatMoney(fee, "NGN")}</span>
    </div>
  );
}

function Lines({ lines, mark }: { lines: readonly ReportLine[]; mark: string }) {
  return (
    <ul role="status" className="flex flex-col gap-1 rounded-[5px] bg-sheet-muted px-3 py-2 text-[14px] leading-snug" data-lines={mark}>
      {toldLines(lines).map((line, index) => (
        <li key={`${line.key}-${String(index)}`} className={`pop ${line.tone === "bad" ? "font-semibold text-out" : ""}`}>
          {words(line.key, line.params)}
        </li>
      ))}
    </ul>
  );
}

/** The one main button, with what is left after; then the way to say no (R-WORLD-006). */
function Choices({ offer, main, onChosen }: { offer: Offer; main: Offer["choices"]; onChosen: (lines: ReportLine[]) => void }) {
  const { choose, idle } = useChoose();
  // The fee leaves cash first and the bank for the rest (decision 0012): what is left after counts both pockets and the month's plan, and a short fee says the gap (R-WORLD-006).
  const view = useView();
  const plan = useGame((state) => state.plan);
  const fee = feeOf(offer) ?? 0;
  const paying = fee > 0 ? afterPaying(view, plannedCosts(view, plan), [{ currency: "NGN", amount: fee }]) : null;
  const after = paying === null ? null : paying.short === null ? say("ui.world.left", { amount: formatMoney(paying.left.amount, "NGN") }) : say("ui.world.short", { amount: formatMoney(paying.short.amount, "NGN") });
  const decline = offer.choices.find((choice) => choice.id === DECLINE);
  const pick = (choice: string) => {
    cue(choice === DECLINE ? "close" : "coin");
    void choose(offer, choice).then((lines) => {
      if (lines !== null) onChosen(lines);
    });
  };
  return (
    // The foot stays in view while the sheet scrolls, as the Month sheet's does.
    <div className="sticky -bottom-4 -mx-4 -mb-4 flex flex-col gap-1.5 bg-sheet px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
      {main.map((choice, index) => (
        <button
          key={choice.id}
          type="button"
          className={index === 0 && main.length === 1 ? "btn-main" : "btn-dark press flex min-h-12 w-full items-center justify-between px-4 text-[16px] disabled:opacity-50"}
          disabled={!choice.allowed || !idle}
          onClick={() => pick(choice.id)}
          data-agent-choice={choice.id}
        >
          <span>{words(`${offer.entry}.choice.${choice.id}`)}</span>
          {after === null ? null : <span className="text-[13px] font-semibold opacity-80">{after}</span>}
        </button>
      ))}
      {main.length > 0 && main.every((choice) => !choice.allowed) ? <p className="text-[13px] text-text-2">{adviceWords("advice.short")}</p> : null}
      {decline === undefined ? null : (
        <button type="button" className="press min-h-11 w-full rounded-[5px] text-[15px] font-bold text-text-2" disabled={!idle} onClick={() => pick(DECLINE)} data-agent-choice={DECLINE}>
          {words(`${offer.entry}.choice.${DECLINE}`)}
        </button>
      )}
    </div>
  );
}

/** What the last look's reply said, by the look, and the signs on the offer before it. */
interface Found {
  look: string;
  lines: ReportLine[];
  before: readonly string[];
}

const TELL_PARAM = "advice.tell.";

/** The tells a look's reply names as found that the player had not seen before it: its lines' `tell` params. */
function freshTells(found: Found | null): Set<string> {
  const tells = (found?.lines ?? []).flatMap((line) => {
    const tell = line.params.tell;
    return typeof tell === "string" && tell.startsWith(TELL_PARAM) ? [tell.slice(TELL_PARAM.length)] : [];
  });
  return new Set(tells.filter((tell) => !(found?.before ?? []).includes(tell)));
}

/** The free looks (R-ADVICE-006): each sends its choice, costs nothing, and shows what it found before any fee. */
function Looks({ offer, found, setFound }: { offer: Offer; found: Found | null; setFound: (found: Found) => void }) {
  const { choose, idle } = useChoose();
  const looks = looksOf(offer);
  if (looks.length === 0) return null;
  const nobody = looks.some((choice) => !choice.allowed && !offer.signs.includes(choice.id));
  return (
    <section className="flex flex-col gap-1.5" aria-label={adviceWords("advice.looks")}>
      <p className="flex items-center justify-between gap-2">
        <span className="label">{adviceWords("advice.looks")}</span>
        <span className="rounded-[4px] bg-sheet-muted px-1.5 py-0.5 text-[12px] font-bold text-text-2" data-looks-free>
          {adviceWords("advice.looks.free")}
        </span>
      </p>
      {looks.map((choice) => {
        const done = offer.signs.includes(choice.id);
        return done ? (
          <p key={choice.id} className="flex min-h-11 items-center gap-2 rounded-[5px] border-2 border-sheet-line px-3 text-[14px] text-text-2" data-look={choice.id} data-look-done>
            <Check size={16} className="shrink-0 text-in" aria-label={adviceWords("advice.look.done")} />
            {words(`${offer.entry}.sign.${choice.id}`)}
          </p>
        ) : (
          <button
            key={choice.id}
            type="button"
            className="chip press flex min-h-11 w-full items-center gap-2 px-3 text-left text-[14px] font-bold disabled:opacity-50"
            disabled={!choice.allowed || !idle}
            onClick={() => {
              cue("tap");
              void choose(offer, choice.id).then((lines) => {
                if (lines !== null) setFound({ look: choice.id, lines, before: offer.signs });
              });
            }}
            data-look={choice.id}
          >
            <Eye size={16} className="shrink-0" aria-hidden />
            {words(`${offer.entry}.choice.${choice.id}`)}
          </button>
        );
      })}
      {nobody ? <p className="text-[13px] text-text-2">{adviceWords("advice.look.nobody")}</p> : null}
      {/* What a look finds joins "You notice" above, marked as just found; its reply shows here only when it found nothing new. */}
      {found === null || freshTells(found).size > 0 ? null : <Lines lines={found.lines} mark={found.look} />}
    </section>
  );
}

/** Each tell's icon (R-TEXT-008): the thing the player noticed, drawn. */
const TELL_ICONS: Readonly<Record<string, LucideIcon>> = {
  "cash-only": Banknote,
  guarantee: ShieldCheck,
  "no-office": Building2,
  "no-licence": IdCard,
  "holds-passport": BookUser,
  "no-passport": BookX,
  "pay-today": Timer,
  "price-low": TrendingDown,
  "friend-warned": MessageSquareWarning,
};

/**
 * A tell as the player notices it (R-ADVICE-006, R-TEXT-008): its icon, a few words and the warning mark, never his
 * whole sentence. A tell with no short words yet keeps the entry's own.
 */
function Tell({ entry, tell, fresh }: { entry: string; tell: string; fresh: boolean }) {
  const short = `advice.tell.${tell}.short`;
  const said = adviceWords(short);
  const Icon = TELL_ICONS[tell] ?? Eye;
  return (
    <li className={`pop flex min-h-11 items-center gap-2.5 rounded-[6px] bg-sheet-2 px-3 py-2 text-[15px] leading-tight font-semibold ${fresh ? "ring-2 ring-out" : ""}`} data-tell={tell} data-fresh={fresh ? "" : undefined}>
      <Icon size={18} className="shrink-0 text-strong" aria-hidden />
      <span className="min-w-0 flex-1">{said === short ? words(`${entry}.sign.${tell}`) : said}</span>
      <Mark state="setback" word={adviceWords("advice.tell.mark")} />
    </li>
  );
}

/** An agent at the stop or the desk (R-ADVICE-005, 006). */
export function AgentSheet({ offer, onChosen }: { offer: Offer; onChosen: (lines: ReportLine[]) => void }) {
  const fee = feeOf(offer);
  const tells = tellsOf(offer);
  const says = saysOf(offer);
  const take = offer.choices.filter((choice) => choice.id === TAKE);
  const [found, setFound] = useState<Found | null>(null);
  const fresh = freshTells(found);
  return (
    <article className="flex flex-col gap-3" data-agent-sheet={offer.entry}>
      <Head offer={offer} titled={false} />
      <Pitch offer={offer} />
      {fee === null ? null : <Cost fee={fee} />}
      {tells.length === 0 ? null : (
        <section className="flex flex-col gap-1" aria-label={adviceWords("advice.notice")}>
          <p className="label">{adviceWords("advice.notice")}</p>
          <ul className="flex flex-col gap-1.5">
            {tells.map((tell) => (
              <Tell key={tell} entry={offer.entry} tell={tell} fresh={fresh.has(tell)} />
            ))}
          </ul>
        </section>
      )}
      <Looks offer={offer} found={found} setFound={setFound} />
      {says.length === 0 ? null : (
        <section className="flex flex-col gap-1" aria-label={adviceWords("advice.says")} data-agent-says>
          <p className="label">{adviceWords("advice.says")}</p>
          <ul className="list-disc pl-5 text-[14px] leading-snug">
            {says.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-[13px] text-text-2">{adviceWords("advice.says.sure")}</p>
        </section>
      )}
      <Choices offer={offer} main={take} onChosen={onChosen} />
    </article>
  );
}

/** The scammer's papers (R-ADVICE-005, 008): what he offers, in the entry's words, and nothing more. */
export function PapersSheet({ offer, onChosen }: { offer: Offer; onChosen: (lines: ReportLine[]) => void }) {
  const fee = feeOf(offer);
  return (
    <article className="flex flex-col gap-3" data-agent-sheet={offer.entry}>
      <Head offer={offer} titled />
      {fee === null ? null : <Cost fee={fee} />}
      <Choices offer={offer} main={offer.choices.filter((choice) => choice.id !== DECLINE)} onChosen={onChosen} />
    </article>
  );
}

/**
 * The overpromiser's promise (R-ADVICE-005): the card with the month he named. Its one
 * choice, `wait`, would take the offer and close it, so the month he named would pass with no line
 * saying nothing moved. The card sends nothing; the sheet's close leaves it waiting.
 */
export function PromiseSheet({ offer }: { offer: Offer }) {
  const view = useView();
  return (
    <article className="flex flex-col gap-3" data-agent-sheet={offer.entry}>
      <Head offer={offer} titled />
      <p className="border-y border-sheet-line py-2.5 text-[14px] font-semibold" data-agent-month>
        {adviceWords("advice.promise.month", { when: inMonths(offer.expiresMonth, view.month) })}
      </p>
    </article>
  );
}

/** The follow-ups an agent leaves: his promise and his papers, which carry his name as a term. */
function leftBy(offer: Offer, agents: readonly string[]): boolean {
  const agent = offer.terms.agent;
  return (offer.entry === PROMISE || offer.entry === PAPERS) && typeof agent === "string" && agents.some((id) => agent === id || agent.startsWith(`${id}.`));
}

/**
 * The sheet for a tapped thing's offers: the agent family's own cards, and every other offer in the
 * plain card the shell hands as `others`. What the last choice moved stays in view after the offer
 * goes, so a choice is never silent.
 */
export function AgentSheets({ ids, others }: { ids: readonly string[]; others: (only: (offer: Offer) => boolean) => ReactNode }) {
  const view = useView();
  const [outcome, setOutcome] = useState<ReportLine[] | null>(null);
  const agents = ids.filter(inAgentFamily);
  const rest = ids.filter((id) => !inAgentFamily(id));
  const open = view.offers.filter((offer) => agents.includes(offer.entry) || leftBy(offer, agents));
  return (
    <div className="flex flex-col gap-5">
      {outcome === null ? null : <Lines lines={outcome} mark="outcome" />}
      {open.map((offer) =>
        offer.entry === PROMISE ? (
          <PromiseSheet key={offer.id} offer={offer} />
        ) : offer.entry === PAPERS ? (
          <PapersSheet key={offer.id} offer={offer} onChosen={setOutcome} />
        ) : (
          <AgentSheet key={offer.id} offer={offer} onChosen={setOutcome} />
        ),
      )}
      {agents.length > 0 ? <Rejection /> : null}
      {agents.length > 0 && open.length === 0 && outcome === null ? <p className="text-[14px] text-text-2">{adviceWords("advice.gone")}</p> : null}
      {rest.length === 0 ? null : others((offer) => rest.includes(offer.entry))}
    </div>
  );
}
