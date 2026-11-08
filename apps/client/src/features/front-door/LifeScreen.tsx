// The door's second screen, Your life so far (prologue:front-door-builds-a-person, prologue:archetype-presets-answers, prologue:front-door-three-screens): each
// life a big sticker card swiped sideways with pager dots, the life's own thing big on it with your face sticker, its
// tag as a tilted chip, the name, the life in a few words, what it was and its savings; the ways it opens as picture
// chips under the deck; and the age as a stepper card. A card swiped to the middle is the life picked, as a tap on it is.
// On a desk every life shows at once as a two-column grid of small sticker tiles (its thing, its name, its tag), the picked
// one ringed and tilted, with the age card under them; the stage shows the picked life large.
import { Minus, Plus } from "lucide-react";
import { useEffect, useRef } from "react";

import { agePointsCount, type Archetype, ARCHETYPES, savingsOf } from "../../shared/front-door/archetypes";
import { LIFE_THINGS } from "../../shared/front-door/lives";
import { WayChips } from "../../shared/front-door/WayChips";
import { FaceSticker, ModelPicture } from "../../shared/front-door/LookPicture";
import { ageStepWords } from "../../shared/datapage/age";
import { StickerChip } from "../../shared/ui/look/StickerChip";
import { Tile } from "../../shared/tiles/Tile";
import { TINTS } from "../../shared/ui/look/tint";
import { motionReduced } from "../../shared/ui/motion";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";

/** How long the deck rests before the card in the middle counts as picked, where the browser has no scroll end. */
const SETTLE_MS = 140;

export interface LifeProps {
  look: string;
  picked: Archetype | null;
  once: boolean;
  onPick: (archetype: Archetype) => void;
  /** The tile's own year, and the years older the steps open. */
  lowest: number | null;
  older: number;
  open: readonly number[];
  onStep: (by: number) => void;
}

/** One life's card: its thing on the tint of its kind with your face, the tag, the name, the life in words, what it was, the savings. */
function LifeCard({ tile, look, on, onPick }: { tile: Archetype; look: string; on: boolean; onPick: () => void }) {
  const thing = LIFE_THINGS[tile.id];
  return (
    <button
      type="button"
      role="radio"
      data-archetype={tile.id}
      aria-label={say(`prologue.archetype.${tile.id}.name`)}
      aria-description={say(`prologue.archetype.${tile.id}.opens`)}
      aria-checked={on}
      onClick={onPick}
      className="door-life door-card w-[282px] p-2.5 text-left"
      style={{ rotate: on ? "-1.5deg" : "1.5deg" }}
    >
      {/* The picture gives way on a phone so a life whose ways run to two rows still shows the age whole above the dots;
          on a taller screen it keeps its full height. */}
      <span className={`relative block h-[clamp(150px,calc(100dvh-660px),200px)] rounded-[14px] ${TINTS[thing.tint]}`}>
        <span className="sticker-chip door-life-tag" style={{ rotate: "-4deg" }} data-tile-tag>
          {say(`ui.door.tag.${tile.id}`)}
        </span>
        <span className="sticker-cut absolute top-6 right-2" style={{ rotate: "5deg" }} aria-hidden>
          <ModelPicture model={thing.tile} size={160} />
        </span>
        <span className="absolute bottom-[-22px] left-[-10px] z-[3]">
          {/* 85 CSS pixels: the published face is 256 across, three picture pixels for each on a sharp phone. */}
          <FaceSticker look={look} size={85} tilt={-6} tint="food" />
        </span>
      </span>
      <span className="block px-1.5 pt-8">
        <span className="block text-[22px] leading-tight font-bold" data-tile-name>
          {say(`prologue.archetype.${tile.id}.name`)}
        </span>
        <span className="mt-0.5 block text-[16px] font-medium text-text-2" data-tile-life>
          {say(`prologue.archetype.${tile.id}.life`)}
        </span>
        <span className="mt-1.5 block text-[13px] leading-snug text-text-2" data-tile-was>
          {say(`prologue.archetype.${tile.id}.was`)}
        </span>
        <span className="mt-2.5 block">
          <StickerChip tint="money" tilt={-2} className="px-3! py-1! text-[14px]! text-[var(--money-ink)]!">
            <span className="num" data-tile-savings>
              {say("ui.door.tile.savings", { amount: formatMoney(savingsOf(tile), "NGN") })}
            </span>
          </StickerChip>
        </span>
      </span>
    </button>
  );
}

