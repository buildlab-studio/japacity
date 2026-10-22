// The people of this life on the phone (world:nobody-picked-from-list, world:phone-rises-over-scene, world:one-action-one-sheet): once courting, a
// bond lives in its Chats thread, whose head carries the bond's stage and its choices, one row each, the details folded
// behind the row; and Chats' People row opens the slots, the one place they are seen in the world, with the invite card
// on an empty partner slot or a computer sibling (person:invite-fills-a-slot). These are the people tab's own pieces
// (BondCard's parts, the slot card, InviteCard), handed to the phone by the shell, so the phone never imports this
// feature. A pair's conversation is Chats' own thread.
import { content } from "@japacity/content";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { BlockReport } from "../../shared/moderation/BlockReport";
import { bondName, endCost, endedHow, interviewName, personOf, slotKind, slotOrder, stepsFor, TOGETHER, type BondView, type SlotView } from "../../shared/view/person";
import { GhostButton } from "../../shared/ui/lively/GhostButton";
import { StickerChip } from "../../shared/ui/lively/StickerChip";
import { AfterEarlyWin } from "../../shared/ui/stage";
import { countWords } from "../../shared/words/count";
import { countryWords } from "../../shared/words/person";
import { blurbOf, forMonths, hasWords, lowerFirst, monthsAgo, nameOf, runningName, say, sayCount } from "../../shared/words/text";
import { Answered, BondFace, End, Facts, Held, Joint, Mark, momentsLeft, Pending, Proposals, Warnings } from "./BondCard";
import { InviteMaker, InviteOut } from "./InviteCard";
import type { PairApi } from "./pairApi";

/**
 * Who the slot is to the character: "Partner", "Sibling", "Mother", "Father". A sibling's slot carries no number ("Sibling
 * 2" reads as a placeholder); the name under it tells two siblings apart, as bondName does.
 */
function slotTitle(key: string): string {
  return say(`ui.people.slot.${slotKind(key)}`);
}

function siblingWhere(bond: BondView): string | null {
  const facts = bond.facts;
  if (facts === null) return null;
  if (facts.where !== "abroad" || facts.country === null) return say("ui.people.sibling.facts.home");
  if (facts.status === null) return say("ui.people.sibling.facts.abroad-plain", { country: countryWords(facts.country) });
  return say("ui.people.sibling.facts.abroad", { country: countryWords(facts.country), status: runningName(facts.status) });
}

/**
 * One slot as the family is told, on the People row's screen. An empty partner slot offers the invite card behind a tap,
 * as a computer sibling's does (person:invite-fills-a-slot); a sibling who plays keeps block and report on their record, and their
 * conversation is their Chats thread.
 */
