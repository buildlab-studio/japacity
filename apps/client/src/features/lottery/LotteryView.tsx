// The Friday draw's kiosk, online only (docs/rules/lottery.md R-LOTTERY-003,
// 006, 012, 023): the jackpot standing and whether it rolled over, the odds in
// plain words, the price and the cap, the character's tickets, the close as a
// real time counting down, the fingerprint and the public round, and the last
// draw with a way to check it.
// Offline `World.lottery` is null, the view's `lottery` with it, and the
// luck kiosk among the month's activities plays instead (R-LOTTERY-001).
// The world's street kiosk's sheet (KioskSheet.tsx) is built from the pieces
// exported here.
import { Minus, Plus, ShieldCheck, Ticket } from "lucide-react";
import { useEffect, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Panel, Tag } from "../../shared/ui/Panel";
import { Rejection } from "../../shared/ui/Rejection";
import { Sheet } from "../../shared/ui/Sheet";
import { formatBp, formatMoney, formatNumber } from "../../shared/words/format";
import { say, sayCount } from "../../shared/words/text";
import { Chances } from "./Chances";
import { canBuy, closesAt, salesClosed, serverDrawLoader, type LoadDraw, type Lottery } from "./draw";
import { closeWords, waitWords } from "./when";
import { DrawPage } from "./DrawPage";
import { LastDraw } from "./LastDraw";

const SECOND_MS = 1000;

/** The time on the device, once a second, while there is a close to count to. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}

/** The server's clock: from the last reply, or from the world fetch. */
export function useClock(): { tick: number; nextTickAt: number } | null {
  const clock = useGame((state) => state.clock);
  const world = useGame((state) => state.world);
  if (clock !== null) return clock;
  return world === null ? null : { tick: world.tick, nextTickAt: world.nextTickAt };
}

/** R-LOTTERY-002, R-LOTTERY-006: the close as a real time, counting down. */
export function Close({ lottery }: { lottery: Lottery }) {
  const at = closesAt(lottery, useClock());
  const now = useNow(at !== null);
  if (at === null) return null;
  const open = now < at;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm" data-lottery-close={at}>
      <span className="font-medium">{say("ui.lottery.closes", { when: closeWords(at) })}</span>
      <span className="text-text-2 tabular-nums">{open ? say("ui.lottery.closes-in", { wait: waitWords(at - now) }) : say("ui.lottery.closed")}</span>
    </p>
  );
}

/** How the jackpot grows while nobody wins it, and its cap (R-LOTTERY-012); nothing when it does not grow. */
export function Grows({ lottery }: { lottery: Lottery }) {
  const { odds } = lottery;
  if (odds.jackpotGrowthBp <= 0) return null;
  return <p className="text-sm text-text-2">{say("ui.lottery.grows", { share: formatBp(odds.jackpotGrowthBp), cap: formatMoney(odds.jackpotCap, "NGN") })}</p>;
}

/** R-LOTTERY-012, R-LOTTERY-023: the jackpot standing, and whether it rolled over from the last draw or starts again; with how it grows unless `grows` is false. */
export function Jackpot({ lottery, grows = true }: { lottery: Lottery; grows?: boolean }) {
  const since = lottery.rolledOver ? say("ui.lottery.rolled") : lottery.last === null ? null : say("ui.lottery.restarted");
  return (
    <div className="flex flex-col gap-1" data-lottery-jackpot={lottery.jackpot} data-rolled-over={lottery.rolledOver}>
      <p className="text-xs font-semibold tracking-widest text-text-2 uppercase">{say("ui.lottery.jackpot")}</p>
      <p className="text-4xl leading-none font-bold tabular-nums">{formatMoney(lottery.jackpot, "NGN")}</p>
      {since === null ? null : <p className="text-sm font-medium">{since}</p>}
      {grows ? <Grows lottery={lottery} /> : null}
    </div>
  );
}

/** R-LOTTERY-023: the odds as plain chances, with how a shared jackpot and a forced win go. */
export function Odds({ lottery }: { lottery: Lottery }) {
  const weeks = lottery.odds.forcedWinWeeks;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold tracking-widest text-text-2 uppercase">{say("ui.lottery.odds")}</p>
      <Chances odds={lottery.odds} jackpot={lottery.jackpot} />
      <p className="text-xs text-text-2">{say("ui.lottery.shared")}</p>
      {weeks === null ? null : (
        <p className="text-xs text-text-2" data-lottery-forced>
          {say("ui.lottery.forced", { weeks: formatNumber(weeks) })}
        </p>
      )}
    </div>
  );
}

/** The character's tickets in the draw on sale, one box for each the cap allows, and their numbers once the draw has closed (R-LOTTERY-005, 006). */
export function Held({ lottery }: { lottery: Lottery }) {
  return (
    <>
      <div className="flex items-start gap-2" data-lottery-held={lottery.tickets}>
        <Ticket size={18} className="mt-0.5 shrink-0 text-text-2" />
        <div className="flex flex-col gap-1.5">
          <span className="font-medium">{sayCount("ui.lottery.held", lottery.tickets, { count: lottery.tickets })}</span>
          <span aria-hidden className="flex gap-1.5">
            {Array.from({ length: lottery.maxTickets }, (_, index) => (
              <span key={index} className={`h-3 w-5 rounded-sm border ${index < lottery.tickets ? "border-accent bg-accent" : "border-sheet-line"}`} />
            ))}
          </span>
        </div>
      </div>
      {lottery.numbers !== null && lottery.numbers.length > 0 ? (
        <p className="text-sm tabular-nums">{say("ui.lottery.numbers", { numbers: lottery.numbers.map((number) => formatNumber(number)).join(", ") })}</p>
      ) : null}
    </>
  );
}

