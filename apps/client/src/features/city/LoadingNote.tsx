// A place loading (city:places-load-on-entry): its name and the progress, the progress as a bar that fills, never a figure in
// per cent, since a player's words never carry a percentage (the rule of the game's look for words). The bar is the one every
// wait takes (shared/ui/Loader), filled to the share of the place's models in.
import { Loader } from "../../shared/ui/Loader";
import { cityWords } from "./city.words";

export function LoadingNote({ place, percent, small = false }: { place: string; percent: number; small?: boolean }) {
  const words = cityWords("city.loading", { place });
  return (
    <p className={small ? "rounded-md bg-sheet-2/95 px-2 py-1 text-xs text-text-2 shadow-sm" : "pointer-events-auto rounded-md bg-sheet/90 px-3 py-2 text-sm"} data-loading>
      {words}
      <Loader label={words} percent={percent} className="mt-1" />
    </p>
  );
}
