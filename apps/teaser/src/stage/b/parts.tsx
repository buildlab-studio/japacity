// The second cut's pieces of the game, copied from the client (apps/client/src) as the first cut's are, since the game's
// own components read its stores: the act's card on its sheet with the act's verb on its button (shared/world/AskSheet),
// the toast an act leaves with its waiting tag (shared/world/SaidToast), the brief the Japa app carries with the thing
// the years before met first (features/city/brief/BriefLog), and the month's payday card (features/turn/Results).
import { Check, Clock, Settings } from "lucide-react";
import type { ReactNode } from "react";

import { Face, SheetClose, Sticker, type Dot } from "../parts";
import { W } from "../words";

/** The brief's things as this life meets them: its words, the place under it, its picture, and whether it is in. */
export interface Item {
  readonly words: string;
  readonly place: string;
  readonly tile: string | null;
  readonly met: boolean;
  readonly now: boolean;
}

/** The brief's dots from its things: green for a thing in, yellow for the one to do, pale for the rest. */
export function dotsOf(items: readonly Item[]): Dot[] {
  return items.map((item) => (item.met ? "done" : item.now ? "now" : "later"));
}

/** A tile cut as a sticker, or the compass the game stands in where it has no model. */
function ItemPicture({ tile, size }: { tile: string | null; size: number }) {
  if (tile !== null) return <Sticker tile={tile} size={size} tilt={-4} />;
  return <span className="drawn-pic sticker-cut" data-pic="🧭" style={{ width: size, height: size, fontSize: Math.round(size * 0.8) }} aria-hidden />;
}

/**
 * The act's card on its sheet (world:one-action-one-sheet): the handle, the corner's icon, where and the act's title, its
 * line, its facts (the pay, the chance, how long it takes), and the one yellow button with the act's verb and when it answers.
 */
export function ActCard({ target, down }: { target: string; down: boolean }) {
  return (
    <div className="act-card" {...(down ? { "data-down": "" } : {})}>
      <span className="sheet-grab" />
      <div className="act-head">
        <span className="act-icon" aria-hidden>
          <Settings size={22} strokeWidth={2} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="act-who">{W.makoko}</div>
          <div className="act-title">{W.racksAct}</div>
        </div>
        <SheetClose />
      </div>
      <div className="act-body">
        <p className="act-line">{W.racksBlurb}</p>
        <div className="act-takes">
          <span style={{ fontSize: 14, fontWeight: 700 }}>{W.racksPay}</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{W.certain}</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{W.aDay}</span>
        </div>
        <span className="press-button act-main" data-target={target}>
          <span>{W.startWork}</span>
          <span className="act-when">{W.actNow}</span>
        </span>
      </div>
    </div>
  );
}

/** The toast an act leaves under the band: its picture, its name, and the tag that says when it answers. */
export function ActToast() {
  return (
    <div className="brief-toast" role="status" style={{ paddingTop: 10, paddingBottom: 10 }}>
      <span className="brief-toast-pic">
        <Sticker tile="prop_jobs-board" size={34} tilt={-5} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.3, fontWeight: 700 }}>{W.hunt}</p>
        <span className="state-tag">
          <span className="state-mark" aria-hidden>
            <Clock size={10} strokeWidth={3} />
          </span>
          {W.monthEnd}
        </span>
      </div>
    </div>
  );
}

/** The payday card the month's results lead with: the job's picture on the money tint, what it is, and the figure in green. */
export function PaydayCard({ amount }: { amount: string }) {
  return (
    <div className="look-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
      <span className="tint-money" style={{ display: "flex", width: 64, height: 64, flex: "none", alignItems: "center", justifyContent: "center", borderRadius: 14 }}>
        <Sticker tile="prop_fish-racks" size={48} tilt={-5} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 15, lineHeight: 1.3, fontWeight: 700 }}>{W.salaryRacks}</span>
        <span className="jc-num" style={{ display: "block", fontSize: 22, color: "var(--in)" }}>
          {amount}
        </span>
      </span>
    </div>
  );
}

/** One thing of the carried brief as a row: its picture, its words, the place under it, and the tick once it is in. */
function ItemRow({ item }: { item: Item }) {
  const state = item.met ? "done" : item.now ? "now" : "later";
  return (
    <li className="brief-row" data-state={state}>
      <span className="brief-row-pic">
        <ItemPicture tile={item.tile} size={26} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="brief-row-words">{item.words}</span>
        <span className="brief-row-place">
          {item.now ? (
            <>
              <b style={{ color: "var(--soft-ink)" }}>{W.briefNow}</b> · {item.place}
            </>
          ) : (
            item.place
          )}
        </span>
      </span>
      {item.met ? (
        <span className="brief-tick" aria-hidden>
          <Check size={14} strokeWidth={3.2} />
        </span>
      ) : null}
    </li>
  );
}

/** The brief the Japa app carries: its picture, title, giver and dots, the giver's words, and each thing in its row. */
export function CarriedBrief({ items, tile, dots }: { items: readonly Item[]; tile: string; dots: ReactNode }) {
  return (
    <div className="look-card carried">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="carried-pic">
          <Sticker tile={tile} size={40} tilt={-6} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 18, lineHeight: 1.2, fontWeight: 700 }}>{W.brief}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <Face name={W.giver} size={13} />
            {dots}
          </div>
        </div>
        <span className="sticker-chip tint-soft" style={{ rotate: "3deg", alignSelf: "flex-start" }}>
          {W.carrying}
        </span>
      </div>
      <p className="carried-line">“{W.openWater}”</p>
      <ul className="brief-rows">
        {items.map((item) => (
          <ItemRow key={item.words} item={item} />
        ))}
      </ul>
    </div>
  );
}