export function LifeScreen({ look, picked, once, onPick, lowest, older, open, onStep }: LifeProps) {
  const deck = useRef<HTMLDivElement>(null);
  const settle = useRef<number | null>(null);
  const at = Math.max(0, ARCHETYPES.findIndex((tile) => tile.id === picked?.id));
  // The picked card stands in the middle: at once when the screen opens, smoothly when it is tapped or shuffled.
  const shown = useRef(false);
  useEffect(() => {
    const card = deck.current?.children[at] as HTMLElement | undefined;
    if (card === undefined || typeof card.scrollIntoView !== "function") return;
    const smooth = shown.current && !motionReduced();
    card.scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "nearest", inline: "center" });
    shown.current = true;
  }, [at]);
  // A card swiped to the middle is picked once the deck comes to rest. The middle and the cards are measured on the screen,
  // since a card's offset counts from the door laid out round the deck, not from the deck's own scroll.
  const rest = (): void => {
    const strip = deck.current;
    if (strip === null) return;
    const box = strip.getBoundingClientRect();
    const middle = box.left + box.width / 2;
    let nearest = at;
    let best = Number.POSITIVE_INFINITY;
    [...strip.children].forEach((child, index) => {
      const card = (child as HTMLElement).getBoundingClientRect();
      const gap = Math.abs(card.left + card.width / 2 - middle);
      if (gap < best) {
        best = gap;
        nearest = index;
      }
    });
    const tile = ARCHETYPES[nearest];
    if (tile !== undefined && nearest !== at) onPick(tile);
  };
  const scrolled = (): void => {
    if (settle.current !== null) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(rest, SETTLE_MS);
  };
  return (
    <>
      {once ? <OnceLine className="mt-1 px-5" /> : null}
      <div ref={deck} className="door-deck mt-4 px-[calc(50%-141px)] pt-2 pb-5" role="radiogroup" aria-label={say("ui.door.life")} onScroll={scrolled} data-archetypes>
        {ARCHETYPES.map((tile) => (
          <LifeCard key={tile.id} tile={tile} look={look} on={tile.id === picked?.id} onPick={() => onPick(tile)} />
        ))}
      </div>
      {picked === null ? null : <WayChips id={picked.id} mark="data-tile-opens" />}
      <div className="mt-2 flex justify-center" aria-hidden data-door-pager>
        <span className="door-dots">
          {ARCHETYPES.map((tile, index) => (
            <i key={tile.id} {...(index === at ? { "data-now": "" } : {})} />
          ))}
        </span>
      </div>
      <span className="sr-only">{say("ui.door.lives", { n: at + 1, count: ARCHETYPES.length })}</span>
      {lowest === null ? null : <AgeCard picked={picked} lowest={lowest} older={older} open={open} onStep={onStep} className="door-card mx-5 mt-3 mb-4 px-3.5 py-3" />}
    </>
  );
}

/** The line that says the years may go another way, where a life is started only once (prologue:tile-path-open-from-start). */
export function OnceLine({ className }: { className: string }) {
  return (
    <p className={`${className} text-[12px] leading-snug text-text-2`} data-door-once>
      {say("prologue.archetype.once")}
    </p>
  );
}

/** The age as a stepper card: the tile's own year and older, and what a step does. */
export function AgeCard({ picked, lowest, older, open, onStep, className }: { picked: Archetype | null; lowest: number; older: number; open: readonly number[]; onStep: (by: number) => void; className: string }) {
  const does = ageStepWords(older, lowest, picked !== null && agePointsCount(picked));
  return (
    <section className={className} aria-label={say("prologue.door.age")} data-door-age>
      <div className="flex items-center gap-3" data-age-steps>
        <span className="sticker-cut" style={{ rotate: "-6deg" }} aria-hidden>
          <span className="flex size-11 items-center justify-center rounded-[12px] bg-[var(--soft)]">
            <Tile of="phone.birthday" size={26} />
          </span>
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="text-[16px] font-bold">{say("prologue.door.age")}</h2>
          <p className="text-[12px] text-text-2">{say("ui.door.age.from", { years: lowest })}</p>
        </div>
        <button type="button" className="round-button" aria-label={say("prologue.door.age.younger")} disabled={!open.includes(older - 1)} onClick={() => onStep(-1)}>
          <Minus size={20} strokeWidth={2.4} aria-hidden />
        </button>
        <span className="num min-w-[52px] text-center text-[34px] leading-none font-bold" data-age-years>
          {say("prologue.door.age.years", { years: lowest + older })}
        </span>
        <button type="button" className="round-button" aria-label={say("prologue.door.age.older")} disabled={!open.includes(older + 1)} onClick={() => onStep(1)}>
          <Plus size={20} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
      {does === "" ? null : (
        <p className="mt-2 text-center text-[12.5px] leading-snug text-text-2" data-age-does>
          {does}
        </p>
      )}
    </section>
  );
}

/** One life on the desk's grid: its thing on the tint of its kind, its name and its tag. */
function LifeTile({ tile, on, at, onPick }: { tile: Archetype; on: boolean; at: number; onPick: () => void }) {
  const thing = LIFE_THINGS[tile.id];
  return (
    <button
      type="button"
      role="radio"
      data-archetype={tile.id}
      aria-label={say(`prologue.archetype.${tile.id}.name`)}
      aria-description={say(`prologue.archetype.${tile.id}.opens`)}
      aria-checked={on}
      onClick={onPick}
      className="desk-life door-card"
      style={{ rotate: on ? "-1.5deg" : at % 2 === 0 ? "0.6deg" : "-0.6deg" }}
    >
      <span className={`desk-life-thing ${TINTS[thing.tint]}`} aria-hidden>
        <ModelPicture model={thing.tile} size={46} />
      </span>
      <span>
        <b data-tile-name>
          {say(`prologue.archetype.${tile.id}.name`)}
        </b>
        <span className="sticker-chip desk-tag" data-tile-tag>
          {say(`ui.door.tag.${tile.id}`)}
        </span>
      </span>
    </button>
  );
}

/** Every life at once, for the desk: a two-column grid of tiles, the picked one ringed and tilted. */
export function LifeGrid({ picked, onPick }: { picked: Archetype | null; onPick: (archetype: Archetype) => void }) {
  return (
    <div className="desk-lives" role="radiogroup" aria-label={say("ui.door.life")} data-archetypes data-lives-grid data-columns={2}>
      {ARCHETYPES.map((tile, at) => (
        <LifeTile key={tile.id} tile={tile} at={at} on={tile.id === picked?.id} onPick={() => onPick(tile)} />
      ))}
    </div>
  );
}
