// The people tab (docs/rules/people.md): the slots with their state, the
// candidates and the invite card for an empty partner slot, every bond with
// its history and its choices, the sponsor's side, and the bonds that ended.
// A computer character is marked quietly: a small mark on its card, and one
// plain line when it is chosen (R-PEOPLE-054).
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { Users } from "lucide-react";
import { useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { bondName, CALL, personOf, SEE, slotKind, slotOrder, type BondView, type SlotView } from "../../shared/sim/people";
import { Button } from "../../shared/ui/Button";
import { Card, Empty, Panel, Tag } from "../../shared/ui/Panel";
import { blurbOf, nameOf, runningName, say } from "../../shared/words/text";
import { monthEnding } from "../../shared/words/format";
import { BondCard, EndedBond, Facts, Mark } from "./BondCard";
import { Conversation } from "./Conversation";
import { InviteMaker, InviteOut } from "./InviteCard";
import { usePairApi, type PairApi } from "./pairApi";
import { usePairs } from "./usePairs";

function slotTitle(key: string): string {
  const kind = slotKind(key);
  if (kind !== "sibling") return say(`ui.people.slot.${kind}`);
  const number = key.slice("sibling-".length);
  return `${say("ui.people.slot.sibling")} ${number}`;
}

function siblingWhere(bond: BondView): string | null {
  const facts = bond.facts;
  if (facts === null) return null;
  if (facts.where !== "abroad" || facts.country === null) return say("ui.people.sibling.facts.home");
  if (facts.status === null) return say("ui.people.sibling.facts.abroad-plain", { country: nameOf(facts.country) });
  return say("ui.people.sibling.facts.abroad", { country: nameOf(facts.country), status: runningName(facts.status) });
}

function SlotCard({ slotKey, slot, bond, api, pair }: { slotKey: string; slot: SlotView; bond: BondView | null; api: PairApi | null; pair: string | null }) {
  const view = useView();
  const [inviting, setInviting] = useState(false);
  const kind = slotKind(slotKey);
  const person = bond === null ? null : personOf(bond);
  const blurb = person === null ? null : blurbOf(person);
  const name = bond === null ? null : bondName(bond);
  return (
    <li>
      <Card className="flex flex-col gap-2" data-slot={slotKey} data-state={slot.state}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">{slotTitle(slotKey)}</span>
            <span className="flex items-center gap-2 font-semibold">
              {name ?? say(`ui.people.slot.state.${slot.state}`)}
              {slot.label === null ? null : <Mark label={slot.label} />}
            </span>
          </div>
          {bond === null || kind === "sibling" ? null : <Tag>{say(`ui.people.stage.${bond.stage}`)}</Tag>}
        </div>
        {kind === "mother" || kind === "father" ? <p className="text-sm text-muted">{say("ui.people.parent.blurb")}</p> : null}
        {blurb === null ? null : <p className="text-sm text-muted">{blurb}</p>}
        {kind === "sibling" && bond !== null && slot.state === "computer" ? <p className="text-sm">{siblingWhere(bond)}</p> : null}
        {kind === "sibling" && slot.state === "player" ? <p className="text-sm">{say("ui.people.sibling.friend")}</p> : null}
        {kind === "sibling" && slot.state === "player" && bond !== null ? <Facts bond={bond} /> : null}
        {slot.state === "invited" && slot.invite !== null ? <InviteOut slot={slotKey} invite={slot.invite} api={api} /> : null}
        {kind === "sibling" && slot.state === "computer" && !view.ended ? (
          inviting ? (
            <InviteMaker slot={slotKey} />
          ) : (
            <div>
              <Button small variant="quiet" onClick={() => setInviting(true)}>
                {say("ui.people.sibling.invite")}
              </Button>
            </div>
          )
        ) : null}
        {kind === "sibling" && slot.state === "player" && api !== null && pair !== null ? <Conversation api={api} pair={pair} /> : null}
      </Card>
    </li>
  );
}

function livesWords(person: Id<"person">): string {
  const country = content.person[person]?.profile.country ?? null;
  return country === null ? say("ui.people.lives.home") : say("ui.people.lives.abroad", { country: nameOf(country) });
}

/** The computer partners on offer, each marked, and the one plain line when one is chosen (R-PEOPLE-009, R-PEOPLE-054). */
function Candidates() {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [chosen, setChosen] = useState<Id<"person"> | null>(null);
  const candidates = view.people.candidates.filter((candidate) => candidate.role === "partner");
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">{say("ui.people.candidates")}</h3>
      {chosen === null ? null : (
        <p role="status" className="rounded-lg bg-sunk p-3 text-sm">
          {say("ui.people.chosen", { name: nameOf(chosen) })}
        </p>
      )}
      {candidates.length === 0 ? (
        <Empty>{say("ui.people.candidates.none")}</Empty>
      ) : (
        <ul className="grid gap-2 @lg:grid-cols-2">
          {candidates.map(({ person }) => (
            <li key={person}>
              <Card className="flex h-full flex-col gap-2" data-candidate={person}>
                <p className="flex items-center gap-2 font-semibold">
                  {nameOf(person)}
                  <Mark label="computer" />
                </p>
                <p className="text-sm">{blurbOf(person)}</p>
                <p className="text-xs text-muted">{livesWords(person)}</p>
                <div className="mt-auto">
                  <Button
                    small
                    disabled={busy || view.ended}
                    onClick={() =>
                      void send({ type: "people/court", with: person }).then((reply) => {
                        if (reply?.ok === true) setChosen(person);
                      })
                    }
                  >
                    {say("ui.people.court", { name: nameOf(person) })}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Sponsoring() {
  const { people } = useView();
  if (people.sponsoring === null && people.barUntilMonth === null) return null;
  return (
    <Card className="flex flex-col gap-1 text-sm" data-sponsoring>
      {people.sponsoring === null ? null : <p>{say("ui.people.sponsoring", { route: nameOf(people.sponsoring.route), month: monthEnding(people.sponsoring.month) })}</p>}
      {people.barUntilMonth === null ? null : <p className="text-bad">{say("ui.people.bar", { month: monthEnding(people.barUntilMonth) })}</p>}
    </Card>
  );
}

export function PeopleView() {
  const view = useView();
  const api = usePairApi();
  const { slots, bonds } = view.people;
  const byId = new Map(bonds.map((bond) => [bond.id, bond]));
  const players = bonds.filter((bond) => bond.label !== "computer" && bond.stage !== "ended").map((bond) => bond.id);
  const pairs = usePairs(api, players);
  const partnerSlot = slots.partner;
  const open = bonds.filter((bond) => bond.role === "partner" && bond.stage !== "ended");
  const ended = bonds.filter((bond) => bond.role === "partner" && bond.stage === "ended");
  const slotEmpty = partnerSlot !== undefined && partnerSlot.state === "empty" && !view.ended;
  const offerCandidates = !view.ended && (slotEmpty || view.people.candidates.length > 0);

  return (
    <>
      <Panel title={say("ui.people.title")}>
        <p className="flex items-start gap-2 text-sm text-muted">
          <Users size={16} className="mt-0.5 shrink-0" />
          {say("ui.people.intro")}
        </p>
        <ul className="flex flex-col gap-2">
          {slotOrder(Object.keys(slots)).map((key) => {
            const slot = slots[key];
            if (slot === undefined) return null;
            const bond = slot.bond === null ? null : (byId.get(slot.bond) ?? null);
            return <SlotCard key={key} slotKey={key} slot={slot} bond={bond} api={api} pair={bond === null ? null : (pairs.get(bond.id) ?? null)} />;
          })}
        </ul>
        <Sponsoring />
      </Panel>

      {offerCandidates ? (
        <Panel title={say("ui.people.slot.partner")}>
          <Candidates />
          {slotEmpty ? (
            <Card>
              <InviteMaker slot="partner" />
            </Card>
          ) : null}
        </Panel>
      ) : null}

      <Panel title={say("ui.people.bonds")}>
        {open.length === 0 ? (
          <Empty>{say("ui.people.see.how", { see: nameOf(SEE), call: nameOf(CALL) })}</Empty>
        ) : (
          <>
            <p className="text-sm text-muted">{say("ui.people.see.how", { see: nameOf(SEE), call: nameOf(CALL) })}</p>
            <ul className="flex flex-col gap-3">
              {open.map((bond) => (
                <BondCard key={bond.id} bond={bond} api={api} pair={pairs.get(bond.id) ?? null} />
              ))}
            </ul>
          </>
        )}
        {ended.length === 0 ? null : (
          <details className="rounded-xl border border-line bg-surface p-4" data-ended>
            <summary className="cursor-pointer font-semibold">
              {say("ui.people.ended.title")} <span className="font-normal text-muted">({ended.length})</span>
            </summary>
            <ul className="mt-3 flex flex-col gap-2">
              {ended.map((bond) => (
                <EndedBond key={bond.id} bond={bond} />
              ))}
            </ul>
          </details>
        )}
      </Panel>
    </>
  );
}
