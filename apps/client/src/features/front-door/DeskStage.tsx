// The desk's stage (prologue:front-door-three-screens, prologue:printed-page-hands-over): the figure big on its round floor, in the
// player's colours, with the sun behind it by day and the moon at night, and the travel data page beside it filling in as
// the run stands. On the lives the picked life stands beside the figure: its thing, its name and tag, the life in words, its
// savings and its ways out; on Where you live the picked home's picture stands large behind the figure. The stage stays
// mounted while the steps change, so the figure is one picture, a sticker or the one still in the player's colours, never
// drawn again for a step. From 1280 px wide the page stands to the right of the figure; below that it is smaller than the
// figure, at the stage's foot, clear of the panel.
import { type Archetype, savingsOf } from "../../shared/front-door/archetypes";
import { LIFE_THINGS } from "../../shared/front-door/lives";
import { FigurePicture, ModelPicture } from "../../shared/front-door/LookPicture";
import type { LookStyle } from "../../shared/front-door/style";
import { WayChips } from "../../shared/front-door/WayChips";
import { DataPage, type PageFields } from "../../shared/datapage/DataPage";
import { StickerChip } from "../../shared/ui/look/StickerChip";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { HomePicture } from "./HomeScreen";

export interface DeskStageProps {
  look: string;
  style: LookStyle | undefined;
  page: PageFields;
  /** The picked life, shown beside the figure on the lives; null elsewhere. */
  life: Archetype | null;
  /** The picked home, standing behind the figure on Where you live; null elsewhere. */
  home: string | null;
}

/** The picked life beside the figure: its name and tag, the life in a few words, its savings and the ways it opens. */
function LifeCard({ life }: { life: Archetype }) {
  return (
    <div key={life.id} className="door-card door-deal px-4 pt-3 pb-3.5" data-desk-life={life.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[22px] leading-tight font-bold">{say(`prologue.archetype.${life.id}.name`)}</p>
          <p className="text-[15px] font-medium text-text-2">{say(`prologue.archetype.${life.id}.life`)}</p>
        </div>
        <span className="sticker-chip shrink-0 bg-[var(--soft)]! px-3! py-1! text-[13px]! text-[var(--soft-ink)]!" style={{ rotate: "4deg" }}>
          {say(`ui.door.tag.${life.id}`)}
        </span>
      </div>
      <div className="mt-2">
        <StickerChip tint="money" tilt={-2} className="px-3! py-1! text-[14px]! text-[var(--money-ink)]!">
          <span className="num">{say("ui.door.tile.savings", { amount: formatMoney(savingsOf(life), "NGN") })}</span>
        </StickerChip>
      </div>
      <div className="mt-3 [&>div]:justify-start">
        <WayChips id={life.id} mark="data-desk-ways" />
      </div>
    </div>
  );
}

export function DeskStage({ look, style, page, life, home }: DeskStageProps) {
  return (
    <div className="desk-stage absolute inset-0" data-desk-stage>
      {/* The figure's half: the sun or the moon, the home behind on Where you live, the floor, the figure and the life's thing. */}
      <div className="desk-figure absolute inset-y-0 left-0" data-desk-figure>
        <span className="door-sun absolute top-[7%] right-[14%] size-[86px]" aria-hidden />
        {home === null ? null : (
          <span key={home} className="door-postcard door-deal absolute top-[12%] left-1/2 w-[min(78%,420px)] -translate-x-1/2" style={{ rotate: "-3deg" }} aria-hidden data-desk-home={home}>
            <HomePicture home={home as Parameters<typeof HomePicture>[0]["home"]} size={180} className="aspect-[840/594] w-full rounded-[4px]" />
          </span>
        )}
        <span className="desk-floor absolute bottom-[3%] left-1/2 h-[13%] w-[78%] -translate-x-1/2" aria-hidden />
        <FigurePicture look={look} style={style} className="absolute bottom-[5%] left-1/2 h-[88%] max-w-none -translate-x-1/2 transition-opacity duration-200" />
        {life === null ? null : (
          <span key={life.id} className="sticker-cut door-deal absolute bottom-[6%] left-[2%]" style={{ rotate: "-6deg" }} aria-hidden>
            <ModelPicture model={LIFE_THINGS[life.id].tile} size={150} />
          </span>
        )}
      </div>
      {/* The page beside the figure, and on the lives the picked life under it. */}
      <div className="desk-side absolute flex flex-col gap-4" data-desk-side>
        <div className="-rotate-2" data-desk-page>
          <DataPage page={page} />
        </div>
        {life === null ? null : <LifeCard life={life} />}
      </div>
    </div>
  );
}
