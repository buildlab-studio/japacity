// One bond: its stage, who it is with and how they are marked, what is known
// of them, the time together so far, the proposals both ways, the joint and
// its consents, the stand-in, and ending it with its cost said first
// (docs/rules/people.md R-PEOPLE-013 to 018, 021, 035 to 045, 051).
import { content } from "@japacity/content";
import type { Id, PlayerView, ReportLine } from "@japacity/sim";
import { Heart, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { bondName, endCost, interviewName, jointRoutes, momentWords, monthsWithout, personOf, stepsFor, TOGETHER, type BondView } from "../../shared/sim/people";
import { Button } from "../../shared/ui/Button";
import { Card, Tag } from "../../shared/ui/Panel";
import { ReportLines } from "../../shared/ui/ReportLines";
import { formatBand, formatBp, formatMoney, formatNumber, playerMonth } from "../../shared/words/format";
import { countryWords, jobWords } from "../../shared/words/people";
import { nameOf, runningName, say, sayCount } from "../../shared/words/text";
import { BlockReport } from "../../shared/moderation/BlockReport";
import { Conversation } from "./Conversation";
import type { PairApi } from "./pairApi";

const MOMENTS_SHOWN = 5;
const MONTHS_PER_YEAR = 12;

/** The quiet mark beside a name: who the other side is (R-PEOPLE-051, R-PEOPLE-054). */
export function Mark({ label }: { label: BondView["label"] }) {
  return (
    <span title={label === "computer" ? say("ui.people.mark.computer.long") : undefined}>
      <Tag>{say(`ui.people.mark.${label}`)}</Tag>
    </span>
  );
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
    <div className="flex flex-col gap-1">
      <h4 className="text-sm font-semibold">{say("ui.people.facts")}</h4>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** The time together, newest first, hidden while an interview is open (R-INTERVIEW-005). */
export function Moments({ bond }: { bond: BondView }) {
  if (bond.moments === null) return <p className="text-sm text-muted">{say("ui.people.moments.hidden", { piece: interviewName() })}</p>;
  const newest = [...bond.moments].reverse();
  const shown = newest.slice(0, MOMENTS_SHOWN);
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-sm font-semibold">
        {say("ui.people.moments")} <span className="font-normal text-muted">({sayCount("ui.people.moments.count", bond.moments.length, { count: bond.moments.length })})</span>
      </h4>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{say("ui.people.moments.none")}</p>
      ) : (
        <ol className="flex flex-col gap-0.5 text-sm">
          {shown.map((moment) => (
            <li key={moment.n}>{momentWords(moment)}</li>
          ))}
          {newest.length > shown.length ? <li className="text-muted">{say("ui.people.moments.more", { count: newest.length - shown.length })}</li> : null}
        </ol>
      )}
    </div>
  );
}

function stepWords(proposal: NonNullable<BondView["pending"]["mine"]>): string {
  return say(`ui.people.step.${proposal.step}`);
}

