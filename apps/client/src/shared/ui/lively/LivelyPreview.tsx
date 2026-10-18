// The lively layer's preview (development only, `?lively` at the boot; decision 0025): every primitive in both paints,
// side by side on a laptop and one after the other on a phone, with sample words in the game's voice. Each paint is a
// panel carrying data-paint, so the night's tokens hold inside it whatever the clock says. A tap on the motion and sound
// chips plays each answer. Nothing here is shown to a player.
import { useEffect, useRef, useState } from "react";

import { type Cue, cue } from "../../sound/cues";
import type { Paint } from "../../world/paint";
import { Face } from "./Face";
import { LivelyCard } from "./LivelyCard";
import { LivelySheet } from "./LivelySheet";
import { Pill } from "./Pill";
import { PressButton } from "./PressButton";
import { Sticker } from "./Sticker";
import { StickerChip } from "./StickerChip";
import type { Tint } from "./tint";

export function LivelyPreview() {
  return (
    <main className="min-h-dvh bg-device p-3 font-sans lg:p-5" data-lively-preview>
      <div className="mx-auto grid max-w-[1200px] gap-3 lg:grid-cols-2 lg:gap-5">
        <PaintPanel paint="day" />
        <PaintPanel paint="night" />
      </div>
    </main>
  );
}

/** The price on a card that is itself the tap: a yellow pill with the action's underside, and the balance before and after. */
function Price({ price, before, after }: { price: string; before?: string; after?: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="num rounded-[12px] border-2 border-action-under bg-action px-3 py-0.5 text-[16px] font-bold text-action-text shadow-[0_3px_0_var(--action-under)]">{price}</span>
      {before === undefined || after === undefined ? (
        <span className="text-chip text-text-2">No cost</span>
      ) : (
        <span className="num text-chip text-text-2">
          <s>{before}</s> → <b className="text-text">{after}</b>
        </span>
      )}
    </div>
  );
}

function PreviewCard({ emoji, alt, tint, title, line, chips, price, before, after }: { emoji: string; alt: string; tint: Tint; title: string; line: string; chips: readonly { words: string; tint?: Tint }[]; price: string; before?: string; after?: string }) {
  return (
    <LivelyCard className="press flex flex-col gap-1.5 p-2.5">
      <div className="flex h-[76px] items-center justify-center rounded-[14px] bg-tint-plain">
        <Sticker emoji={emoji} alt={alt} size={42} tint={tint} />
      </div>
      <p className="text-body leading-tight font-bold">{title}</p>
      <p className="truncate text-[14px] text-text-2">{line}</p>
      <div className="flex flex-wrap gap-1.5 py-1">
        {chips.map((chip, index) => (
          <StickerChip key={chip.words} {...(chip.tint === undefined ? {} : { tint: chip.tint })} tilt={index % 2 === 0 ? -2 : 2}>
            {chip.words}
          </StickerChip>
        ))}
      </div>
      <Price price={price} {...(before === undefined ? {} : { before })} {...(after === undefined ? {} : { after })} />
    </LivelyCard>
  );
}

const SOUNDS: readonly { cue: Cue; words: string }[] = [
  { cue: "tap", words: "Tap" },
  { cue: "ding", words: "Ding" },
  { cue: "thud", words: "Thud" },
  { cue: "no", words: "No" },
];

