// The door's first screen, You (prologue.md R-PROLOGUE-013, 015; the door's second design): you as a big photo card,
// the whole figure standing with a hand on the hip on a sticker with your name stuck on it, a danfo and a travel bag
// slapped on; the name with its dice; the look strip as round face stickers, every look in one strip; and "Make it
// yours" under it, opened on a tap, the figure then drawn in your colours.
import { Check, ChevronDown, Dices } from "lucide-react";
import { useEffect, useState } from "react";

import { NAME_LONGEST, problemWords, type NameProblem } from "../../shared/datapage/name";
import { canDraw } from "../../shared/frontdoor/Gate";
import { FaceSticker, FigurePicture, ModelPicture } from "../../shared/frontdoor/LookPicture";
import { LOOKS } from "../../shared/frontdoor/looks";
import { OwnColoursRows } from "../../shared/frontdoor/OwnColours";
import { isMade, type LookStyle, ownOf, reportOwn } from "../../shared/frontdoor/style";
import type { Tint } from "../../shared/ui/lively/tint";
import { say } from "../../shared/words/text";

/** The face stickers' discs, in turn along the strip. */
const DISCS: readonly Tint[] = ["food", "study", "body", "money", "people", "plain"];

export interface YouProps {
  look: string;
  style: LookStyle | undefined;
  name: string;
  typed: boolean;
  problem: NameProblem | null;
  tried: boolean;
  onName: (name: string) => void;
  onReroll: () => void;
  onLook: (look: string) => void;
  onStyle: (style: LookStyle | undefined) => void;
  onEnter: () => void;
}

/** You, on a photo card: the figure on a warm sky with a sun, your name stuck on its corner. */
function PhotoCard({ look, style, name }: { look: string; style: LookStyle | undefined; name: string }) {
  return (
    // The card gives way on a short screen (a laptop's), so the look strip stays in view over Next.
    <div className="relative mx-auto mt-4 h-[clamp(240px,calc(100dvh-540px),318px)] w-[302px] max-w-[calc(100%-56px)]" data-door-photo>
      <div className="door-card absolute inset-0 rotate-[-2.5deg] p-2.5">
        <div className="door-photo relative h-full overflow-hidden rounded-[14px]">
          <span className="door-sun absolute top-[22px] right-[26px] size-[58px] rounded-full" aria-hidden />
          <FigurePicture look={look} style={style} className="absolute bottom-[-6px] left-1/2 h-[calc(100%+6px)] max-w-none -translate-x-1/2 transition-opacity duration-200" />
        </div>
      </div>
      <span className="sticker-chip absolute bottom-[-14px] left-[14px] z-[2] rounded-[14px]! px-4! py-2! text-[22px]!" style={{ rotate: "3deg" }} data-door-name-chip>
        {name === "" ? say("prologue.page.empty") : name}
      </span>
      <span className="sticker-cut absolute top-[-24px] right-[-30px] z-[2]" style={{ rotate: "9deg" }} aria-hidden>
        <ModelPicture model="veh_danfo" size={92} />
      </span>
      <span className="sticker-cut absolute bottom-[8px] left-[-30px] z-[2]" style={{ rotate: "-10deg" }} aria-hidden>
        <ModelPicture model="prop_travel-bag" size={66} />
      </span>
    </div>
  );
}

export function YouScreen({ look, style, name, typed, problem, tried, onName, onReroll, onLook, onStyle, onEnter }: YouProps) {
  const [yours, setYours] = useState(false);
  // "Make it yours" reads what the look is made of once it is opened, now that no turntable stands on the door.
  useEffect(() => {
    if (!yours || ownOf(look) !== null || !canDraw()) return;
    let alive = true;
    void import("../../shared/datapage/photoRender")
      .then(({ readOwn }) => readOwn(`shared/chr/${look}.glb`))
      .then((own) => {
        if (alive && own !== null) reportOwn(look, own);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [yours, look]);
  return (
    <>
      <PhotoCard look={look} style={style} name={name} />
      <div className="mt-8 px-5">
        <label className="text-[14px] font-bold text-text-2" htmlFor="door-name">
          {say("prologue.door.name.title")}
        </label>
        <div className="mt-2 flex gap-2.5">
          <input
            id="door-name"
            className="h-[54px] min-w-0 flex-1 rounded-[14px] border-2 border-[var(--edge)] bg-sheet-2 px-4 text-[20px] font-bold text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--action)]"
            placeholder={say("prologue.door.name.placeholder")}
            value={name}
            maxLength={NAME_LONGEST + 4}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            aria-invalid={tried && problem !== null}
            onFocus={(event) => {
              if (!typed) event.target.select();
            }}
            onChange={(event) => onName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onEnter();
            }}
          />
          <button type="button" className="round-button size-[54px]! rounded-[14px]!" aria-label={say("ui.door.reroll")} onClick={onReroll} data-door-dice>
            <Dices size={26} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        {tried && problem !== null ? (
          <p role="alert" className="mt-1.5 text-[13px] font-bold text-out">
            {problemWords(problem)}
          </p>
        ) : null}
      </div>
      <section className="mt-5" aria-label={say("ui.door.look")}>
        <h2 className="px-5 text-[14px] font-bold text-text-2">{say("ui.door.look")}</h2>
        <div className="flex gap-3.5 overflow-x-auto px-6 pt-3.5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="radiogroup" aria-label={say("ui.door.look")} data-looks>
          {LOOKS.map((one, index) => {
            const on = one.id === look;
            return (
              <button key={one.id} type="button" role="radio" aria-checked={on} aria-label={say("ui.door.look.one", { n: index + 1 })} data-look={one.id} onClick={() => onLook(one.id)} className="relative shrink-0 rounded-full">
                <FaceSticker look={one.id} size={66} on={on} tilt={index % 2 === 0 ? -3 : 3} tint={DISCS[index % DISCS.length] ?? "plain"} />
                {on ? (
                  <span className="door-tick absolute right-[-6px] bottom-[-4px]" aria-hidden>
                    <Check size={13} strokeWidth={3.2} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
      {/* Your own colours on the look (R-PROLOGUE-015), under the strip, opened on a tap. */}
      <section className="mt-1 px-5 pb-4" data-door-yours>
        <h2>
          <button type="button" className="pill-button h-9! text-[14px]!" aria-expanded={yours} onClick={() => setYours((open) => !open)} data-yours-open>
            {say("ui.door.yours")}
            <ChevronDown size={16} strokeWidth={2.6} className={`transition-transform duration-200 ${yours ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </h2>
        {yours ? (
          <div className="door-card mt-3 px-4 pt-1 pb-4 empty:hidden">
            <OwnColoursRows look={look} style={style} heading={false} onStyle={(next) => onStyle(isMade(next) ? undefined : next)} />
          </div>
        ) : null}
      </section>
    </>
  );
}