function Pending({ bond }: { bond: BondView }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const { mine, theirs } = bond.pending;
  if (mine === null && theirs === null) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-sunk p-3 text-sm">
      {mine === null ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1">
            {mine.step === "joint" && mine.route !== null ? say("ui.people.pending.mine.joint", { route: runningName(mine.route) }) : say("ui.people.pending.mine", { step: stepWords(mine) })}
          </p>
          <Button small disabled={busy} onClick={() => void send({ type: "people/withdraw", bond: bond.id })}>
            {say("ui.people.withdraw")}
          </Button>
        </div>
      )}
      {theirs === null ? null : (
        <div className="flex flex-col gap-2">
          <p className="font-medium">
            {theirs.step === "joint" && theirs.route !== null
              ? say("ui.people.pending.theirs.joint", { route: runningName(theirs.route), lead: say(`ui.people.lead.${theirs.lead ?? "them"}`) })
              : say("ui.people.pending.theirs", { step: stepWords(theirs) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button small variant="primary" disabled={busy} onClick={() => void send({ type: "people/answer", bond: bond.id, step: theirs.step, yes: true })}>
              {say("ui.people.answer.yes")}
            </Button>
            <Button small disabled={busy} onClick={() => void send({ type: "people/answer", bond: bond.id, step: theirs.step, yes: false })}>
              {say("ui.people.answer.no")}
            </Button>
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
  if (routes.length === 0) return <p className="text-sm text-muted">{say("ui.people.propose.joint.none")}</p>;
  const chosen = route !== null && routes.includes(route) ? route : (routes[0] ?? null);
  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm"
      aria-label={say("ui.people.propose.joint")}
      onSubmit={(event) => {
        event.preventDefault();
        if (chosen === null) return;
        void send({ type: "people/propose", bond: bond.id, step: "joint", route: chosen, lead }).then((reply) => {
          if (reply?.ok === true) onSent(reply.lines);
        });
      }}
    >
      <label htmlFor={`${id}-route`} className="font-medium">
        {say("ui.people.propose.joint.route")}
      </label>
      <select id={`${id}-route`} value={chosen ?? ""} onChange={(event) => setRoute(event.target.value as Id<"route">)} className="min-h-11 rounded-lg border border-line bg-paper px-3">
        {routes.map((value) => (
          <option key={value} value={value}>
            {nameOf(value)}
          </option>
        ))}
      </select>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium">{say("ui.people.propose.joint.lead")}</legend>
        {(["me", "them"] as const).map((value) => (
          <label key={value} className="flex min-h-11 items-center gap-2">
            <input type="radio" name={`${id}-lead`} value={value} checked={lead === value} onChange={() => setLead(value)} className="size-5" />
            {say(`ui.people.propose.joint.lead.${value}`)}
          </label>
        ))}
      </fieldset>
      <div>
        <Button small type="submit" variant="primary" disabled={busy || chosen === null}>
          {say("ui.people.propose.joint.send")}
        </Button>
      </div>
    </form>
  );
}

/** Moments still needed before the partner step may be asked (R-PEOPLE-016). */
function momentsLeft(bond: BondView): number {
  return Math.max(0, content.tuning.people.partnerMoments - (bond.moments?.length ?? 0));
}

/** The month a declined question may be asked again, while it is still ahead (R-PEOPLE-016, decision 0009). */
function coolingUntil(view: PlayerView, bond: BondView): number | null {
  return bond.cooldownUntil !== null && view.month < bond.cooldownUntil ? bond.cooldownUntil : null;
}

/** Why no question can be asked yet, said once: the moments still short, or the cooldown after a no. */
function Held({ bond }: { bond: BondView }) {
  const view = useView();
  if (bond.pending.theirs !== null || bond.pending.mine !== null || view.ended) return null;
  const left = momentsLeft(bond);
  const until = coolingUntil(view, bond);
  if (bond.stage === "courting" && left > 0) return <p className="text-sm text-muted">{sayCount("ui.people.courting.next", left, { count: left })}</p>;
  if (until !== null && stepsFor(view, bond).length > 0) return <p className="text-sm text-muted">{say("ui.people.cooldown", { month: playerMonth(until) })}</p>;
  return null;
}

function Proposals({ bond, onSent }: { bond: BondView; onSent: (lines: ReportLine[]) => void }) {
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
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {steps.includes("partner") ? (
          <Button small variant="primary" disabled={busy} onClick={() => propose("partner")}>
            <Heart size={14} />
            {say("ui.people.propose.partner")}
          </Button>
        ) : null}
        {steps.includes("marry") ? (
          <Button small variant="primary" disabled={busy} onClick={() => propose("marry")}>
            {say("ui.people.propose.marry")}
          </Button>
        ) : null}
        {steps.includes("joint") ? (
          <Button small aria-expanded={joint} onClick={() => setJoint(!joint)}>
            {say("ui.people.propose.joint")}
          </Button>
        ) : null}
      </div>
      {steps.includes("marry") ? <p className="text-xs text-muted">{say("ui.people.propose.marry-share", { amount: formatMoney(content.tuning.people.weddingShare, "NGN") })}</p> : null}
      {joint ? <JointForm bond={bond} onSent={onSent} /> : null}
    </div>
  );
}

/** The joint resting on this bond, its scores, and what it may count of this life (R-PEOPLE-004, R-PEOPLE-030, R-PEOPLE-044). */
function Joint({ bond }: { bond: BondView }) {
  const { people } = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  // the view carries the other side's consent (funds in the facts) but not this side's, so the last choice made here is shown.
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
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm" data-joint>
      <h4 className="font-semibold">{say("ui.people.joint")}</h4>
      <p>{say("ui.people.joint.on", { route: nameOf(joint.route), lead: say(`ui.people.joint.lead.${joint.lead}`) })}</p>
      {joint.myScore === null || joint.theirScore === null ? null : <p>{say("ui.people.joint.scores", { mine: formatNumber(joint.myScore), theirs: formatNumber(joint.theirScore) })}</p>}
      <h5 className="font-medium">{say("ui.people.consent")}</h5>
      <div className="flex flex-wrap gap-2">
        <Button small aria-pressed={funds === true} disabled={busy} onClick={() => consent({ countFunds: true })}>
          {say("ui.people.consent.funds.yes")}
        </Button>
        <Button small aria-pressed={funds === false} disabled={busy} onClick={() => consent({ countFunds: false })}>
          {say("ui.people.consent.funds.no")}
        </Button>
      </div>
      <p className="text-xs text-muted">{say("ui.people.consent.funds.help")}</p>
      {bond.label === "computer" ? null : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button small aria-pressed={standIn === true} disabled={busy} onClick={() => consent({ standInMay: true })}>
              {say("ui.people.consent.stand-in.yes")}
            </Button>
            <Button small aria-pressed={standIn === false} disabled={busy} onClick={() => consent({ standInMay: false })}>
              {say("ui.people.consent.stand-in.no")}
            </Button>
          </div>
          <p className="text-xs text-muted">{say("ui.people.consent.stand-in.help")}</p>
        </>
      )}
    </div>
  );
}

