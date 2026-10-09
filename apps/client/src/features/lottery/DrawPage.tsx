// The draw page (docs/rules/lottery.md R-LOTTERY-015): a draw's public data
// from `GET /api/draw/:n`, and the result worked out again on the device with
// the simulation's `drawSeed`, `ticketResult` for every ticket and
// `drawResults`, with a plain line saying whether the two match.
import type { Tier } from "@japacity/sim";
import { CircleCheck, CircleX } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type { ServerRejection } from "../../shared/net/contract";
import { formatMoney, formatNumber } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { checkDraw, isRefusal, type DrawReply, type LoadDraw } from "./draw";
import { Tiers } from "./LastDraw";
import { Chances } from "./Chances";
import { closeWords } from "./when";

type Fetched = { kind: "loading" } | { kind: "failed" } | { kind: "loaded"; reply: DrawReply };

function useDraw(draw: number, load: LoadDraw): Fetched {
  const [fetched, setFetched] = useState<{ draw: number; state: Fetched }>({ draw, state: { kind: "loading" } });
  useEffect(() => {
    let live = true;
    load(draw).then(
      (reply: DrawReply | ServerRejection) => {
        if (live) setFetched({ draw, state: isRefusal(reply) ? { kind: "failed" } : { kind: "loaded", reply } });
      },
      () => {
        if (live) setFetched({ draw, state: { kind: "failed" } });
      },
    );
    return () => {
      live = false;
    };
  }, [draw, load]);
  return fetched.draw === draw ? fetched.state : { kind: "loading" };
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-semibold tracking-wide text-text-2 uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Hex({ value }: { value: string }) {
  return <code className="block rounded-lg bg-sheet-muted p-2 text-xs break-all">{value}</code>;
}

function Verdict({ good, yes, no, mark }: { good: boolean; yes: string; no: string; mark: string }) {
  return (
    <p className={`flex items-start gap-2 font-medium ${good ? "text-good" : "text-bad"}`} data-check={mark} data-good={good}>
      {good ? <CircleCheck size={20} className="mt-0.5 shrink-0" /> : <CircleX size={20} className="mt-0.5 shrink-0" />}
      {good ? yes : no}
    </p>
  );
}

function List({ list, tickets }: { list: string[]; tickets: (Tier | null)[] | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-2">{say("ui.lottery.page.list-note")}</p>
      <button type="button" className="self-start text-sm underline underline-offset-4" onClick={() => setOpen(!open)}>
        {open ? say("ui.lottery.page.hide-list") : say("ui.lottery.page.show-list")}
      </button>
      {open ? (
        <ol className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-lg bg-sheet-muted p-2 font-mono text-xs sm:grid-cols-2" data-draw-list>
          {list.map((token, index) => {
            const tier = tickets?.[index] ?? null;
            return (
              <li key={index} className="tabular-nums" data-ticket-tier={tier ?? ""}>
                {String(index).padStart(3, " ")} {token}
                {tier === null ? null : <span className="font-sans font-semibold"> {say(`ui.lottery.page.ticket.${tier}`)}</span>}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

export function DrawPage({ draw, load }: { draw: number; load: LoadDraw }) {
  const fetched = useDraw(draw, load);
  if (fetched.kind === "loading") return <p className="text-text-2">{say("ui.lottery.page.loading")}</p>;
  if (fetched.kind === "failed") return <p className="text-bad">{say("ui.lottery.page.failed")}</p>;
  const { reply } = fetched;
  const { result, list } = reply;
  const check = checkDraw(reply);

  return (
    <div className="flex flex-col gap-5" data-draw-page={reply.draw}>
      <p className="text-text-2">{say("ui.lottery.page.intro")}</p>
      <p className="text-sm" data-draw-how>
        {say("ui.lottery.page.how")}
      </p>
      {check === null ? null : (
        <div className="flex flex-col gap-2 rounded-xl border border-sheet-line bg-sheet-2 p-3" data-draw-checks>
          <Verdict mark="winners" good={check.matches} yes={say("ui.lottery.page.check.winners")} no={say("ui.lottery.page.check.winners-bad")} />
          <Verdict mark="fingerprint" good={check.fingerprint} yes={say("ui.lottery.page.check.fingerprint")} no={say("ui.lottery.page.check.fingerprint-bad")} />
          <Verdict mark="list" good={check.list} yes={say("ui.lottery.page.check.list")} no={say("ui.lottery.page.check.list-bad")} />
        </div>
      )}
      {result === null ? null : (
        <div className="flex flex-col gap-3">
          <Tiers result={result} showTickets />
          <p className="text-sm">{say("ui.lottery.page.next", { next: formatMoney(result.nextJackpot, "NGN") })}</p>
        </div>
      )}
      <dl className="flex flex-col gap-3">
        <Fact label={say("ui.lottery.page.closes")}>{closeWords(reply.closesAt)}</Fact>
        <Fact label={say("ui.lottery.page.fingerprint")}>
          <Hex value={reply.fingerprint} />
        </Fact>
        <Fact label={say("ui.lottery.page.round")}>{formatNumber(reply.beaconRound)}</Fact>
        <Fact label={say("ui.lottery.page.odds")}>
          <Chances odds={reply.odds} jackpot={reply.jackpot} />
        </Fact>
        {list === null ? null : (
          <>
            <Fact label={say("ui.lottery.page.list")}>
              {formatNumber(list.length)}
              <List list={list} tickets={check?.tickets ?? null} />
            </Fact>
            {reply.listHash === null ? null : (
              <Fact label={say("ui.lottery.page.list-hash")}>
                <Hex value={reply.listHash} />
              </Fact>
            )}
          </>
        )}
        {result === null ? null : (
          <>
            <Fact label={say("ui.lottery.page.secret")}>
              <Hex value={result.revealed} />
            </Fact>
            <Fact label={say("ui.lottery.page.randomness")}>
              <Hex value={result.beaconRandomness} />
            </Fact>
          </>
        )}
        {check === null ? null : (
          <Fact label={say("ui.lottery.page.seed")}>
            <Hex value={check.seed} />
          </Fact>
        )}
      </dl>
      {list === null ? <p className="text-sm text-text-2">{say("ui.lottery.page.open")}</p> : result === null ? <p className="text-sm text-text-2">{say("ui.lottery.page.waiting")}</p> : null}
    </div>
  );
}
