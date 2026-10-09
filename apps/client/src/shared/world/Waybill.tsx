// The waybill as a sheet over the scene: the cargo booth's act opens it (R-WORLD-005), the slip
// says what waits and what it costs (R-WORLD-006), and Collect it answers the parcel offer.
import type { Currency, ReportLine } from "@japacity/sim";

import { useGame } from "../../authority/GameProvider";
import { cue } from "../sound/cues";
import { formatMoney } from "../words/format";
import { AskSheet } from "./AskSheet";
import { parcelAsk } from "./parcel.ask";

export interface ParcelWaybillProps {
  /** Closes the slip, after Collect it lands or on not now. */
  onClose: () => void;
  /** What the answer said, for the screen's toast. */
  onCollected?: (lines: ReportLine[]) => void;
}

export function ParcelWaybill({ onClose, onCollected }: ParcelWaybillProps) {
  const view = useGame((state) => state.view);
  const send = useGame((state) => state.send);
  const money = (amount: number, currency: string): string => formatMoney(amount, currency as Currency);
  const ask =
    view === null
      ? null
      : parcelAsk(view, {
          formatMoney: money,
          done: onClose,
          send: (offer, choice) =>
            send({ type: "offer/choose", offer: offer.id, choice }).then((reply) => {
              const landed = reply !== null && reply.ok;
              cue(landed ? "coin" : "tap");
              onClose();
              if (landed) onCollected?.(reply.lines);
              return landed ? reply.lines : null;
            }),
        });
  return <AskSheet ask={ask} formatMoney={money} />;
}