function End({ bond }: { bond: BondView }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [asking, setAsking] = useState(false);
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
        <Button small variant="quiet" onClick={() => setAsking(true)}>
          {say("ui.people.end")}
        </Button>
      </div>
    );
  }
  return (
    <div role="group" aria-label={say("ui.people.end")} className="flex flex-col gap-2 rounded-lg border border-bad p-3 text-sm">
      <p>{costWords}</p>
      {cost.joint ? <p>{say("ui.people.end.joint")}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button small disabled={busy} onClick={() => void send({ type: "people/end", bond: bond.id }).then(() => setAsking(false))}>
          {say("ui.people.end.confirm")}
        </Button>
        <Button small variant="quiet" onClick={() => setAsking(false)}>
          {say("ui.people.end.keep")}
        </Button>
      </div>
    </div>
  );
}

/** The warnings that stand on a bond: the stand-in, gossip while partnered, a computer drifting (R-PEOPLE-041 to 043). */
function Warnings({ bond, view }: { bond: BondView; view: PlayerView }) {
  const warnings: string[] = [];
  if (bond.standIn !== null) warnings.push(say(`ui.people.stand-in.${bond.standIn}`, { piece: interviewName() }));
  const partnered = view.people.bonds.some((other) => other.id !== bond.id && TOGETHER.includes(other.stage));
  if (bond.stage === "courting" && partnered) warnings.push(say("ui.people.gossip", { chance: formatBp(content.tuning.people.gossipBp) }));
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
    <ul className="flex flex-col gap-1 text-sm">
      {warnings.map((warning) => (
        <li key={warning} className="flex items-start gap-2">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-bad" />
          {warning}
        </li>
      ))}
    </ul>
  );
}

const DECLINED = "line.people.declined";

/** What the last proposal did, with the cooldown said when they said no (R-PEOPLE-016). */
function Answered({ lines }: { lines: ReportLine[] }) {
  if (lines.length === 0) return null;
  const declined = lines.some((line) => line.key === DECLINED);
  const months = content.tuning.people.proposeCooldown;
  return (
    <div role="status" className="flex flex-col gap-1 rounded-lg bg-sunk p-3 text-sm">
      <ReportLines lines={lines} />
      {declined ? <p className="text-muted">{sayCount("ui.people.declined.cooldown", months, { months })}</p> : null}
    </div>
  );
}

export function BondCard({ bond, api }: { bond: BondView; api: PairApi | null }) {
  const view = useView();
  const [answered, setAnswered] = useState<ReportLine[]>([]);
  const pair = bond.label === "computer" ? null : bond.pair;
  return (
    <li>
      <Card tone={bond.pending.theirs !== null ? "attention" : "plain"} className="flex flex-col gap-3" data-bond={bond.id}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            {bondName(bond)}
            <Mark label={bond.label} />
          </h3>
          <Tag tone={TOGETHER.includes(bond.stage) ? "good" : "plain"}>{say(`ui.people.stage.${bond.stage}`)}</Tag>
        </div>
        {pair === null || api === null ? null : <BlockReport who={{ pair, name: bondName(bond) }} cites={{ pair }} surface="pair" />}
        <Warnings bond={bond} view={view} />
        <Facts bond={bond} />
        <Moments bond={bond} />
        <Held bond={bond} />
        <Pending bond={bond} />
        <Proposals bond={bond} onSent={setAnswered} />
        <Answered lines={answered} />
        <Joint bond={bond} />
        {pair === null || api === null ? null : <Conversation api={api} pair={pair} name={bondName(bond)} />}
        <End bond={bond} />
      </Card>
    </li>
  );
}

/** An ended bond, read-only (R-PEOPLE-039). */
export function EndedBond({ bond }: { bond: BondView }) {
  return (
    <li>
      <Card tone="muted" className="flex flex-col gap-2" data-bond={bond.id}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            {bondName(bond)}
            <Mark label={bond.label} />
          </h3>
          <Tag>{say("ui.people.stage.ended")}</Tag>
        </div>
        <Moments bond={bond} />
        <p className="text-sm text-muted">{say("ui.people.ended.recourt", { months: content.tuning.people.recourtMonths })}</p>
      </Card>
    </li>
  );
}
