// The desk's stage (prologue:front-door-three-screens, prologue:printed-page-hands-over): the figure big on its round floor, in the
// player's colours, with the sun behind it by day and the moon at night, and the travel data page beside it filling in as
// the run stands. On the lives the picked life stands beside the figure: its thing, its name and tag, the life in words, its
// savings and its ways out; on Where you live the picked home's picture stands large behind the figure. The stage stays
// mounted while the steps change, so the figure is one picture, a sticker or the one still in the player's colours, never
// drawn again for a step. From 1280 px wide the page stands to the right of the figure; below that it is smaller than the
// figure, at the stage's foot, clear of the panel. At the handover the figure cheers and the page prints in place; nothing on the stage is drawn again for it.
import type { ReactNode } from "react";

import { type Archetype, savingsOf } from "./archetypes";
import { LIFE_THINGS } from "./lives";
import { FigurePicture, ModelPicture } from "./LookPicture";
import type { LookStyle } from "./style";
import { WayChips } from "./WayChips";
import { StickerChip } from "../ui/look/StickerChip";
import { formatMoney } from "../words/format";
import { say } from "../words/text";
import { HomePicture } from "./HomePicture";

export interface DeskStageProps {
  look: string;
  style: LookStyle | undefined;
  /** The travel data page, drawn by the page the handover prints (DataPage), with anything slapped on it. */
  page: ReactNode;
  /** The picked life, shown beside the figure on the lives; null elsewhere. */
  life: Archetype | null;
  /** The picked home, standing behind the figure on Where you live; null elsewhere. */
  home: string | null;
  /** What is slapped on the page: the life's thing at the handover. */
  onPage?: ReactNode;
  /** True at the handover, where the figure cheers. */
  cheer?: boolean;
}

/** The picked life beside the figure: its name and tag, the life in a few words, its savings and the ways it opens. */
function LifeCard({ life }: { life: Archetype }) {
  return (
    <div key={life.id} className="door-card door-deal desk-life-card" data-desk-life={life.id}>
      <div className="desk-life-head">
        <div className="min-w-0">
          <p className="desk-life-name">{say(`prologue.archetype.${life.id}.name`)}</p>
          <p className="desk-life-words">{say(`prologue.archetype.${life.id}.life`)}</p>
        </div>
        <span className="sticker-chip desk-tag">
          {say(`ui.door.tag.${life.id}`)}
        </span>
      </div>
      <div className="mt-2">
        <StickerChip tint="money" tilt={-2} className="px-3! py-1! text-[14px]! text-[var(--money-ink)]!">
          <span className="num">{say("ui.door.tile.savings", { amount: formatMoney(savingsOf(life), "NGN") })}</span>
        </StickerChip>
      </div>
      <div className="desk-life-ways">
        <WayChips id={life.id} mark="data-desk-ways" />
      </div>
    </div>
  );
}

export function DeskStage({ look, style, page, onPage = null, life, home, cheer = false }: DeskStageProps) {
  return (
    <div className="desk-stage" data-desk-stage>
      {/* The figure's half: the sun or the moon, the home behind on Where you live, the floor, the figure and the life's thing. */}
      <div className="desk-figure" data-desk-figure>
        <span className="door-sun desk-sun" aria-hidden />
        {home === null ? null : (
          <span key={home} className="door-postcard door-deal desk-home" style={{ rotate: "-3deg" }} aria-hidden data-desk-home={home}>
            <HomePicture home={home as Parameters<typeof HomePicture>[0]["home"]} size={180} className="desk-home-picture" />
          </span>
        )}
        <span className="desk-floor" aria-hidden />
        <FigurePicture look={look} style={style} view={cheer ? "cheer" : "figure"} className="desk-figure-picture" />
        {life === null ? null : (
          <span key={life.id} className="sticker-cut door-deal desk-thing" style={{ rotate: "-6deg" }} aria-hidden>
            <ModelPicture model={LIFE_THINGS[life.id].tile} size={150} />
          </span>
        )}
      </div>
      {/* The page beside the figure, and on the lives the picked life under it. */}
      <div className="desk-side" data-desk-side>
        <div className="relative -rotate-2" data-desk-page>
          {page}
          {onPage}
        </div>
        {life === null ? null : <LifeCard life={life} />}
      </div>
    </div>
  );
}