function SlotCard({ slotKey, slot, bond, api }: { slotKey: string; slot: SlotView; bond: BondView | null; api: PairApi | null }) {
  const view = useView();
  const [inviting, setInviting] = useState(false);
  const kind = slotKind(slotKey);
  const person = bond === null ? null : personOf(bond);
  const blurb = person === null ? null : blurbOf(person);
  const parent = kind === "mother" || kind === "father" ? kind : null;
  const name = bond !== null ? bondName(bond, view.people.bonds) : slot.state !== "computer" ? null : parent !== null ? say(`ui.people.parent.name.${parent}`) : kind === "sibling" ? bondName({ id: slotKey, role: "sibling", label: "computer", person: null, facts: null }) : null;
  const pair = kind === "sibling" && slot.state === "player" && bond !== null ? bond.pair : null;
  const invite = (label: string, open?: string) =>
    inviting ? (
      <InviteMaker slot={slotKey} />
    ) : (
      <div>
        <GhostButton onClick={() => setInviting(true)} {...(open === undefined ? {} : { "data-invite-open": open })}>
          {label}
        </GhostButton>
      </div>
    );
  return (
    <li>
      <div className="lively-card flex flex-col gap-2.5 p-3" data-slot={slotKey} data-state={slot.state}>
        <div className="flex items-start gap-3">
          {bond === null ? null : <BondFace bond={bond} />}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* The quiet mark stands beside who the slot is, the one place on every card, so a long name never moves it. */}
            <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-text-2" data-slot-title>
              {slotTitle(slotKey)}
              {slot.label === null ? null : <Mark label={slot.label} />}
            </span>
            <span className="text-[16px] font-bold">{name ?? say(`ui.people.slot.state.${slot.state}`)}</span>
          </div>
          {bond === null || kind === "sibling" ? null : (
            <StickerChip tint="people" tilt={3} className="shrink-0 text-[12px] font-bold">
              {say(`ui.people.stage.${bond.stage}`)}
            </StickerChip>
          )}
        </div>
        {parent !== null && slot.state === "computer" ? <p className="text-[14px] leading-snug text-text-2">{say(`ui.people.parent.blurb.${parent}`)}</p> : null}
        {blurb === null ? null : <p className="text-[14px] leading-snug text-text-2">{blurb}</p>}
        {kind === "sibling" && bond !== null && slot.state === "computer" ? <p className="text-[14px] leading-snug">{siblingWhere(bond)}</p> : null}
        {kind === "sibling" && slot.state === "player" ? <p className="text-[14px] leading-snug">{say("ui.people.sibling.friend")}</p> : null}
        {kind === "sibling" && slot.state === "player" && bond !== null ? <Facts bond={bond} /> : null}
        {pair === null || api === null || bond === null ? null : <BlockReport who={{ pair, name: bondName(bond, view.people.bonds) }} cites={{ pair }} surface="pair" />}
        {slot.state === "invited" && slot.invite !== null ? <InviteOut slot={slotKey} invite={slot.invite} api={api} /> : null}
        {kind === "partner" && slot.state === "empty" && !view.ended ? <AfterEarlyWin>{invite(say("ui.people.partner.invite"), slotKey)}</AfterEarlyWin> : null}
        {kind === "sibling" && slot.state === "computer" && !view.ended ? <AfterEarlyWin>{invite(say("ui.people.sibling.invite"))}</AfterEarlyWin> : null}
      </div>
    </li>
  );
}

/** Who the player sponsors, and a bar on sponsoring with how long it holds, never a month number (undertaking:sponsored-arrivals-wait-to-sponsor; world:top-band-is-lively-pill). */
function Sponsoring() {
  const { people, month } = useView();
  if (people.sponsoring === null && people.barUntilMonth === null) return null;
  return (
    <div className="lively-card flex flex-col gap-1 p-3 text-[14px]" data-sponsoring>
      {people.sponsoring === null ? null : <p>{say("ui.people.sponsoring", { route: nameOf(people.sponsoring.route), when: lowerFirst(monthsAgo(people.sponsoring.month, month)) })}</p>}
      {people.barUntilMonth === null ? null : <p className="text-bad">{say("ui.people.bar", { when: forMonths(people.barUntilMonth, month) })}</p>}
    </div>
  );
}

/**
 * One row of the head: its name and one figure; what else there is folds behind a tap (world:one-action-one-sheet). The figure is a
 * person's words (text:voice-by-surface), so it may run to a second line rather than be cut.
 */
function Row({ id, name, figure, open = false, children }: { id: string; name: string; figure: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="group border-b border-sheet-line last:border-b-0" open={open} data-head-row={id}>
      <summary className="press flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 text-[14px] [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 font-bold">{name}</span>
        <span className="ml-auto min-w-0 text-right leading-snug text-text-2" data-head-figure>
          {figure}
        </span>
        <ChevronDown size={16} className="shrink-0 text-text-2 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-2 pb-3 text-[14px]">{children}</div>
    </details>
  );
}

