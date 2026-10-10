// The phone's home card (docs/rules/home.md R-HOME-007), at the top of Bills. The engine still decides
// (R-HOME-002); the card only mirrors what it would refuse.
import { content } from "@japacity/content";
import type { HomePlace, PlayerView } from "@japacity/sim";
import { House } from "lucide-react";

import { useView } from "../../../authority/GameProvider";
import { formatMoney } from "../../../shared/words/format";
import { forMonths, nameOf } from "../../../shared/words/text";
import { useAsk } from "../act";
import { phoneWords } from "../phone.words";

const FAMILY_HOUSE: HomePlace = "place.family-house";
const MAKOKO: HomePlace = "place.makoko";
const HOMES: readonly HomePlace[] = [FAMILY_HOUSE, MAKOKO];

export interface HomeMove {
  to: HomePlace;
  /** What it costs a month there, in naira. */
  monthly: number;
  /** What is paid on the move: the first month's rent in Makoko, nothing at the family house. */
  now: number;
  /** Why it is shut, in words, or null when it may be made. */
  shut: string | null;
}

/** The family's own charge a month, from the starting life (R-HOME-002, as R-PLACE-007). */
function familyCharge(view: Pick<PlayerView, "scenario">): number {
  const owed = content.scenario[view.scenario]?.obligations ?? [];
  return owed.filter((entry) => content.obligation[entry.obligation]?.type === "upkeep").reduce((sum, entry) => sum + entry.amount, 0);
}

/** The moves the card offers: every home but the one lived in, each with its reason when shut. */
export function homeMoves(view: Pick<PlayerView, "home" | "month" | "pockets" | "scenario">): HomeMove[] {
  const rent = content.tuning.home.makokoUpkeep;
  const held = view.pockets.NGN.cash + view.pockets.NGN.bank;
  return HOMES.filter((to) => to !== view.home.place).map((to) => {
    const now = to === MAKOKO ? rent : 0;
    let shut: string | null = null;
    if (view.home.moved === view.month) shut = phoneWords("phone.home.shut.moved");
    else if (held < now) shut = phoneWords("phone.home.shut.short", { amount: { currency: "NGN", amount: now } });
    return { to, monthly: to === MAKOKO ? rent : familyCharge(view), now, shut };
  });
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
      line: phoneWords(`phone.home.move.line.${move.to}`, { amount: { currency: "NGN", amount: move.monthly } }),
      cost: move.now > 0 ? { amount: move.now, currency: "NGN" } : null,
      button: phoneWords("phone.home.move.button"),
      have: view.pockets.NGN.cash + view.pockets.NGN.bank,
      when: "now",
      command: { type: "home/move", to: move.to },
      done: phoneWords("phone.home.moved"),
    });

  return (
    <section className="mb-3 rounded-[6px] bg-sheet-2 p-3 shadow-[0_2px_0_var(--sheet-line)]" data-home-card data-home-place={home.place ?? "none"} aria-label={phoneWords("phone.home.title")}>
      <div className="flex items-start gap-2.5">
        <House size={18} className="mt-0.5 shrink-0 text-text-2" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="label text-text-2">{phoneWords("phone.home.title")}</h3>
          <p className="text-[15px] font-bold">{home.place === null ? phoneWords("phone.home.none") : phoneWords(`phone.home.place.${home.place}`)}</p>
          {home.guest === null ? null : (
            <p className="text-[14px]" data-home-guest>
              {phoneWords("phone.home.guest", { who: hostWords(home.guest), until: forMonths(home.guest.until, view.month) })}
            </p>
          )}
          <p className="num text-[14px] text-text-2" data-home-charge>
            {home.rent === null ? phoneWords("phone.home.charge.none") : phoneWords("phone.home.charge", { amount: home.rent })}
          </p>
          {home.place === MAKOKO ? (
            <p className="mt-1 text-[13px] text-text-2" data-home-risk>
              {phoneWords("phone.home.risk")}
            </p>
          ) : null}
        </div>
      </div>
      {moves.map((move) => (
        <div key={move.to} className="mt-2">
          <button type="button" onClick={() => ask(move)} disabled={move.shut !== null} className="btn-dark press w-full py-2.5 text-[14px] disabled:opacity-50" data-home-move={move.to}>
            {phoneWords(`phone.home.move.${move.to}`)}
            {move.now > 0 ? `: ${formatMoney(move.now, "NGN")}` : ""}
          </button>
          {/* The risk is said once, plainly, beside the move it belongs to (R-HOME-007), not under the family house. */}
          {move.to === MAKOKO ? (
            <p className="mt-1 text-[13px] text-text-2" data-home-risk>
              {phoneWords("phone.home.risk")}
            </p>
          ) : null}
          {move.shut === null ? null : (
            <p className="mt-1 text-[13px] text-text-2" data-home-shut={move.to}>
              {move.shut}
            </p>
          )}
        </div>
      ))}
      {sheet}
    </section>
  );
}
