// One bond: its stage, who it is with and how they are marked, what is known
// of them, the proposals both ways, the joint and
// its consents, the stand-in, and ending it with its cost said first
// (person:courting-opens-a-bond, person:time-together-is-an-act, person:talking-adds-moments, person:proposing-a-step, person:agreed-partner-and-marriage, person:one-partner-at-a-time, person:joint-application-proposed, person:either-side-ends-a-bond, person:joint-collapses-with-bond, person:ender-pays-in-standing, person:one-left-keeps-own-gains, person:ended-bond-record-kept, person:leaving-player-ends-bonds, person:gossip-when-two-timing, person:computer-partner-drifts, person:stand-in-after-absence, person:stand-in-acts-narrowly, person:computers-need-no-stand-in, person:view-shows-people). Dressed as the cards of the game's look (docs/design/09-the-games-look.md
// section 2): the person's face sticker over what is known of them, the mark and the facts as sticker chips, white cards
// for what waits, the pressed yellow button for the one action and ghost buttons for the rest.
import { content } from "@japacity/content";
import type { Id, PlayerView, ReportLine } from "@japacity/sim";
import { Heart, TriangleAlert } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { FaceSticker } from "../../shared/front-door/LookPicture";
import { lookForName } from "../../shared/front-door/looks";
import { bondName, endCost, interviewName, jointRoutes, monthsWithout, personOf, stepsFor, TOGETHER, type BondView } from "../../shared/view/person";
import { GhostButton } from "../../shared/ui/look/GhostButton";
import { PressButton } from "../../shared/ui/look/PressButton";
import { StickerChip } from "../../shared/ui/look/StickerChip";
import { ReportLines } from "../../shared/ui/ReportLines";
import { formatBand, formatMoney, formatNumber } from "../../shared/words/format";
import { chanceBand } from "../../shared/words/jobs";
import { countryWords, jobWords } from "../../shared/words/person";
import { inMonths, nameOf, runningName, say, sayCount } from "../../shared/words/text";

const MONTHS_PER_YEAR = 12;

/** The quiet mark beside a name: who the other side is (person:view-shows-people, person:computer-mark-is-quiet), as a small sticker chip. */
export function Mark({ label }: { label: BondView["label"] }) {
  return (
    <span title={label === "computer" ? say("ui.people.mark.computer.long") : undefined} data-mark-label={label}>
      <StickerChip tilt={-3} className="text-[12px] font-bold">
        {say(`ui.people.mark.${label}`)}
      </StickerChip>
    </span>
  );
}

/** The person's face, a round sticker: one of the door's looks picked from their name, since no look travels with a bond. */
export function BondFace({ bond, size = 44 }: { bond: Pick<BondView, "id" | "role" | "label" | "person" | "facts">; size?: number }) {
  return <FaceSticker look={lookForName(bondName(bond))} size={size} tilt={-4} tint="people" />;
}

function routeState(state: string): string {
  return say(`ui.route.state.${state}`);
}

