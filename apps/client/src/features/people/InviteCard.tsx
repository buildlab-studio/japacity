// The invite card (R-PAIR-007, R-PAIR-008, R-PEOPLE-010): made from the fixed
// fills, shown as a friend will see it, and taken back with the same command.
// The card carries the character's name and japacity, never the account's,
// never a photo, a sum or a contact. Online it gets its single-use link.
import { content, text } from "@japacity/content";
import { INVITE_FILLS } from "@japacity/sim";
import { Link2, Send } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { rejectionWords } from "../../authority/store";
import { slotKind } from "../../shared/sim/people";
import { Button } from "../../shared/ui/Button";
import { nameOf, runningName, say, words } from "../../shared/words/text";
import type { PairApi } from "./pairApi";

type Looking = keyof typeof INVITE_FILLS;

function lookingFor(slot: string): Looking {
  return slotKind(slot) === "partner" ? "partner" : "sibling";
}

/** "Looking for: a partner who codes", from content's card words. */
export function lookingWords(looking: Looking, fill: string | null): string {
  const slot = text[`card.invite.slot.${looking}`] ?? looking;
  const filled = fill === null ? "" : (text[`card.invite.fill.${fill}`] ?? fill);
  return words("card.invite.looking", { slot, fill: filled }).trim();
}

/** The card as the friend will see it. */
function CardFace({ looking, fill }: { looking: Looking; fill: string | null }) {
  const view = useView();
  const { percent, route } = view.japacity;
  return (
    <figure className="flex flex-col gap-1 rounded-xl border-2 border-ink bg-paper p-4" data-invite-card>
      <p className="font-display text-xl">{nameOf(view.scenario)}</p>
      <p className="text-sm">
        {percent === null ? say("ui.people.invite.japacity-none") : say("ui.people.invite.japacity", { percent: `${String(percent)}%` })}
        {route === null ? null : <span className="text-muted">, {runningName(route)}</span>}
      </p>
      <p className="font-semibold">{lookingWords(looking, fill)}</p>
      <p className="text-xs text-muted">{text["card.invite.game"] ?? ""}</p>
    </figure>
  );
}

function Link({ api, slot }: { api: PairApi; slot: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const get = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const reply = await api.invite(slot);
      if (reply.ok) setLink(api.inviteLink(reply.code));
      else setFailed(say("ui.people.invite.failed", { why: rejectionWords(reply.code) }));
    } catch (error) {
      setFailed(say("ui.people.invite.failed", { why: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  };
  if (link !== null) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p className="break-all">{say("ui.people.invite.link", { link })}</p>
        <p className="text-muted">{say("ui.people.invite.link-days", { days: content.tuning.pair.inviteDays })}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div>
        <Button small disabled={busy} onClick={() => void get()}>
          <Link2 size={14} />
          {say("ui.people.invite.link-get")}
        </Button>
      </div>
      {failed === null ? null : (
        <p role="alert" className="text-sm text-bad">
          {failed}
        </p>
      )}
    </div>
  );
}

/**
 * An invite is an ask, so it shows only after the early win (R-GUIDE-015). It
 * reads the store's flag as features/notify/held.tsx does; a feature may not
 * import another feature, so the two lines live here until that moves to shared/.
 */
export function AfterEarlyWin({ children }: { children: ReactNode }) {
  return useGame((state) => state.earlyWin) ? children : null;
}

/** The card out on a slot: its face, its link online, and taking it back. */
export function InviteOut({ slot, invite, api }: { slot: string; invite: { looking: string; fill: string | null }; api: PairApi | null }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const looking = invite.looking === "sibling" ? "sibling" : "partner";
  return (
    <div className="flex flex-col gap-2" data-invite-out={slot}>
      <p className="text-sm font-medium">{say("ui.people.invite.out")}</p>
      <CardFace looking={looking} fill={invite.fill} />
      {api === null ? <p className="text-sm text-muted">{say("ui.people.invite.offline")}</p> : (
        <AfterEarlyWin>
          <Link api={api} slot={slot} />
        </AfterEarlyWin>
      )}
      <div>
        <Button small variant="quiet" disabled={busy} onClick={() => void send({ type: "people/invite", slot })}>
          {say("ui.people.invite.withdraw")}
        </Button>
      </div>
    </div>
  );
}

/** Making a card for an empty partner slot or a computer sibling (R-PEOPLE-010). */
export function InviteMaker({ slot }: { slot: string }) {
  const id = useId();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const ended = useView().ended;
  const looking = lookingFor(slot);
  const fills: readonly string[] = INVITE_FILLS[looking];
  const [fill, setFill] = useState<string>("");
  return (
    <form
      className="flex flex-col gap-2"
      aria-label={say("ui.people.invite.title")}
      onSubmit={(event) => {
        event.preventDefault();
        void send(fill === "" ? { type: "people/invite", slot, looking } : { type: "people/invite", slot, looking, fill });
      }}
    >
      <h4 className="font-semibold">{say("ui.people.invite.title")}</h4>
      <p className="text-sm text-muted">{say("ui.people.invite.intro")}</p>
      <label htmlFor={`${id}-fill`} className="text-sm font-medium">
        {say("ui.people.invite.fill")}
      </label>
      <select id={`${id}-fill`} value={fill} onChange={(event) => setFill(event.target.value)} className="min-h-11 rounded-lg border border-line bg-paper px-3">
        <option value="">{say("ui.people.invite.fill.none")}</option>
        {fills.map((value) => (
          <option key={value} value={value}>
            {text[`card.invite.fill.${value}`] ?? value}
          </option>
        ))}
      </select>
      <CardFace looking={looking} fill={fill === "" ? null : fill} />
      <div>
        <Button small type="submit" variant="primary" disabled={busy || ended}>
          <Send size={14} />
          {say("ui.people.invite.make")}
        </Button>
      </div>
    </form>
  );
}
