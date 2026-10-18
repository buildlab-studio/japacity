// The invite card (R-PAIR-007, R-PAIR-008, R-PEOPLE-010): made from the fixed
// fills, shown as a friend will see it, and taken back with the same command.
// The card carries the character's name and japacity, never the account's,
// never a photo, a sum or a contact. Online it gets its single-use link. Dressed as the lively layer's cards
// (docs/design/13-the-lively-layer.md section 2): a white card with the looking line as a sticker chip, the character's
// face sticker beside the maker's heading (never on the card, which carries no look to the friend), the pressed yellow
// button for the one action and a ghost button for taking the card back.
import { content, text } from "@japacity/content";
import { INVITE_FILLS } from "@japacity/sim";
import { Link2, Send } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { readPerson } from "../../authority/person";
import { rejectionWords } from "../../authority/store";
import { FaceSticker } from "../../shared/frontdoor/LookPicture";
import { lookForName, lookOf } from "../../shared/frontdoor/looks";
import { slotKind } from "../../shared/sim/person";
import { GhostButton } from "../../shared/ui/lively/GhostButton";
import { PressButton } from "../../shared/ui/lively/PressButton";
import { StickerChip } from "../../shared/ui/lively/StickerChip";
import { nameOf, runningName, say, words } from "../../shared/words/text";
import type { PairApi } from "./pairApi";
import { troubleWords } from "../../shared/words/trouble";

type Looking = keyof typeof INVITE_FILLS;

function lookingFor(slot: string): Looking {
  return slotKind(slot) === "partner" ? "partner" : "sibling";
}

/** "Looking for: a partner who codes", from content's card words. */
function lookingWords(looking: Looking, fill: string | null): string {
  const slot = text[`card.invite.slot.${looking}`] ?? looking;
  const filled = fill === null ? "" : (text[`card.invite.fill.${fill}`] ?? fill);
  return words("card.invite.looking", { slot, fill: filled }).trim();
}

/** The character's face on the card: the look built at the door where this device keeps it, else one picked from the name. */
function cardLook(name: string): string {
  const kept = readPerson()?.look;
  return kept !== undefined && lookOf(kept) !== null ? kept : lookForName(name);
}

/** The card as the friend will see it. */
function CardFace({ looking, fill }: { looking: Looking; fill: string | null }) {
  const view = useView();
  const { percent, route } = view.japacity;
  const name = nameOf(view.scenario);
  return (
    <figure className="lively-card flex flex-col gap-1.5 p-4" data-invite-card>
      <p className="text-[22px] leading-tight font-bold">{name}</p>
      <p className="text-[14px] leading-snug">
        {percent === null ? say("ui.people.invite.japacity-none") : say("ui.people.invite.japacity", { percent: `${String(percent)}%` })}
        {route === null ? null : <span className="text-text-2">, {runningName(route)}</span>}
      </p>
      <div>
        <StickerChip tint="people" tilt={-2} className="chip-wrap text-[14px] font-bold">
          <span data-invite-looking>{lookingWords(looking, fill)}</span>
        </StickerChip>
      </div>
      <p className="text-[12px] text-text-2">{text["card.invite.game"] ?? ""}</p>
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
      setFailed(troubleWords(error));
    } finally {
      setBusy(false);
    }
  };
  if (link !== null) {
    return (
      <div className="lively-card flex flex-col gap-1 p-3 text-[14px]" data-invite-link>
        <p className="break-all font-semibold">{say("ui.people.invite.link", { link })}</p>
        <p className="text-text-2">{say("ui.people.invite.link-days", { days: content.tuning.pair.inviteDays })}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <PressButton className="w-full" disabled={busy} onClick={() => void get()}>
        <Link2 size={16} aria-hidden />
        {say("ui.people.invite.link-get")}
      </PressButton>
      {failed === null ? null : (
        <p role="alert" className="text-[14px] text-bad">
          {failed}
        </p>
      )}
    </div>
  );
}

/**
 * An invite is an ask, so it shows only after the early win (R-GUIDE-015). It
 * reads the store's flag as features/notify/HeldShareCard.tsx does; a feature may not
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
    <div className="flex flex-col gap-2.5" data-invite-out={slot}>
      <CardFace looking={looking} fill={invite.fill} />
      {api === null ? <p className="text-[14px] text-text-2">{say("ui.people.invite.offline")}</p> : (
        <AfterEarlyWin>
          <Link api={api} slot={slot} />
        </AfterEarlyWin>
      )}
      <div>
        <GhostButton disabled={busy} onClick={() => void send({ type: "people/invite", slot })} data-invite-withdraw>
          {say("ui.people.invite.withdraw")}
        </GhostButton>
      </div>
    </div>
  );
}

/** Making a card for an empty partner slot or a computer sibling (R-PEOPLE-010). */
export function InviteMaker({ slot }: { slot: string }) {
  const id = useId();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const view = useView();
  const ended = view.ended;
  const looking = lookingFor(slot);
  const fills: readonly string[] = INVITE_FILLS[looking];
  const [fill, setFill] = useState<string>("");
  return (
    <form
      className="flex flex-col gap-2.5"
      aria-label={say("ui.people.invite.title")}
      onSubmit={(event) => {
        event.preventDefault();
        void send(fill === "" ? { type: "people/invite", slot, looking } : { type: "people/invite", slot, looking, fill });
      }}
    >
      <div className="flex items-center gap-3">
        <FaceSticker look={cardLook(nameOf(view.scenario))} size={48} tilt={-4} tint="people" />
        <h4 className="text-[22px] leading-tight font-bold">{say("ui.people.invite.title")}</h4>
      </div>
      <p className="text-[16px] leading-snug text-text-2">{say("ui.people.invite.intro")}</p>
      <label htmlFor={`${id}-fill`} className="text-[14px] font-bold">
        {say("ui.people.invite.fill")}
      </label>
      <select id={`${id}-fill`} value={fill} onChange={(event) => setFill(event.target.value)} className="lively-card min-h-12 px-3 text-[16px] font-semibold">
        <option value="">{say("ui.people.invite.fill.none")}</option>
        {fills.map((value) => (
          <option key={value} value={value}>
            {text[`card.invite.fill.${value}`] ?? value}
          </option>
        ))}
      </select>
      <CardFace looking={looking} fill={fill === "" ? null : fill} />
      <PressButton type="submit" className="w-full" disabled={busy || ended}>
        <Send size={16} aria-hidden />
        {say("ui.people.invite.make")}
      </PressButton>
    </form>
  );
}
