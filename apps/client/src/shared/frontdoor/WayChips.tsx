// The ways a life opens, as picture chips (prologue.md R-PROLOGUE-010, 013): under the lives' deck and
// on the page after Begin, the picture the table holds for each way and its words.
import { Tile } from "../tiles/Tile";
import { StickerChip } from "../ui/lively/StickerChip";
import { opensChips } from "./archetypes";
import { wayPicture } from "./lives";

/** The ways a life opens, as picture chips: the picture the table holds for each, and its words. */
export function WayChips({ id, mark }: { id: string; mark?: string }) {
  return (
    <div className="flex flex-wrap justify-center gap-2" {...(mark === undefined ? {} : { [mark]: "" })}>
      {opensChips(id).map((way, at) => {
        const picture = wayPicture(way);
        return (
          <StickerChip key={way} tint="plain" tilt={at % 2 === 0 ? -2.5 : 2} className="bg-sheet-2! px-3! py-1.5! text-[14px]!">
            {picture === null ? null : <Tile of={picture} size={20} />} <span data-way>{way}</span>
          </StickerChip>
        );
      })}
    </div>
  );
}

