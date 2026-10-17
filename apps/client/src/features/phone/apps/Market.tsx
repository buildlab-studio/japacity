// The Market (docs/rules/home.md R-HOME-013): the things for the home as a grid of
// sticker tiles of the very models that land in the room, each with one line of what it does and its price on the
// yellow pill. A card picked is ringed; the foot says the balance before struck through and after, and one yellow button
// buys it: "Delivered at once: a rider at the gate, a slip", the coin, and the thing stands in the room when the phone
// closes. What is owned says so and sells back at its resale figure. Only at home: away from it the rider waits, and
// abroad the market is a Lagos thing. What may be bought and why not is the view's (`view.things.market`), never a copy.
import type { Id, PlayerView } from "@japacity/sim";
import { use, useEffect, useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { cue } from "../../../shared/sound/cues";
import { marketTile } from "../../../shared/tiles/tiles.data";
import { PressButton } from "../../../shared/ui/lively/PressButton";
import { formatMoney } from "../../../shared/words/format";
import { nameOf } from "../../../shared/words/text";
import { Balance } from "../../../shared/world/Balance";
import { PhoneSaid } from "../act";
import { phoneWords } from "../phone.words";
import { GhostButton, PicTile, WordChip } from "../ui";

/** How long the delivery's toast stands, in ms. */
const DELIVERY_MS = 3000;

type Offer = PlayerView["things"]["market"][number];
type Owned = PlayerView["things"]["owned"][number];

const naira = (amount: number): string => formatMoney(amount, "NGN");

/** Why a card cannot be bought, in a few words, or null when it can (or is owned, which says so itself). */
function shutWords(offer: Offer, view: Pick<PlayerView, "home">): string | null {
  switch (offer.shut) {
    case "home":
      return phoneWords(view.home.place === "place.family-house" ? "phone.market.shut.family" : "phone.market.shut.home");
    case "needs":
      return phoneWords("phone.market.shut.needs");
    case "away":
    case "owned":
    case "short":
    case null:
      return null;
    default: {
      const never: never = offer.shut;
      return String(never);
    }
  }
}

export function Market({ here = null }: { here?: string | null }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const said = use(PhoneSaid);
  const [picked, setPicked] = useState<Id<"thing"> | null>(null);
  const [shaking, setShaking] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<{ thing: Id<"thing">; at: number } | null>(null);
  useEffect(() => {
    if (delivered === null) return;
    const timer = window.setTimeout(() => setDelivered(null), DELIVERY_MS);
    return () => window.clearTimeout(timer);
  }, [delivered]);

  if (view.place.where !== "home") {
    return (
      <div data-phone-app="market" className="flex flex-col gap-2">
        <div className="lively-card flex items-center gap-3 p-3" data-market-abroad>
          <PicTile of={marketTile("thing.fan")} size={56} />
          <p className="min-w-0 flex-1 text-[15px] leading-snug">{phoneWords("phone.market.abroad")}</p>
        </div>
      </div>
    );
  }

  const atHome = view.home.place !== null && here === view.home.place;
  const held = view.pockets.NGN.cash + view.pockets.NGN.bank;
  const owned = new Map<string, Owned>(view.things.owned.map((one) => [one.thing, one]));
  // What may be bought here first, then what is owned, then what waits on a need or has no place here, each in the
  // catalogue's order.
  const rank = (offer: Offer): number => (offer.shut === null || offer.shut === "short" || offer.shut === "away" ? 0 : offer.shut === "owned" ? 1 : offer.shut === "needs" ? 2 : 3);
  const offers = [...view.things.market].sort((a, b) => rank(a) - rank(b));
  const chosen = offers.find((offer) => offer.thing === picked) ?? null;
  const mine = chosen === null ? undefined : owned.get(chosen.thing);

  const refuse = (thing: string): void => {
    cue("no");
    setShaking(thing);
    window.setTimeout(() => setShaking((was) => (was === thing ? null : was)), 320);
  };
  const pick = (offer: Offer): void => {
    if (!atHome || offer.shut === "home" || offer.shut === "needs") {
      refuse(offer.thing);
      return;
    }
    cue("tap");
    setPicked(offer.thing);
  };
  const buy = (offer: Offer): void => {
    void send({ type: "thing/buy", thing: offer.thing }).then((reply) => {
      if (reply?.ok !== true) {
        refuse(offer.thing);
        return;
      }
      cue("coin");
      setPicked(null);
      setDelivered({ thing: offer.thing, at: Date.now() });
    });
  };
  const sell = (offer: Offer, one: Owned): void => {
    void send({ type: "thing/sell", thing: offer.thing }).then((reply) => {
      if (reply?.ok !== true) return;
      cue("coin");
      setPicked(null);
      said(phoneWords("phone.market.sold", { thing: nameOf(offer.thing), amount: naira(one.resale) }));
    });
  };

  return (
    <div data-phone-app="market" className="flex flex-col gap-2">
      {delivered === null ? null : (
        <div key={delivered.at} className="brief-toast slide-in sticky top-0 z-[1] flex items-center gap-3 p-2.5 pr-3" role="status" data-market-delivered={delivered.thing}>
          <PicTile of={marketTile(delivered.thing)} size={44} tint="money" />
          <span className="min-w-0 flex-1 text-[15px] leading-snug font-bold">{phoneWords("phone.market.delivered")}</span>
        </div>
      )}
      <p className="px-0.5 text-[15px] text-text-2" data-market-line>
        {phoneWords(atHome ? "phone.market.line" : "phone.market.away")}
      </p>
      <ul className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={phoneWords("phone.app.market")} data-market-grid>
        {offers.map((offer) => {
          const one = owned.get(offer.thing);
          const shut = shutWords(offer, view);
          const on = offer.thing === picked;
          return (
            <li key={offer.thing}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pick(offer)}
                data-market-thing={offer.thing}
                data-shut={offer.shut ?? undefined}
                className={`lively-card press flex h-full w-full flex-col items-start gap-1 p-2.5 text-left ${on ? "phone-picked" : ""} ${shut !== null || !atHome ? "opacity-60" : ""} ${shaking === offer.thing ? "shake" : ""}`}
              >
                <span className="flex w-full justify-center">
                  <PicTile of={marketTile(offer.thing)} size={84} tilt={on ? -7 : -4} />
                </span>
                <span className="text-[16px] leading-tight font-bold">{nameOf(offer.thing)}</span>
                <span className="text-[13px] leading-snug text-text-2">{phoneWords(`${offer.thing}.line`)}</span>
                {/* The price stands last in every tile, the running cost over it, so the tiles of a row end at one height
                    with their prices in line, never one lifted by a running chip under it. */}
                <span className="mt-auto flex flex-col items-start gap-1.5 pt-1" data-market-foot-of={offer.thing}>
                  {offer.running > 0 && one === undefined && shut === null ? <WordChip tone="plain" data-market-running>{phoneWords("phone.market.running", { amount: naira(offer.running) })}</WordChip> : null}
                  {one !== undefined ? (
                    <WordChip tone="soft" data-market-owned={offer.thing}>
                      {phoneWords(one.stored ? "phone.market.stored" : "phone.market.owned")}
                    </WordChip>
                  ) : shut !== null ? (
                    <WordChip tone="plain">{shut}</WordChip>
                  ) : (
                    <span className="ask-price num" data-market-price={offer.price}>
                      {naira(offer.price)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {chosen === null || !atHome ? null : (
        <div className="sticky bottom-0 flex flex-col items-center gap-2 bg-sheet pt-2 pb-1" data-market-foot>
          {mine !== undefined ? (
            <>
              <Balance className="justify-center text-[13px]" before={{ amount: held, words: naira(held) }} after={{ amount: held + mine.resale, words: naira(held + mine.resale) }} />
              <GhostButton wide onClick={() => sell(chosen, mine)} data-market-sell={chosen.thing}>
                {phoneWords("phone.market.sell", { amount: naira(mine.resale) })}
              </GhostButton>
            </>
          ) : (
            <>
              {chosen.shut === "short" ? null : <Balance className="justify-center text-[13px]" before={{ amount: held, words: naira(held) }} after={{ amount: held - chosen.price, words: naira(held - chosen.price) }} />}
              <PressButton className="w-full flex-col gap-0" disabled={chosen.shut !== null} onClick={() => buy(chosen)} data-market-buy={chosen.thing}>
                <span className="flex items-center gap-1.5">
                  <span>{phoneWords("phone.market.buy")}</span>
                  <span aria-hidden>·</span>
                  <span className="min-w-0 truncate">{nameOf(chosen.thing)}</span>
                </span>
                {chosen.shut === "short" ? <span className="text-[13px] font-semibold opacity-80">{phoneWords("phone.market.short", { amount: naira(chosen.price - held) })}</span> : null}
              </PressButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}
