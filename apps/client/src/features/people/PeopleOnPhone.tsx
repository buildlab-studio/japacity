// The people of this life on the phone (docs/rules/world.md R-WORLD-020, R-WORLD-018, R-WORLD-006): once courting, a
// bond lives in its Chats thread, whose head carries the bond's stage and its choices, one row each, the details folded
// behind the row; and Chats' People row opens the slots, the one place they are seen in the world, with the invite card
// on an empty partner slot or a computer sibling (people.md R-PEOPLE-010). These are the people tab's own pieces
// (BondCard, SlotCard, InviteCard), handed to the phone by the shell, so the phone never imports this feature.
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useView } from "../../authority/GameProvider";
import { BlockReport } from "../../shared/moderation/BlockReport";
import { bondName, endCost, slotOrder, stepsFor, TOGETHER, type BondView } from "../../shared/sim/people";
import { nameOf, runningName, say, sayCount } from "../../shared/words/text";
import { Answered, End, Facts, Held, Joint, momentsLeft, Pending, Proposals, Warnings } from "./BondCard";
import type { PairApi } from "./pairApi";
import { SlotCard, Sponsoring } from "./PeopleView";

/** One row of the head: its name and one figure on a line that never wraps; what else there is folds behind a tap (R-WORLD-006). */
function Row({ id, name, figure, open = false, children }: { id: string; name: string; figure: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="group border-b border-sheet-line last:border-b-0" open={open} data-head-row={id}>
      <summary className="press flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 text-[14px] [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 font-bold">{name}</span>
        <span className="ml-auto flex min-w-0 items-center gap-1.5 truncate whitespace-nowrap text-text-2">{figure}</span>
        <ChevronDown size={16} className="shrink-0 text-text-2 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-2 pb-3 text-[14px]">{children}</div>
    </details>
  );
}

/** What the ask row's figure says: the moments still short, the first step there is to ask, or not yet. */
function askFigure(view: ReturnType<typeof useView>, bond: BondView): string {
  const left = momentsLeft(bond);
  if (bond.stage === "courting" && left > 0) return sayCount("ui.people.head.moments-left", left, { count: left });
  const [first] = stepsFor(view, bond);
  return first === undefined ? say("ui.needs.not-yet") : say(`ui.people.step.${first}`);
}

/** What ending costs, in a few words: the whole cost is said once the row is opened. */
function endFigure(view: ReturnType<typeof useView>, bond: BondView): string {
  const cost = endCost(view, bond);
  return say(cost.absence ? "ui.people.head.end.nothing" : cost.standing === 0 ? "ui.people.head.end.wellbeing" : "ui.people.head.end.standing");
}

/**
 * The head of a bond's thread in Chats (R-WORLD-020, R-PEOPLE-014): the stage, an answer waiting, what can be asked,
 * the joint, the sponsoring once partners, and ending it. A player on the other side keeps block and report one tap
 * away (pair.md R-PAIR-014).
 */
export function BondHead({ bond, api }: { bond: BondView; api: PairApi | null }) {
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
        figure={sayCount("ui.people.head.moments", moments, { count: moments })}
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
        <Row id="ask" name={say("ui.people.head.ask")} figure={askFigure(view, bond)}>
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
 * the invite card behind a tap on an empty partner slot or a computer sibling. Never a list of strangers (R-WORLD-020).
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
          return <SlotCard key={key} slotKey={key} slot={slot} bond={bond} api={api} partnerInvite />;
        })}
      </ul>
    </div>
  );
}
