// The child of the water's first brief as the game hands it: the way out heard of at a send-off in the years before
// stands first, ticked with where it happened; then the job at the racks, a month worked in it, and the page at the hub.
import type { Dot } from "../parts";
import { W } from "../words";
import type { Item } from "./parts";

/** The brief's picture while the job is the one to do: Makoko, where the racks are. */
export const BRIEF_AT_MAKOKO = "building_makoko-house_b";
/** The brief's picture once the page is the one to do: the hub's desk. */
export const BRIEF_AT_HUB = "prop_long-desk";

/** The brief's things with the job, the month's work and the page still to do. */
export const ITEMS_START: readonly Item[] = [
  { words: W.itemHeard, place: W.beforeHeard, tile: "prop_meetup-corner", met: true, now: false },
  { words: W.itemJob, place: W.atRacks, tile: "prop_long-desk", met: false, now: true },
  { words: W.itemPay, place: W.atJob, tile: "building_flyover-span", met: false, now: false },
  { words: W.itemKnown, place: W.atHub, tile: null, met: false, now: false },
];

/** The brief's things with the job held and its first month worked: the page at the hub is the one left. */
export const ITEMS_PAID: readonly Item[] = [
  { words: W.itemHeard, place: W.beforeHeard, tile: "prop_meetup-corner", met: true, now: false },
  { words: W.itemJob, place: W.atRacks, tile: "prop_long-desk", met: true, now: false },
  { words: W.itemPay, place: W.atJob, tile: "building_flyover-span", met: true, now: false },
  { words: W.itemKnown, place: W.atHub, tile: null, met: false, now: true },
];

/** The dots before the month's work counts: the send-off and the job in, the month to do. */
export const DOTS_WORKING: readonly Dot[] = ["done", "done", "now", "later"];
