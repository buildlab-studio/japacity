// The phone's home card (docs/rules/home.md R-HOME-007), at the top of Bills. The engine decides (R-HOME-002) and
// the view carries each move with its charge a month and why it is shut (R-HOME-008); the card only says them.
import type { HomeMoveShut, HomePlace, PlayerView } from "@japacity/sim";

import { useView } from "../../../authority/GameProvider";
import { formatMoney } from "../../../shared/words/format";
import { blurbOf, forMonths, hasWords, nameOf, sayCount } from "../../../shared/words/text";
import { useAsk } from "../act";
import { phoneWords } from "../phone.words";
import { PicTile } from "../ui";

const MAKOKO: HomePlace = "place.makoko";
const COMPOUND: HomePlace = "place.compound-room";

export interface HomeMove {
  to: HomePlace;
  /** What it costs a month there, in naira. */
  monthly: number;
  /** What is paid on the move: the first month's rent in Makoko, the year's rent and fees for the room in a compound (R-HOME-010), nothing at the family house. */
  now: number;
  /** Why it is shut, in words, or null when it may be made. */
  shut: string | null;
}

/** Why a move is shut, in words: the view says which (R-HOME-008). Short of the room's year and fees says so, not a month's rent. */
function shutWords(shut: HomeMoveShut, now: number, to: HomePlace): string {
  switch (shut) {
    case "moved":
      return phoneWords("phone.home.shut.moved");
    case "short":
      return phoneWords(to === COMPOUND ? `phone.home.shut.short.${to}` : "phone.home.shut.short", { amount: { currency: "NGN", amount: now } });
    default: {
      const never: never = shut;
      return never;
    }
  }
}

/** The moves the card offers, as the view carries them: every home but the one lived in, each with its reason when shut. */
export function homeMoves(view: Pick<PlayerView, "home">): HomeMove[] {
  return view.home.moves.map((move) => ({ to: move.to, monthly: move.monthly.amount, now: move.now, shut: move.shut === null ? null : shutWords(move.shut, move.now, move.to) }));
}

/**
 * The month's charge where the character lives, said as what it is: Makoko's is the
 * room's rent; the family house's and the room's are living costs, food and light, never rent.
 */
export function chargeWords(home: PlayerView["home"]): string {
  if (home.rent === null) return phoneWords("phone.home.charge.none");
  // R-HOME-012 (decision 0035): nothing of the living is charged as the month turns, so no figure a month is said for it;
  // the family house says it as your share for the house (decision 0040).
  if (home.rent.amount === 0) {
    const byHand = home.place === null ? null : `phone.home.charge.by-hand.${home.place}`;
    return phoneWords(byHand !== null && hasWords(byHand) ? byHand : "phone.home.charge.by-hand");
  }
  const own = home.place === null ? null : `phone.home.charge.${home.place}`;
  return phoneWords(own !== null && hasWords(own) ? own : "phone.home.charge", { amount: home.rent });
}

/** R-HOME-010: the room's yearly rent and when it is next taken, or null where none is open. */
export function roomRentWords(home: PlayerView["home"]): string | null {
  if (home.roomRent === null) return null;
  return sayCount("phone.home.rent-year", home.roomRent.dueIn, { amount: formatMoney(home.roomRent.year, "NGN"), count: home.roomRent.dueIn });
}

/**
 * The move's line: from the room, the move back says the year paid stays with the landlord (R-HOME-010). Where
 * living there charges nothing a month (R-HOME-012, decision 0035), the line says it is bought as
 * you go and names no figure a month.
 */
export function moveLineKey(from: HomePlace | null, to: HomePlace, monthly: number): string {
  const tail = monthly === 0 ? ".by-hand" : "";
  const own = from === null ? null : `phone.home.move.line.from.${from}.${to}${tail}`;
  return own !== null && hasWords(own) ? own : `phone.home.move.line.${to}${tail}`;
}

/** Who took the character in, as words: a friend by the words for one, someone of the story by name. */
function hostWords(guest: NonNullable<PlayerView["home"]["guest"]>): string {
  if (guest.host === "friend" || guest.by === null) return nameOf("home.friend");
  return nameOf(guest.by);
}