/** A count as a person says it at the head of a line: "Six", "Once" is the words file's own (text:bands-not-figures). */
function countSaid(count: number): string {
  const said = countWords(count);
  return said.charAt(0).toUpperCase() + said.slice(1);
}

/** The times together so far, in a person's words (text:bands-not-figures, text:voice-by-surface): "Nothing shared yet", "Once together", "Three times together". */
export function togetherWords(count: number): string {
  return sayCount("ui.people.head.moments", count, { count: countSaid(count) });
}

/** The times together still short before asking, in a person's words: "Six more times together before you can ask". */
export function leftWords(count: number): string {
  return sayCount("ui.people.head.moments-left", count, { count: countSaid(count) });
}

/** Who the ask row asks: a computer by name, a friend as "your friend" (text:voice-by-surface: "Ask Dele", never "Ask them"). */
export function askName(bond: BondView): string {
  return bond.person === null ? say("ui.people.who.player") : bondName(bond);
}

/** What the ask row's figure says: the moments still short, the first step there is to ask, or not yet. */
function askFigure(view: ReturnType<typeof useView>, bond: BondView): string {
  const left = momentsLeft(bond);
  if (bond.stage === "courting" && left > 0) return leftWords(left);
  const [first] = stepsFor(view, bond);
  return first === undefined ? say("ui.needs.not-yet") : say(`ui.people.step.${first}`);
}

/** What ending costs, in a few words: the whole cost is said once the row is opened. */
function endFigure(view: ReturnType<typeof useView>, bond: BondView): string {
  const cost = endCost(view, bond);
  return say(cost.absence ? "ui.people.head.end.nothing" : cost.standing === 0 ? "ui.people.head.end.wellbeing" : "ui.people.head.end.standing");
}

/**
 * The head of a bond's thread in Chats (world:nobody-picked-from-list, person:time-together-is-an-act): the stage, an answer waiting, what can be asked,
 * the joint, the sponsoring once partners, and ending it. A player on the other side keeps block and report one tap
 * away (pair:block-and-report-one-tap).
 */
export function BondHead({ bond, api }: { bond: BondView; api: PairApi | null }) {
  if (bond.stage === "ended") return <EndedHead bond={bond} />;
  return <LiveHead bond={bond} api={api} />;
}

/**
 * An ended bond's head, for the month its thread stays (person:computer-partner-drifts): what
 * happened in one line, then the reason in their own words where they gave one, a computer who stopped waiting or left.
 */
function EndedHead({ bond }: { bond: BondView }) {
  const view = useView();
  const monthLines = useGame((state) => state.monthLines);
  const lastMonthLines = useGame((state) => state.lastMonthLines);
  const how = endedHow(bond, [...lastMonthLines, ...(view.report?.lines ?? []), ...monthLines]);
  const name = bond.person === null ? say("ui.people.who.player") : bondName(bond);
  const reason = bond.person === null ? null : how === "drift" ? `${bond.person}.drifted` : how === "them" ? `${bond.person}.left` : null;
  return (
    <section className="mb-3 flex flex-col gap-1.5 rounded-[10px] border border-sheet-line bg-sheet-2 px-3 py-3" data-bond-head={bond.id} data-ended={how} aria-label={bondName(bond)}>
      <p className="text-[15px] font-bold" data-ended-line>
        {say(`ui.people.head.ended.${how}`, { name: how === "me" || how === "other" ? name : name.charAt(0).toUpperCase() + name.slice(1) })}
      </p>
      {reason === null || !hasWords(reason) ? null : (
        <p className="text-[14px] leading-snug text-text-2" data-ended-reason>
          {say(reason)}
        </p>
      )}
      {/* The record stays read only; the two may court again after a while (person:ended-bond-record-kept). */}
      <p className="text-[13px] text-text-2" data-recourt>
        {say("ui.people.ended.recourt", { months: content.tuning.people.recourtMonths })}
      </p>
    </section>
  );
}

