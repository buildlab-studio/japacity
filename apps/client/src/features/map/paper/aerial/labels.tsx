// Trial dresses for the map's names, beside the one Lagos from the air ships with, for pictures in a development
// build alone: `?maplabels=l1` a wider halo and a heavier letter, `l2` the district names on a soft dark band, `l3` the
// district names in dark ink on a small cream pill. Street and water names keep their halo in all but L1, which widens
// it. A build for players always draws L0: the switch, its styles and the pills leave its code.
import type { CSSProperties } from "react";

import type { Label } from "../geometry";

export type LabelLook = "l0" | "l1" | "l2" | "l3";

const LOOKS: readonly LabelLook[] = ["l0", "l1", "l2", "l3"];

function asked(): LabelLook {
  if (!import.meta.env.DEV || typeof location === "undefined") return "l0";
  const query = new URLSearchParams(location.search).get("maplabels");
  return LOOKS.find((look) => look === query) ?? "l0";
}

/** The names' dress this page draws, read once as the map's code loads. */
export const LABEL_LOOK: LabelLook = asked();

/** Whether the district names stand as HTML pills over the paper rather than as its own lettering. */
export const LABEL_TAGS = LABEL_LOOK === "l2" || LABEL_LOOK === "l3";

if (import.meta.env.DEV && LABEL_LOOK !== "l0" && typeof document !== "undefined") {
  document.documentElement.dataset.mapLabels = LABEL_LOOK;
  void import("./labels.dev");
}

/** The district names as pills over the paper, each at its own place and tilt, the same size on the screen at every zoom. */
export function DistrictTags({ labels, shown, words }: { labels: readonly Label[]; shown: ReadonlySet<string> | null; words: (key: string) => string }) {
  return (
    <>
      {labels
        .filter((label) => shown === null || shown.has(label.key))
        .map((label) => (
          <span key={label.key} className="map-tag" style={{ left: label.at[0], top: label.at[1], "--tilt": `${String(label.tilt)}deg`, "--s": `${String(Math.max(12, label.size))}px` } as CSSProperties} data-tag={label.key} aria-hidden>
            {words(label.key)}
          </span>
        ))}
    </>
  );
}
