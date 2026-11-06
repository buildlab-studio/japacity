// The waybill as a sheet over the scene: the cargo booth's act opens it (world:things-are-tappable-models), the slip
// says what waits and what it costs (world:one-action-one-sheet), and Collect answers the parcel offer.
import type { Currency, ReportLine } from "@japacity/sim";
import { useContext } from "react";

import { useGame } from "../../authority/GameProvider";
import { cue } from "../sound/cues";
import { formatMoney } from "../words/format";
import { AskSheet } from "./AskSheet";
import { parcelAsk } from "./parcel.ask";
import { SheetClose } from "./WorldSheet";

export interface ParcelWaybillProps {
  /** Closes the slip, after Collect lands or on not now; the sheet the slip stands in (the asks sheet) lowers too, so a parcel left waiting never holds the screen (world:one-action-one-sheet). */
  onClose: () => void;
  /** What the answer said, for a line the screen tells in its corner. */
  onCollected?: (lines: ReportLine[]) => void;
}

export function ParcelWaybill({ onClose, onCollected }: ParcelWaybillProps) {
  const view = useGame((state) => state.view);
  const send = useGame((state) => state.send);
  const money = (amount: number, currency: string): string => formatMoney(amount, currency as Currency);
  const lower = useContext(SheetClose);
  const close = (): void => {
    onClose();
    lower();
  };
  const ask =
    view === null
      ? null
      : parcelAsk(view, {
          formatMoney: money,
          done: close,
          send: (offer, choice) =>
            send({ type: "offer/choose", offer: offer.id, choice }).then((reply) => {
              const landed = reply !== null && reply.ok;
              cue(landed ? "coin" : "tap");
              close();
              if (landed) onCollected?.(reply.lines);
              return landed ? reply.lines : null;
            }),
        });
  return <AskSheet ask={ask} formatMoney={money} />;
}