function LiveHead({ bond, api }: { bond: BondView; api: PairApi | null }) {
  const view = useView();
  const [answered, setAnswered] = useState<Parameters<typeof Answered>[0]["lines"]>([]);
  const [ending, setEnding] = useState(0);
  const pair = bond.label === "computer" ? null : bond.pair;
  const { mine, theirs } = bond.pending;
  const joint = view.people.joint !== null && view.people.joint.bond === bond.id ? view.people.joint : null;
  const sponsoring = TOGETHER.includes(bond.stage) && (view.people.sponsoring !== null || view.people.barUntilMonth !== null);
  const moments = bond.moments?.length ?? 0;
  return (
    <section className="mb-3 rounded-[10px] border border-sheet-line bg-sheet-2 px-3" data-bond-head={bond.id} aria-label={bondName(bond)}>
      <Row
        id="stage"
        name={say(`ui.people.stage.${bond.stage}`)}
        // While an interview is open the times together are hidden, so each answers from memory (interview:one-question-at-a-time).
        figure={bond.moments === null ? say("ui.people.moments.hidden", { piece: interviewName() }) : togetherWords(moments)}
      >
        <Warnings bond={bond} view={view} />
        <Facts bond={bond} />
      </Row>
      {mine === null && theirs === null ? null : (
        <Row id="pending" name={say(theirs === null ? "ui.people.head.asked.mine" : "ui.people.head.asked.theirs")} figure={say(`ui.people.step.${(theirs ?? mine)?.step ?? "partner"}`)} open={theirs !== null}>
          <Pending bond={bond} />
        </Row>
      )}
      {mine !== null || theirs !== null || view.ended || stepsFor(view, bond).length === 0 ? null : (
        <Row id="ask" name={say("ui.people.head.ask", { name: askName(bond) })} figure={askFigure(view, bond)}>
          <Held bond={bond} />
          <Proposals bond={bond} onSent={setAnswered} />
          <Answered lines={answered} />
        </Row>
      )}
      {joint === null ? null : (
        <Row id="joint" name={say("ui.people.joint")} figure={runningName(joint.route)}>
          <Joint bond={bond} />
        </Row>
      )}
      {!sponsoring ? null : (
        <Row id="sponsoring" name={say("ui.people.head.sponsoring")} figure={view.people.sponsoring === null ? say("ui.people.head.barred") : nameOf(view.people.sponsoring.route)}>
          <Sponsoring />
        </Row>
      )}
      {view.ended ? null : (
        <Row id="end" name={say("ui.people.end")} figure={endFigure(view, bond)}>
          <End key={ending} bond={bond} asked onKeep={() => setEnding((count) => count + 1)} />
        </Row>
      )}
      {pair === null || api === null ? null : (
        <div className="py-2">
          <BlockReport who={{ pair, name: bondName(bond) }} cites={{ pair }} surface="pair" />
        </div>
      )}
    </section>
  );
}

/**
 * The People row's screen: the slots of this life (partner, siblings, mother, father) as the people tab shows them, with
 * the invite card behind a tap on an empty partner slot or a computer sibling. Never a list of strangers (world:nobody-picked-from-list).
 */
export function PeopleSlots({ api }: { api: PairApi | null }) {
  const view = useView();
  const { slots, bonds } = view.people;
  const byId = new Map(bonds.map((bond) => [bond.id, bond]));
  return (
    <div className="flex flex-col gap-2" data-people-slots>
      <p className="text-[13px] text-text-2">{say("ui.people.intro")}</p>
      <ul className="flex flex-col gap-2">
        {slotOrder(Object.keys(slots)).map((key) => {
          const slot = slots[key];
          if (slot === undefined) return null;
          const bond = slot.bond === null ? null : (byId.get(slot.bond) ?? null);
          return <SlotCard key={key} slotKey={key} slot={slot} bond={bond} api={api} />;
        })}
      </ul>
      <Sponsoring />
    </div>
  );
}
