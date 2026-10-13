// A place loading (city.md R-CITY-018): its name and the progress, the progress as a bar that fills, never a figure in
// per cent, since a player's words never carry a percentage (the lively layer's words rule).
import { cityWords } from "./city.words";

export function LoadingNote({ place, percent, small = false }: { place: string; percent: number; small?: boolean }) {
  const filled = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <p className={small ? "rounded-md bg-sheet-2/95 px-2 py-1 text-xs text-text-2 shadow-sm" : "pointer-events-auto rounded-md bg-sheet/90 px-3 py-2 text-sm"} data-loading>
      {cityWords("city.loading", { place })}
      <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={filled} aria-label={cityWords("city.loading", { place })} className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-sheet-line">
        <span className="block h-full rounded-full bg-ink transition-transform duration-200" style={{ transform: `scaleX(${String(filled / 100)})`, transformOrigin: "0 50%" }} />
      </span>
    </p>
  );
}
