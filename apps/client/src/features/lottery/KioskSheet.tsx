// The street kiosk online (docs/rules/lottery.md R-LOTTERY-001; world.md R-WORLD-005, R-WORLD-006): while the world
// runs the Friday draw, a tap on the kiosk in the world opens this sheet in place of the offline slip. Its face holds
// the jackpot standing and whether it rolled over, the close counting down, the price and the cap, the tickets held,
// how many to buy, and one button that says the act and sends `lottery/buy`. The odds, the draw's seal and the last
// draw with its check fold behind a tap on a row. Built from the classic page's pieces (LotteryView.tsx).
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { cue } from "../../shared/sound/cues";
import { Rejection } from "../../shared/ui/Rejection";
import { formatMoney } from "../../shared/words/format";
import { earnedNaira } from "../../shared/words/lotto";
import { say, sayCount } from "../../shared/words/text";
import { Balance, CENTRED, pricedLabel } from "../../shared/world/Balance";
import { WorldSheet } from "../../shared/world/WorldSheet";
import { canBuy, chancesOf, salesClosed, serverDrawLoader, type LoadDraw, type Lottery } from "./draw";
import { DrawPage } from "./DrawPage";
import { LastDraw } from "./LastDraw";
import { Close, Count, Grows, Held, Jackpot, Odds, SealDetails, useClock } from "./LotteryView";

