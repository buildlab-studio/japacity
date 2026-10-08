// On the road there is one panel: the chain's card and the exit, and nothing
// else (road.md R-ROAD-010). No japacity, no share card, no tabs, no advert
// slot, no family request and no news from home. The months pass while you
// wait; the exit the cards promise is a control beside waiting a month.
import { content } from "@japacity/content";
import type { OfferView, PlayerView, ReportLine } from "@japacity/sim";
import { DoorOpen, Hourglass } from "lucide-react";
import type { ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Panel";
import { Rejection } from "../../shared/ui/Rejection";
import { ReportLines } from "../../shared/ui/ReportLines";
import { monthEnding } from "../../shared/words/format";
import { nameOf, say, words } from "../../shared/words/text";

/** Answers that leave the chain: turning back before the truth, the exit after it (R-ROAD-004, 007). */
const EXITS = new Set(["exit", "turn-back"]);

/** The offer that lets the player ask to be taken home, and the choice that asks (R-ROAD-007). */
export const EXIT_OFFER = "offer.road-exit";
export const ASK = "ask";

function isRoadOffer(offer: OfferView): boolean {
  return offer.entry === EXIT_OFFER || content.offer[offer.entry]?.group === "road";
}

/**
 * The exit as a control: the road's exit offer when it is open, or, until the
 * simulation opens one, any road offer that can be answered by asking.
 */
export function exitOffer(offers: readonly OfferView[]): OfferView | null {
  const asking = (offer: OfferView) => offer.choices.some((choice) => choice.id === ASK);
  return offers.find((offer) => offer.entry === EXIT_OFFER && asking(offer)) ?? offers.find((offer) => isRoadOffer(offer) && asking(offer)) ?? null;
}

/** The road's own offers, the exit aside: a ransom call is part of the chain, a family request is not. */
export function roadOffers(offers: readonly OfferView[]): OfferView[] {
  const exit = exitOffer(offers);
  return offers.filter((offer) => offer !== exit && isRoadOffer(offer));
}

/** Lines from home that do not reach the road: the news, talk of routes, and offers that are not the road's. */
function fromHome(line: ReportLine): boolean {
  if (line.key.startsWith("line.news.") || line.key === "line.route.heard") return true;
  const offer = line.params.offer;
  return line.key.startsWith("line.offer.") && typeof offer === "string" && offer !== EXIT_OFFER && content.offer[offer as OfferView["entry"]]?.group !== "road";
}

export function roadLines(lines: readonly ReportLine[]): ReportLine[] {
  return lines.filter((line) => !fromHome(line));
}

function ChainCard() {
  const { setpiece, ended } = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  if (setpiece === null || setpiece.question === null) return null;
  const { question } = setpiece;
  return (
    <Card className="flex flex-col gap-4" data-chain-card>
      <h2 className="text-lg font-semibold">{nameOf(setpiece.entry)}</h2>
      <p className="text-xl">{words(`${setpiece.entry}.q.${question.id}`)}</p>
      <ul className="flex flex-col gap-2">
        {question.answers.map((answer) => {
          const exit = EXITS.has(answer);
          return (
            <li key={answer}>
              <Button
                variant={exit ? "primary" : "secondary"}
                className="w-full justify-start text-left"
                disabled={busy || ended || !question.allowed.includes(answer)}
                data-exit={exit ? "true" : undefined}
                onClick={() => void send({ type: "setpiece/answer", question: question.id, answer })}
              >
                {exit ? <DoorOpen size={18} className="shrink-0" /> : null}
                <span className="flex-1 py-2">{words(`${setpiece.entry}.a.${question.id}.${answer}`)}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Exit({ offers }: { offers: PlayerView["offers"] }) {
  const ended = useView().ended;
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const exit = exitOffer(offers);
  return (
    <Card tone="attention" className="flex flex-col gap-3" data-road-exit>
      <div className="flex items-start gap-3">
        <DoorOpen size={22} className="mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">{say("ui.road.exit-title")}</h2>
          <p className="text-sm">{say("ui.road.exit-help")}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {exit === null ? null : (
          <Button
            variant="primary"
            className="sm:flex-1"
            disabled={busy || ended || exit.choices.find((choice) => choice.id === ASK)?.allowed !== true}
            data-exit="ask"
            onClick={() => void send({ type: "offer/choose", offer: exit.id, choice: ASK })}
          >
            <DoorOpen size={18} />
            {say("ui.road.ask")}
          </Button>
        )}
        <Wait />
      </div>
    </Card>
  );
}

function Wait() {
  const view = useView();
  const busy = useGame((state) => state.busy);
  const endMonth = useGame((state) => state.endMonth);
  const blocked = view.ended || view.turns.banked < 1;
  return (
    <Button className="sm:flex-1" onClick={() => void endMonth()} disabled={busy || blocked || view.setpiece !== null}>
      <Hourglass size={18} />
      {say("ui.road.wait")}
    </Button>
  );
}

/** `offers` draws the offer panel for the offers it is given: the shell hands in the offer screen. */
/** The city behind the road's panel comes from the shell as an element (R-CITY-012): a feature never imports another. */
export function RoadView({ offers = null, city = null }: { offers?: ((only: (offer: OfferView) => boolean) => ReactNode) | null; city?: ReactNode }) {
  const view = useView();
  const report = view.report;
  const shown = roadOffers(view.offers);
  const lines = report === null ? [] : roadLines(report.lines);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-6" data-road>
      {city}
      <p className="text-sm font-semibold tracking-wide text-muted uppercase">{say("ui.road.title")}</p>
      <ChainCard />
      {shown.length === 0 || offers === null ? null : offers((offer) => shown.includes(offer))}
      {report === null || lines.length === 0 ? null : (
        <Card className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">{say("ui.report.title", { month: monthEnding(report.month) })}</h2>
          <ReportLines lines={lines} />
        </Card>
      )}
      <Rejection />
      <Exit offers={view.offers} />
    </main>
  );
}