/** What the view carries of the other side: never funds without consent, pay only as the floor met. */
export function Facts({ bond }: { bond: BondView }) {
  const facts = bond.facts;
  if (facts === null) return null;
  const items: string[] = [say("ui.people.facts.age", { years: Math.floor(facts.ageMonths / MONTHS_PER_YEAR) })];
  if (facts.where === "abroad" && facts.country !== null) items.push(say("ui.people.facts.abroad", { country: countryWords(facts.country) }));
  else if (facts.where === "road") items.push(say("ui.people.facts.road"));
  else items.push(say("ui.people.facts.home"));
  if (facts.status !== null) {
    items.push(
      facts.statusMonthsLeft === null
        ? say("ui.people.facts.status", { status: runningName(facts.status) })
        : say("ui.people.facts.status-left", { status: runningName(facts.status), months: facts.statusMonthsLeft }),
    );
  }
  items.push(facts.job === null ? say("ui.people.facts.no-job") : say("ui.people.facts.job", { job: jobWords(runningName(facts.job)) }));
  items.push(say(`ui.people.facts.from.${facts.home}`));
  if (facts.englishBand !== null) items.push(say("ui.people.facts.english", { band: formatBand(facts.englishBand) }));
  for (const [route, met] of Object.entries(facts.meetsFloor)) {
    if (bond.stage === "connected" || bond.stage === "courting") break;
    items.push(say(met ? "ui.people.facts.floor.met" : "ui.people.facts.floor.not", { route: runningName(route) }));
  }
  if (facts.funds !== null && typeof facts.funds.amount === "number") items.push(say("ui.people.facts.funds", { amount: formatMoney(facts.funds.amount, facts.funds.currency) }));
  if (facts.joint !== null) items.push(say("ui.people.facts.joint", { route: nameOf(facts.joint.route), state: routeState(facts.joint.state) }));
  return (
    <div className="flex flex-col gap-2" data-bond-facts>
      <div className="flex items-center gap-2.5">
        <BondFace bond={bond} size={40} />
        <h4 className="text-[16px] font-bold">{say("ui.people.facts")}</h4>
      </div>
      <ul className="flex flex-wrap gap-1.5 text-[13px]">
        {items.map((item, index) => (
          <li key={item} className="sticker-chip chip-wrap bg-sheet-2" style={{ rotate: `${String(index % 2 === 0 ? -1.5 : 1.5)}deg` }} data-sticker-chip>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function stepWords(proposal: NonNullable<BondView["pending"]["mine"]>): string {
  return say(`ui.people.step.${proposal.step}`);
}

export function Pending({ bond }: { bond: BondView }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const { mine, theirs } = bond.pending;
  if (mine === null && theirs === null) return null;
  return (
    <div className="look-card flex flex-col gap-2.5 p-3 text-[14px]" data-bond-pending>
      {mine === null ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 leading-snug">
            {mine.step === "joint" && mine.route !== null ? say("ui.people.pending.mine.joint", { route: runningName(mine.route) }) : say("ui.people.pending.mine", { step: stepWords(mine) })}
          </p>
          <GhostButton disabled={busy} onClick={() => void send({ type: "people/withdraw", bond: bond.id })}>
            {say("ui.people.withdraw")}
          </GhostButton>
        </div>
      )}
      {theirs === null ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-[16px] leading-snug font-bold">
            {theirs.step === "joint" && theirs.route !== null
              ? say("ui.people.pending.theirs.joint", { route: runningName(theirs.route), lead: say(`ui.people.lead.${theirs.lead ?? "them"}`) })
              : say("ui.people.pending.theirs", { step: stepWords(theirs) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <PressButton className="flex-1" disabled={busy} onClick={() => void send({ type: "people/answer", bond: bond.id, step: theirs.step, yes: true })}>
              {say("ui.people.answer.yes")}
            </PressButton>
            <GhostButton disabled={busy} onClick={() => void send({ type: "people/answer", bond: bond.id, step: theirs.step, yes: false })}>
              {say("ui.people.answer.no")}
            </GhostButton>
          </div>
        </div>
      )}
    </div>
  );
}

function JointForm({ bond, onSent }: { bond: BondView; onSent: (lines: ReportLine[]) => void }) {
  const id = useId();
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const routes = jointRoutes(view);
  const [route, setRoute] = useState<Id<"route"> | null>(routes[0] ?? null);
  const [lead, setLead] = useState<"me" | "them">("me");
  if (routes.length === 0) return <p className="text-[14px] text-text-2">{say("ui.people.propose.joint.none")}</p>;
  const chosen = route !== null && routes.includes(route) ? route : (routes[0] ?? null);
  return (
    <form
      className="look-card flex flex-col gap-2 p-3 text-[14px]"
      aria-label={say("ui.people.propose.joint")}
      onSubmit={(event) => {
        event.preventDefault();
        if (chosen === null) return;
        void send({ type: "people/propose", bond: bond.id, step: "joint", route: chosen, lead }).then((reply) => {
          if (reply?.ok === true) onSent(reply.lines);
        });
      }}
    >
      <label htmlFor={`${id}-route`} className="font-bold">
        {say("ui.people.propose.joint.route")}
      </label>
      <select id={`${id}-route`} value={chosen ?? ""} onChange={(event) => setRoute(event.target.value as Id<"route">)} className="look-card min-h-12 px-3 text-[16px] font-semibold">
        {routes.map((value) => (
          <option key={value} value={value}>
            {nameOf(value)}
          </option>
        ))}
      </select>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-bold">{say("ui.people.propose.joint.lead")}</legend>
        {(["me", "them"] as const).map((value) => (
          <label key={value} className="flex min-h-11 items-center gap-2">
            <input type="radio" name={`${id}-lead`} value={value} checked={lead === value} onChange={() => setLead(value)} className="size-5" />
            {say(`ui.people.propose.joint.lead.${value}`)}
          </label>
        ))}
      </fieldset>
      <PressButton type="submit" className="w-full" disabled={busy || chosen === null}>
        {say("ui.people.propose.joint.send")}
      </PressButton>
    </form>
  );
}

/** Moments still needed before the partner step may be asked (person:proposing-a-step). */
export function momentsLeft(bond: BondView): number {
  return Math.max(0, content.tuning.people.partnerMoments - (bond.moments?.length ?? 0));
}

/** The month a declined question may be asked again, while it is still ahead (person:proposing-a-step, decision 0002). */
function coolingUntil(view: PlayerView, bond: BondView): number | null {
  return bond.cooldownUntil !== null && view.month < bond.cooldownUntil ? bond.cooldownUntil : null;
}

/** Why no question can be asked yet, said once: the moments still short, or the cooldown after a no. */
export function Held({ bond }: { bond: BondView }) {
  const view = useView();
  if (bond.pending.theirs !== null || bond.pending.mine !== null || view.ended) return null;
  const left = momentsLeft(bond);
  const until = coolingUntil(view, bond);
  if (bond.stage === "courting" && left > 0) return <p className="text-[14px] leading-snug text-text-2">{sayCount("ui.people.courting.next", left, { count: left })}</p>;
  if (until !== null && stepsFor(view, bond).length > 0) return <p className="text-[14px] leading-snug text-text-2">{say("ui.people.cooldown", { when: inMonths(until, view.month) })}</p>;
  return null;
}

export function Proposals({ bond, onSent }: { bond: BondView; onSent: (lines: ReportLine[]) => void }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [joint, setJoint] = useState(false);
  const steps = stepsFor(view, bond).filter((step) => step !== "partner" || momentsLeft(bond) === 0);
  if (steps.length === 0 || bond.pending.mine !== null || bond.pending.theirs !== null || coolingUntil(view, bond) !== null || view.ended) return null;
  const propose = (step: "partner" | "marry") =>
    void send({ type: "people/propose", bond: bond.id, step }).then((reply) => {
      if (reply?.ok === true) onSent(reply.lines);
    });
  // One yellow button a surface: the first step there is to ask; any other is a ghost beside it.
  const main = steps.includes("partner") ? "partner" : steps.includes("marry") ? "marry" : null;
  const asked = (step: "partner" | "marry", children: ReactNode) =>
    step === main ? (
      <PressButton className="flex-1" disabled={busy} onClick={() => propose(step)}>
        {children}
      </PressButton>
    ) : (
      <GhostButton disabled={busy} onClick={() => propose(step)}>
        {children}
      </GhostButton>
    );
  return (
    <div className="flex flex-col gap-2" data-bond-proposals>
      <div className="flex flex-wrap gap-2">
        {steps.includes("partner")
          ? asked(
              "partner",
              <>
                <Heart size={16} aria-hidden />
                {say("ui.people.propose.partner")}
              </>,
            )
          : null}
        {steps.includes("marry") ? asked("marry", say("ui.people.propose.marry")) : null}
        {steps.includes("joint") ? (
          <GhostButton aria-expanded={joint} onClick={() => setJoint(!joint)}>
            {say("ui.people.propose.joint")}
          </GhostButton>
        ) : null}
      </div>
      {steps.includes("marry") ? <p className="text-[12px] text-text-2">{say("ui.people.propose.marry-share", { amount: formatMoney(content.tuning.people.weddingShare, "NGN") })}</p> : null}
      {joint ? <JointForm bond={bond} onSent={onSent} /> : null}
    </div>
  );
}

/** The joint resting on this bond, its scores, and what it may count of this life (person:money-counted-never-moved, person:canada-spouse-points, person:stand-in-acts-narrowly). */
export function Joint({ bond }: { bond: BondView }) {
  const { people } = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  // The view carries the other side's consent (funds in the facts) but not this side's, so the last choice made here is shown.
  const [funds, setFunds] = useState<boolean | null>(null);
  const [standIn, setStandIn] = useState<boolean | null>(null);
  const joint = people.joint;
  if (joint === null || joint.bond !== bond.id) return null;
  const consent = (change: { countFunds?: boolean; standInMay?: boolean }) =>
    void send({ type: "people/consent", bond: bond.id, ...change }).then((reply) => {
      if (reply?.ok !== true) return;
      if (change.countFunds !== undefined) setFunds(change.countFunds);
      if (change.standInMay !== undefined) setStandIn(change.standInMay);
    });
  return (
    <div className="look-card flex flex-col gap-2 p-3 text-[14px]" data-joint>
      <h4 className="text-[16px] font-bold">{say("ui.people.joint")}</h4>
      <p>{say("ui.people.joint.on", { route: nameOf(joint.route), lead: say(`ui.people.joint.lead.${joint.lead}`) })}</p>
      {joint.myScore === null || joint.theirScore === null ? null : <p>{say("ui.people.joint.scores", { mine: formatNumber(joint.myScore), theirs: formatNumber(joint.theirScore) })}</p>}
      <h5 className="font-bold">{say("ui.people.consent")}</h5>
      <Segment
        options={[
          { on: funds === true, words: say("ui.people.consent.funds.yes"), pick: () => consent({ countFunds: true }) },
          { on: funds === false, words: say("ui.people.consent.funds.no"), pick: () => consent({ countFunds: false }) },
        ]}
        busy={busy}
      />
      <p className="text-[12px] text-text-2">{say("ui.people.consent.funds.help")}</p>
      {bond.label === "computer" ? null : (
        <>
          <Segment
            options={[
              { on: standIn === true, words: say("ui.people.consent.stand-in.yes"), pick: () => consent({ standInMay: true }) },
              { on: standIn === false, words: say("ui.people.consent.stand-in.no"), pick: () => consent({ standInMay: false }) },
            ]}
            busy={busy}
          />
          <p className="text-[12px] text-text-2">{say("ui.people.consent.stand-in.help")}</p>
        </>
      )}
    </div>
  );
}

/** Two choices of one consent as a segmented pill, the one made lit; each keeps its pressed state for a screen reader. */
function Segment({ options, busy }: { options: readonly { on: boolean; words: string; pick: () => void }[]; busy: boolean }) {
  return (
    <div className="phone-segment flex w-full p-1" data-segment>
      {options.map((option) => (
        <button key={option.words} type="button" aria-pressed={option.on} disabled={busy} onClick={option.pick} className={`press min-h-11 flex-1 px-3 text-[14px] leading-tight font-bold ${option.on ? "phone-segment-on" : ""}`}>
          {option.words}
        </button>
      ))}
    </div>
  );
}

/** Ending the bond, its cost said first; `asked` opens on the cost, for a row that already said "End it" (world:one-action-one-sheet). */
export function End({ bond, asked = false, onKeep }: { bond: BondView; asked?: boolean; onKeep?: () => void }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [asking, setAsking] = useState(asked);
  if (view.ended) return null;
  const cost = endCost(view, bond);
  const costWords = cost.absence
    ? say("ui.people.end.absence")
    : cost.standing === 0
      ? say("ui.people.end.cost-wellbeing", { wellbeing: formatNumber(Math.abs(cost.wellbeing)) })
      : say("ui.people.end.cost", { standing: formatNumber(Math.abs(cost.standing)), wellbeing: formatNumber(Math.abs(cost.wellbeing)) });
  if (!asking) {
    return (
      <div>
        <GhostButton onClick={() => setAsking(true)}>{say("ui.people.end")}</GhostButton>
      </div>
    );
  }
  return (
    <div role="group" aria-label={say("ui.people.end")} className="look-card flex flex-col gap-2 p-3 text-[14px]" data-bond-end>
      <p className="text-[16px] leading-snug font-bold">{costWords}</p>
      {cost.joint ? <p>{say("ui.people.end.joint")}</p> : null}
      <div className="flex flex-wrap gap-2">
        <GhostButton className="text-bad" disabled={busy} onClick={() => void send({ type: "people/end", bond: bond.id }).then(() => setAsking(false))}>
          {say("ui.people.end.confirm")}
        </GhostButton>
        <GhostButton
          onClick={() => {
            setAsking(asked);
            onKeep?.();
          }}
        >
          {say("ui.people.end.keep")}
        </GhostButton>
      </div>
    </div>
  );
}

/** The warnings that stand on a bond: the stand-in, gossip while partnered, a computer drifting (person:gossip-when-two-timing, person:computer-partner-drifts and person:stand-in-after-absence). */
export function Warnings({ bond, view }: { bond: BondView; view: PlayerView }) {
  const warnings: string[] = [];
  if (bond.standIn !== null) warnings.push(say(`ui.people.stand-in.${bond.standIn}`, { piece: interviewName() }));
  const partnered = view.people.bonds.some((other) => other.id !== bond.id && TOGETHER.includes(other.stage));
  if (bond.stage === "courting" && partnered) warnings.push(say("ui.people.gossip", { chance: say(`ui.people.gossip.${chanceBand(content.tuning.people.gossipBp)}`) }));
  const person = personOf(bond);
  const patience = person === null ? null : (content.person[person]?.behaviour.patienceMonths ?? null);
  if (patience !== null && bond.role === "partner" && bond.stage !== "connected" && bond.stage !== "ended") {
    const name = bondName(bond);
    const without = monthsWithout(view, bond);
    // A month short of the patience is the last month a moment still holds them.
    if (without !== null && without > 0 && without >= patience - 1) warnings.push(sayCount("ui.people.drift.near", without, { months: without, patience, name }));
    else warnings.push(say("ui.people.drift.rule", { name, patience }));
  }
  if (warnings.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5 text-[14px]" data-bond-warnings>
      {warnings.map((warning) => (
        <li key={warning} className="look-card flex items-start gap-2 p-2.5 leading-snug">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-bad" />
          {warning}
        </li>
      ))}
    </ul>
  );
}

const DECLINED = "line.people.declined";

/** What the last proposal did, with the cooldown said when they said no (person:proposing-a-step). */
export function Answered({ lines }: { lines: ReportLine[] }) {
  if (lines.length === 0) return null;
  const declined = lines.some((line) => line.key === DECLINED);
  const months = content.tuning.people.proposeCooldown;
  return (
    <div role="status" className="look-card flex flex-col gap-1 p-3 text-[14px]">
      <ReportLines lines={lines} />
      {declined ? <p className="text-text-2">{sayCount("ui.people.declined.cooldown", months, { months })}</p> : null}
    </div>
  );
}