function PaintPanel({ paint }: { paint: Paint }) {
  const stage = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [wobble, setWobble] = useState(0);
  const [popped, setPopped] = useState(0);
  const [shaken, setShaken] = useState(0);
  // The sheet is drawn into its stage, which exists only once the panel is on the page.
  useEffect(() => setReady(true), []);
  return (
    <section data-paint={paint} data-preview-paint className="flex min-w-0 flex-col gap-3.5 rounded-[24px] bg-sheet p-4 text-text" aria-label={paint === "day" ? "Day" : "Night"}>
      <div className="flex items-center justify-between gap-2">
        <Pill>{paint === "day" ? "☀️ Afternoon" : "🌙 Night"}</Pill>
        <span className="num rounded-[14px] bg-tint-money px-3 py-1 text-title font-bold">₦48,500</span>
      </div>

      <div className="flex items-center gap-3.5">
        <Sticker key={`wobble-${String(wobble)}`} emoji="📚" alt="Books" size={46} tilt={-6} className={wobble > 0 ? "wobble-in" : ""} />
        <div className="min-w-0 flex-1">
          <p className="text-title font-bold">Your study table</p>
          <p className="truncate text-body text-text-2">One leg shorter. Still works.</p>
        </div>
        <StickerChip tilt={3}>5 things</StickerChip>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Sticker emoji="🍜" alt="Indomie" tint="food" />
        <Sticker emoji="📝" alt="Test practice" tint="study" tilt={4} />
        <Sticker emoji="🍩" alt="Puff-puff to sell" tint="money" tilt={-3} />
        <Sticker emoji="🧽" alt="Wash up" tint="body" tilt={6} />
        <Sticker emoji="🎉" alt="A night out" tint="people" tilt={-4} />
        <Sticker emoji="📱" alt="Recipe video" tint="plain" tilt={3} />
        <Sticker emoji="🍲" alt="Pepper soup" size={56} tilt={-8} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <StickerChip>₦1,500</StickerChip>
        <StickerChip tilt={2}>A morning</StickerChip>
        <StickerChip tint="money">+Belly</StickerChip>
        <StickerChip tint="study" tilt={1}>
          +English
        </StickerChip>
        <StickerChip tint="people" tilt={-1}>
          +Mama
        </StickerChip>
        <span key={`shake-${String(shaken)}`} className={shaken > 0 ? "shake inline-flex" : "inline-flex"}>
          <StickerChip tilt={1}>🔒 Needs a big pot</StickerChip>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Face name="Mama" />
        <Face name="Tunde" />
        <Face name="Ọlá" />
        <span key={`pop-${String(popped)}`} className={popped > 0 ? "pop inline-flex" : "inline-flex"}>
          <Pill>➡️ Papers, abeg</Pill>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <PreviewCard emoji="💻" alt="A laptop" tint="study" title="Online course" line="Certificate loading" chips={[{ words: "Evenings" }, { words: "+Coding", tint: "money" }]} price="₦15,000" before="₦48,500" after="₦33,500" />
        <PreviewCard emoji="🍳" alt="The pot" tint="food" title="Jollof for the house" line="Mama will taste it first" chips={[{ words: "An evening" }, { words: "+Belly", tint: "money" }]} price="Free" />
      </div>

      <PressButton className="w-full">Apply · Junior developer</PressButton>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="press pill" onClick={() => setWobble((count) => count + 1)}>
          Wobble in
        </button>
        <button type="button" className="press pill" onClick={() => setPopped((count) => count + 1)}>
          Pop
        </button>
        <button
          type="button"
          className="press pill"
          onClick={() => {
            setShaken((count) => count + 1);
            cue("no");
          }}
        >
          Shake
        </button>
        {SOUNDS.map((sound) => (
          <button key={sound.cue} type="button" className="press pill" onClick={() => cue(sound.cue)}>
            🔊 {sound.words}
          </button>
        ))}
      </div>

      {/* The sheet's stage: a box of world that holds the sheet as its containing block, so the sheet rises in it. */}
      <div ref={stage} className="relative h-[340px] overflow-hidden rounded-[20px] bg-strong-2 [transform:translateZ(0)]" data-preview-stage>
        {ready ? (
          <LivelySheet open onOpenChange={() => undefined} container={stage} title="The cooking corner" line="Two burners. One works properly." picture={<Sticker emoji="🍳" alt="The cooking corner" size={42} />}>
            <div className="grid grid-cols-2 gap-2.5">
              <LivelyCard className="flex items-center gap-2 p-2">
                <Sticker emoji="🍜" alt="Indomie and egg" size={30} tint="food" />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold">Indomie and egg</p>
                  <p className="num text-chip text-text-2">₦1,500</p>
                </div>
              </LivelyCard>
              <LivelyCard className="flex items-center gap-2 p-2">
                <Sticker emoji="🧽" alt="Wash up" size={30} tint="body" tilt={5} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold">Wash up</p>
                  <p className="text-chip text-text-2">Free</p>
                </div>
              </LivelyCard>
            </div>
          </LivelySheet>
        ) : null}
      </div>
    </section>
  );
}