/** How many tickets to buy, from 1 to `most`, with one fewer and one more. */
export function Count({ count, most, onCount }: { count: number; most: number; onCount: (count: number) => void }) {
  return (
    <div role="group" aria-label={say("ui.lottery.how-many")} className="inline-flex items-center rounded-md border border-sheet-line">
      <button type="button" aria-label={say("ui.lottery.fewer")} disabled={count <= 1} onClick={() => onCount(count - 1)} className="inline-flex size-11 items-center justify-center disabled:opacity-40">
        <Minus size={18} />
      </button>
      <span className="min-w-8 text-center font-semibold tabular-nums" data-lottery-count>
        {count}
      </span>
      <button type="button" aria-label={say("ui.lottery.more")} disabled={count >= most} onClick={() => onCount(count + 1)} className="inline-flex size-11 items-center justify-center disabled:opacity-40">
        <Plus size={18} />
      </button>
    </div>
  );
}

function Tickets({ lottery }: { lottery: Lottery }) {
  const { pockets } = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const clock = useClock();
  // The draw before stays on show, closed, from its close until the next draw opens with its result.
  const closed = salesClosed(lottery, clock);
  const bank = pockets.NGN.bank;
  const most = canBuy(lottery, bank);
  const [wanted, setWanted] = useState(1);
  const count = Math.min(Math.max(1, wanted), Math.max(1, most));
  const full = lottery.tickets >= lottery.maxTickets;
  const cost = count * lottery.ticket;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{say("ui.lottery.price", { price: formatMoney(lottery.ticket, "NGN"), max: lottery.maxTickets })}</p>
      <Held lottery={lottery} />
      <Rejection />
      {closed ? (
        <p className="text-sm text-text-2" data-lottery-closed>
          {say("ui.lottery.closed-buy")}
        </p>
      ) : full ? (
        <p className="text-sm text-text-2">{say("ui.lottery.full")}</p>
      ) : most === 0 ? (
        <p className="text-sm text-text-2">{say("ui.lottery.short", { bank: formatMoney(bank, "NGN") })}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Count count={count} most={most} onCount={setWanted} />
            <Button variant="primary" disabled={busy} onClick={() => void send({ type: "lottery/buy", tickets: count }).then(() => setWanted(1))}>
              {sayCount("ui.lottery.buy", count, { count, cost: formatMoney(cost, "NGN") })}
            </Button>
          </div>
          <p className="text-xs text-text-2">{say("ui.lottery.from-bank", { bank: formatMoney(bank, "NGN") })}</p>
        </div>
      )}
    </div>
  );
}

/** R-LOTTERY-007: the draw's fingerprint in full, the public round when the world names it, and why it is published. */
export function SealDetails({ lottery }: { lottery: Lottery }) {
  const world = useGame((state) => state.world?.world.lottery ?? null);
  const round = world !== null && world.draw === lottery.draw ? world.beaconRound : null;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <code className="block rounded-md bg-sheet-muted p-2 text-xs break-all" data-lottery-fingerprint>
        {lottery.fingerprint}
      </code>
      {round === null ? null : <p className="text-text-2">{say("ui.lottery.round", { round: formatNumber(round) })}</p>}
      <p className="text-text-2">{say("ui.lottery.sealed-why")}</p>
    </div>
  );
}

function Seal({ lottery }: { lottery: Lottery }) {
  return (
    <details className="group text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-text-2">
        <ShieldCheck size={16} />
        <span className="min-w-0 truncate">{say("ui.lottery.fingerprint", { print: `${lottery.fingerprint.slice(0, 12)}...` })}</span>
      </summary>
      <div className="mt-2">
        <SealDetails lottery={lottery} />
      </div>
    </details>
  );
}

/** The kiosk. `load` fetches a draw for the draw page; by default from the server the build names. */
export function LotteryView({ load }: { load?: LoadDraw | null }) {
  const { lottery } = useView();
  const [checking, setChecking] = useState<number | null>(null);
  const [loader] = useState(() => (load === undefined ? serverDrawLoader() : load));
  if (lottery === null) return null;

  return (
    <Panel title={say("ui.lottery.title")} action={<Tag tone="accent">{say("ui.lottery.draw", { draw: lottery.draw })}</Tag>}>
      <Card className="flex flex-col gap-4" data-lottery={lottery.draw}>
        <Jackpot lottery={lottery} />
        <Close lottery={lottery} />
        <Odds lottery={lottery} />
        <Tickets lottery={lottery} />
        <Seal lottery={lottery} />
      </Card>
      {lottery.last === null ? null : <LastDraw result={lottery.last} onCheck={loader === null ? null : () => setChecking(lottery.last?.draw ?? null)} />}
      {loader === null ? null : (
        <Sheet open={checking !== null} onOpenChange={(open) => setChecking(open ? checking : null)} title={say("ui.lottery.page.title", { draw: checking ?? 0 })}>
          {checking === null ? null : <DrawPage draw={checking} load={loader} />}
        </Sheet>
      )}
    </Panel>
  );
}