export function HomeCard() {
  const view = useView();
  const { open, sheet } = useAsk();
  if (view.place.where !== "home" || view.ended) return null;
  const { home } = view;
  const moves = homeMoves(view);
  const ask = (move: HomeMove) =>
    open({
      form: "card",
      icon: "house",
      who: phoneWords("phone.home.title"),
      title: phoneWords(`phone.home.move.${move.to}`),
      line: phoneWords(moveLineKey(home.place, move.to, move.monthly), { amount: { currency: "NGN", amount: move.monthly }, now: { currency: "NGN", amount: move.now } }),
      cost: move.now > 0 ? { amount: move.now, currency: "NGN" } : null,
      button: phoneWords("phone.home.move.button"),
      have: view.pockets.NGN.cash + view.pockets.NGN.bank,
      when: "now",
      command: { type: "home/move", to: move.to },
      done: phoneWords("phone.home.moved"),
    });

  return (
    <section className="lively-card mb-3 p-3.5" data-home-card data-home-place={home.place ?? "none"} aria-label={phoneWords("phone.home.title")}>
      {/* Where you live as the after set's phone-bills draws it: the home's picture, its name, what it costs as a chip, its
          line; then the other homes as picture tiles, each with its move and what is paid on it. */}
      <div className="flex items-start gap-3">
        {home.place === null ? null : <PicTile of={home.place} size={60} tint="plain" />}
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-text-2">{phoneWords("phone.home.title")}</h3>
          <p className="text-[19px] leading-tight font-bold">{home.place === null ? phoneWords("phone.home.none") : phoneWords(`phone.home.place.${home.place}`)}</p>
          {/* R-HOME-008: the card opens with what the home is, the place's own blurb. */}
          {home.place === null || blurbOf(home.place) === null ? null : (
            <p className="mt-0.5 text-[14px] leading-snug text-text-2" data-home-blurb>
              {blurbOf(home.place)}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-col items-start gap-1.5">
        {home.guest === null ? null : (
          <p className="text-[14px]" data-home-guest>
            {phoneWords("phone.home.guest", { who: hostWords(home.guest), until: forMonths(home.guest.until, view.month) })}
          </p>
        )}
        {home.roomRent === null ? null : (
          <span className="sticker-chip num bg-[var(--soft)] chip-wrap" style={{ rotate: "-1.5deg", color: "var(--soft-ink)" }} data-home-rent-year={home.roomRent.dueIn}>
            {roomRentWords(home)}
          </span>
        )}
        <span className="sticker-chip num bg-sheet-muted chip-wrap" style={{ rotate: "1deg" }} data-home-charge>
          {chargeWords(home)}
        </span>
        {home.place === MAKOKO ? (
          <p className="text-[13px] text-text-2" data-home-risk>
            {phoneWords("phone.home.risk")}
          </p>
        ) : null}
      </div>
      {moves.length === 0 ? null : (
        // One move a row, its picture beside a button as wide as the row: in a two-column grid the ghost button's own size
        // and padding break "Take a hostel room in Yaba" over four short lines, and an odd move stands alone in a wide
        // row. A row keeps the words to one or two lines and every row the same width.
        <ul className="mt-3 flex flex-col gap-2" data-home-moves>
          {moves.map((move) => (
            <li key={move.to} className="flex items-center gap-2.5 rounded-[16px] bg-tint-plain p-2" data-home-move-row={move.to}>
              <PicTile of={move.to} size={52} tint="plain" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-center">
              <button type="button" onClick={() => ask(move)} disabled={move.shut !== null} className="phone-ghost press min-h-11 w-full flex-col justify-center gap-0.5 py-1.5 leading-tight" data-home-move={move.to}>
                <span>{phoneWords(`phone.home.move.${move.to}`)}</span>
                {move.now > 0 ? (
                  <>
                    <span className="sr-only">: </span>
                    <span className="num text-[13px] text-text-2">{formatMoney(move.now, "NGN")}</span>
                  </>
                ) : null}
              </button>
              {/* The risk is said once, plainly, beside the move it belongs to (R-HOME-007), not under the family house. */}
              {move.to === MAKOKO ? (
                <p className="text-[12px] text-text-2" data-home-risk>
                  {phoneWords("phone.home.risk")}
                </p>
              ) : null}
              {move.shut === null ? null : (
                <p className="text-[12px] text-text-2" data-home-shut={move.to}>
                  {move.shut}
                </p>
              )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {sheet}
    </section>
  );
}
