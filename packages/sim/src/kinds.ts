// The registry: every kind that owns a slice of the state, in the order the
// engine calls them within a phase. It is built on first use, not at import,
// because kinds import engine helpers that import this file: a cycle that is
// safe only while nothing reads a kind during module evaluation.
import { activityKind } from "./activity/activity.logic";
import { chapterKind } from "./chapter/chapter.logic";
import { creditKind } from "./credit/credit.logic";
import { goalKind } from "./goal/goal.logic";
import { lotteryKind } from "./lottery/lottery.logic";
import { placeKind } from "./place/place.logic";
import { prologueKind } from "./prologue/prologue.logic";
import { statusKind } from "./status/status.logic";
import { documentKind } from "./document/document.logic";
import type { AnyKind, Registry, SliceKey } from "./engine/kind";
import { SLICE_KEYS } from "./engine/kind";
import { newsKind } from "./news/news.logic";
import { obligationKind } from "./obligation/obligation.logic";
import { offerKind } from "./offer/offer.logic";
import { qualityKind } from "./quality/quality.logic";
import { routeKind } from "./route/route.logic";
import { setpieceKind } from "./setpiece/setpiece.logic";
import { turnKind } from "./turn/turn.logic";
import { walletKind } from "./wallet/wallet.logic";

let built: Registry | null = null;

function build(): Registry {
  const kinds: AnyKind[] = [
    turnKind,
    qualityKind,
    activityKind,
    walletKind,
    documentKind,
    routeKind,
    setpieceKind,
    obligationKind,
    offerKind,
    chapterKind,
    newsKind,
    placeKind,
    statusKind,
    creditKind,
    goalKind,
    prologueKind,
    lotteryKind,
  ];
  kinds.forEach((kind, index) => {
    if (kind.kind !== SLICE_KEYS[index]) {
      throw new Error(`The registry's kind ${String(index)} is ${kind.kind}, expected ${SLICE_KEYS[index] ?? "nothing"}.`);
    }
  });
  return kinds;
}

/** Every kind with a slice, in registry order. */
export function registry(): Registry {
  built ??= build();
  return built;
}

/** One kind of a registry, by its slice. The default registry when none is given. */
export function kindByKey(key: SliceKey, kinds: Registry = registry()): AnyKind {
  const found = kinds.find((kind) => kind.kind === key);
  if (found === undefined) throw new Error(`The registry has no kind ${key}.`);
  return found;
}
