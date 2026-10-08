// The Friday draw's kiosk, online only (docs/rules/lottery.md R-LOTTERY-003,
// 006, 023): the price and the cap, the character's tickets, the close as a
// real time counting down, the pot with the house's top-up apart, the
// fingerprint and the public round, and the last draw with a way to check it.
// Offline `World.lottery` is null, the view's `lottery` with it, and the
// luck kiosk among the month's activities plays instead (R-LOTTERY-001).
import { Minus, Plus, ShieldCheck, Ticket } from "lucide-react";
import { useEffect, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Panel, Tag } from "../../shared/ui/Panel";
import { Rejection } from "../../shared/ui/Rejection";
import { Sheet } from "../../shared/ui/Sheet";
import { formatMoney, formatNumber } from "../../shared/words/format";
import { say, sayCount } from "../../shared/words/text";
import { canBuy, closesAt, potOf, serverDrawLoader, type LoadDraw, type Lottery } from "./draw";
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
function useClock(): { tick: number; nextTickAt: number } | null {
  const clock = useGame((state) => state.clock);
  const world = useGame((state) => state.world);
  if (clock !== null) return clock;
  return world === null ? null : { tick: world.tick, nextTickAt: world.nextTickAt };
}

function Close({ lottery }: { lottery: Lottery }) {
  const at = closesAt(lottery, useClock());
  const now = useNow(at !== null);
  if (at === null) return null;
  const open = now < at;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm" data-lottery-close={at}>
      <span className="font-medium">{say("ui.lottery.closes", { when: closeWords(at) })}</span>
      <span className="text-muted tabular-nums">{open ? say("ui.lottery.closes-in", { wait: waitWords(at - now) }) : say("ui.lottery.closed")}</span>
    </p>
  );
}

function Pot({ lottery }: { lottery: Lottery }) {
  const pot = potOf(lottery);
  const declared = lottery.topUpTickets > 0;
  return (
    <div className="flex flex-col gap-1" data-lottery-pot>
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">{say("ui.lottery.pot")}</p>
      <p className="font-display text-4xl leading-none tabular-nums">{formatMoney(pot.total, "NGN")}</p>
      <p className="text-sm">{say("ui.lottery.from-sales", { sales: formatMoney(pot.sales, "NGN") })}</p>
      {declared ? (
        <p className="text-sm text-muted" data-lottery-top-up>
          {pot.topUp > 0
            ? say("ui.lottery.top-up", { tickets: formatNumber(lottery.topUpTickets), worth: formatMoney(pot.worth, "NGN"), soFar: formatMoney(pot.topUp, "NGN") })
            : say("ui.lottery.top-up-done", { tickets: formatNumber(lottery.topUpTickets) })}
        </p>
      ) : null}
    </div>
  );
}

function Tickets({ lottery }: { lottery: Lottery }) {
  const { pockets } = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const bank = pockets.NGN.bank;
  const most = canBuy(lottery, bank);
  const [wanted, setWanted] = useState(1);
  const count = Math.min(Math.max(1, wanted), Math.max(1, most));
  const full = lottery.tickets >= lottery.maxTickets;
  const cost = count * lottery.ticket;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{say("ui.lottery.price", { price: formatMoney(lottery.ticket, "NGN"), max: lottery.maxTickets })}</p>
      <div className="flex flex-wrap items-center gap-2" data-lottery-held={lottery.tickets}>
        <Ticket size={18} className="text-muted" />
        <span className="font-medium">{sayCount("ui.lottery.held", lottery.tickets, { count: lottery.tickets })}</span>
        {Array.from({ length: lottery.maxTickets }, (_, index) => (
          <span key={index} aria-hidden className={`size-3 rounded-sm border ${index < lottery.tickets ? "border-accent bg-accent" : "border-line"}`} />
        ))}
      </div>
      {lottery.numbers !== null && lottery.numbers.length > 0 ? (
        <p className="text-sm tabular-nums">{say("ui.lottery.numbers", { numbers: lottery.numbers.map((number) => formatNumber(number)).join(", ") })}</p>
      ) : null}
      <Rejection />
      {full ? (
        <p className="text-sm text-muted">{say("ui.lottery.full")}</p>
      ) : most === 0 ? (
        <p className="text-sm text-muted">{say("ui.lottery.short", { bank: formatMoney(bank, "NGN") })}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label={say("ui.lottery.how-many")} className="inline-flex items-center rounded-lg border border-line">
              <button type="button" aria-label={say("ui.lottery.fewer")} disabled={count <= 1} onClick={() => setWanted(count - 1)} className="inline-flex size-11 items-center justify-center disabled:opacity-40">
                <Minus size={18} />
              </button>
              <span className="min-w-8 text-center font-semibold tabular-nums" data-lottery-count>
                {count}
              </span>
              <button type="button" aria-label={say("ui.lottery.more")} disabled={count >= most} onClick={() => setWanted(count + 1)} className="inline-flex size-11 items-center justify-center disabled:opacity-40">
                <Plus size={18} />
              </button>
            </div>
            <Button variant="primary" disabled={busy} onClick={() => void send({ type: "lottery/buy", tickets: count }).then(() => setWanted(1))}>
              {sayCount("ui.lottery.buy", count, { count, cost: formatMoney(cost, "NGN") })}
            </Button>
          </div>
          <p className="text-xs text-muted">{say("ui.lottery.from-bank", { bank: formatMoney(bank, "NGN") })}</p>
        </div>
      )}
    </div>
  );
}

function Seal({ lottery }: { lottery: Lottery }) {
  const world = useGame((state) => state.world?.world.lottery ?? null);
  const round = world !== null && world.draw === lottery.draw ? world.beaconRound : null;
  return (
    <details className="group text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-muted">
        <ShieldCheck size={16} />
        <span className="min-w-0 truncate">{say("ui.lottery.fingerprint", { print: `${lottery.fingerprint.slice(0, 12)}...` })}</span>
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <code className="block rounded-lg bg-sunk p-2 text-xs break-all" data-lottery-fingerprint>
          {lottery.fingerprint}
        </code>
        {round === null ? null : <p className="text-muted">{say("ui.lottery.round", { round: formatNumber(round) })}</p>}
        <p className="text-muted">{say("ui.lottery.sealed-why")}</p>
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
        <Close lottery={lottery} />
        <Pot lottery={lottery} />
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