/** A row that says its name and one figure on a line that never wraps; what else there is folds behind a tap on it (R-WORLD-006). */
function Fold({ mark, name, figure, children }: { mark: string; name: string; figure: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-sheet-line" data-kiosk-fold={mark} data-open={open}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="press flex min-h-11 w-full items-center gap-2 text-left text-[14px]">
        <span className="min-w-0 flex-1 truncate font-bold">{name}</span>
        <span className="num shrink-0 whitespace-nowrap text-text-2">{figure}</span>
        <ChevronDown size={16} aria-hidden className={`shrink-0 text-text-2 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="flex flex-col gap-2 pb-3">{children}</div> : null}
    </div>
  );
}

/** The odds row's figure: the jackpot's chance, the first of the chances the kiosk says (R-LOTTERY-023). */
function oddsFigure(lottery: Lottery): string {
  const jackpot = chancesOf(lottery.odds, lottery.jackpot).find((chance) => chance.tier === "jackpot");
  if (jackpot === undefined) return "";
  return say(jackpot.exact ? "ui.lottery.kiosk.row.odds-figure" : "ui.lottery.kiosk.row.odds-figure-about", { every: jackpot.every });
}

/** The last draw, and its public check worked out on the device under it once asked for (R-LOTTERY-015). */
function Last({ lottery, load }: { lottery: Lottery; load: LoadDraw | null }) {
  const [checking, setChecking] = useState(false);
  const last = lottery.last;
  if (last === null) return null;
  return (
    <Fold mark="last" name={say("ui.lottery.last")} figure={say("ui.lottery.draw", { draw: last.draw })}>
      <LastDraw result={last} onCheck={load === null || checking ? null : () => setChecking(true)} />
      {load !== null && checking ? <DrawPage draw={last.draw} load={load} /> : null}
    </Fold>
  );
}

/** Why the button is shut, said once on the sheet (R-WORLD-006): sales closed, or the most tickets a draw allows held. */
function shutBy(lottery: Lottery, closed: boolean): string | null {
  if (closed) return say("ui.lottery.closed-buy");
  if (lottery.tickets >= lottery.maxTickets) return say("ui.lottery.full");
  return null;
}

export interface KioskSheetProps {
  open: boolean;
  onClose: () => void;
  /** The small line over the title: the place the kiosk stands in. */
  label: string;
  /** Fetches a draw for its check; by default from the server the build names. */
  load?: LoadDraw | null;
}

/** The kiosk's sheet while the world runs the Friday draw; nothing while it does not (the offline slip stands then). */
export function KioskSheet({ open, onClose, label, load }: KioskSheetProps) {
  const view = useView();
  const { lottery, pockets } = view;
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const clock = useClock();
  const [loader] = useState(() => (load === undefined ? serverDrawLoader() : load));
  const [wanted, setWanted] = useState(1);
  if (lottery === null) return null;

  const bank = pockets.NGN.bank;
  // The band's naira, bank and cash together, before and after the tickets (R-WORLD-006); the tickets come out of the bank.
  const held = pockets.NGN.bank + pockets.NGN.cash;
  // R-WALLET-020, R-LOTTERY-018: tickets are paid from the bank, and only from naira earned in the game.
  const most = canBuy(lottery, Math.min(bank, earnedNaira(view)));
  const count = Math.min(Math.max(1, wanted), Math.max(1, most));
  const cost = count * lottery.ticket;
  const shut = shutBy(lottery, salesClosed(lottery, clock)) ?? (most === 0 && canBuy(lottery, bank) > 0 ? say("ui.lottery.earned-only") : null);
  const short = shut === null && most === 0 ? lottery.ticket - bank : null;
  const buy = (): void => {
    void send({ type: "lottery/buy", tickets: count }).then((reply) => {
      cue(reply?.ok === true ? "coin" : "tap");
      if (reply?.ok === true) setWanted(1);
    });
  };

  const button =
    shut !== null ? (
      <button type="button" className="btn-main" disabled data-kiosk-buy data-short="true">
        <span className="leading-tight">{say("ui.needs.not-yet")}</span>
      </button>
    ) : (
      <>
        {/* R-WORLD-006: the button says the act and its price; under it the balance before, struck, and after. Short, it says how much. */}
        <button type="button" className="btn-main" style={short === null ? CENTRED : undefined} onClick={buy} disabled={busy || short !== null} data-kiosk-buy={count} data-short={short === null ? undefined : "true"}>
          <span className="leading-tight">{pricedLabel(sayCount("ui.lottery.kiosk.buy", count, { count }), formatMoney(cost, "NGN"))}</span>
          {short === null ? null : <span className="text-[13px] leading-snug font-semibold opacity-80">{say("ui.world.short", { amount: formatMoney(short, "NGN") })}</span>}
        </button>
        {short === null ? <Balance className="mt-2.5 justify-center" before={{ amount: held, words: formatMoney(held, "NGN") }} after={{ amount: held - cost, words: formatMoney(held - cost, "NGN") }} /> : null}
      </>
    );

  return (
    <WorldSheet open={open} onClose={onClose} label={label} title={say("ui.lottery.title")} mark="kiosk" foot={button}>
      <div className="flex flex-col gap-4" data-kiosk={lottery.draw}>
        <Jackpot lottery={lottery} grows={false} />
        <Close lottery={lottery} />
        <div className="flex flex-col gap-2">
          <p className="text-sm">{say("ui.lottery.price", { price: formatMoney(lottery.ticket, "NGN"), max: lottery.maxTickets })}</p>
          <Held lottery={lottery} />
        </div>
        <Rejection />
        {shut !== null ? (
          <p className="text-sm text-text-2" data-kiosk-shut>
            {shut}
          </p>
        ) : short !== null ? (
          <p className="text-sm text-text-2" data-kiosk-shut>
            {say("ui.lottery.short", { bank: formatMoney(bank, "NGN") })}
          </p>
        ) : (
          <div className="flex flex-col items-start gap-1.5">
            <Count count={count} most={most} onCount={setWanted} />
            <p className="text-xs text-text-2">{say("ui.lottery.from-bank", { bank: formatMoney(bank, "NGN") })}</p>
          </div>
        )}
        <div className="flex flex-col">
          <Fold mark="odds" name={say("ui.lottery.kiosk.row.odds")} figure={oddsFigure(lottery)}>
            <Odds lottery={lottery} />
            <Grows lottery={lottery} />
          </Fold>
          <Fold mark="seal" name={say("ui.lottery.kiosk.row.seal")} figure={`${lottery.fingerprint.slice(0, 8)}...`}>
            <SealDetails lottery={lottery} />
          </Fold>
          <Last lottery={lottery} load={loader} />
        </div>
      </div>
    </WorldSheet>
  );
}
