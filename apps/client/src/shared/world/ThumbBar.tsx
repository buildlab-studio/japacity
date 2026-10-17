// The two thumb buttons (docs/rules/world.md R-WORLD-004): Map at the left, Phone at the right,
// a dot on Phone when an app has something new. Both hide while riding and while the results show. As the lively layer
// draws them (docs/design/13-the-lively-layer.md): round white buttons with a picture each, navy at night, no pattern.
// In a wide home a smaller round button stands over Phone with a turning arrow: each tap turns the house a quarter
// round; it steps back while a sheet, the phone, the map or a fan is open.
import type { ReactNode } from "react";

import { CentredColumn } from "../ui/lively/CentredColumn";
import { say } from "../words/text";

export interface ThumbBarProps {
  onMap: () => void;
  onPhone: () => void;
  phoneWaiting: boolean;
  hidden?: boolean;
  /** A wide home: turns the house a quarter round. No button where it is left out. */
  onTurn?: () => void;
  /** The turn button steps back, the thumbs staying, while something is open over the world. */
  turnHidden?: boolean;
}

export function ThumbBar({ onMap, onPhone, phoneWaiting, hidden = false, onTurn, turnHidden = false }: ThumbBarProps) {
  return (
    <nav
      aria-label={say("ui.tabs")}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-[38] px-3 pb-[max(14px,env(safe-area-inset-bottom))] transition-opacity duration-300 ${hidden ? "opacity-0" : ""}`}
      aria-hidden={hidden}
      data-thumb-bar
    >
      {/* On a laptop the thumbs stand at the column's two sides, not the screen's (decision 0025). */}
      <CentredColumn className="flex items-end justify-between">
        <ThumbButton label={say("ui.world.map")} onClick={onMap} id="map">
          <ThumbPicture emoji="🗺️" />
        </ThumbButton>
        {/* The turn button stands over Phone at the bottom right, clear of the first-use labels in the row. */}
        <span className="flex flex-col items-center gap-3">
          {onTurn === undefined ? null : <TurnButton onTurn={onTurn} hidden={hidden || turnHidden} />}
          <ThumbButton label={say("ui.world.phone")} onClick={onPhone} id="phone" dot={phoneWaiting}>
            <ThumbPicture emoji="📱" />
          </ThumbButton>
        </span>
      </CentredColumn>
    </nav>
  );
}

/** The round turn button: a turning arrow round a small house, fading out on opacity alone while it steps back. */
function TurnButton({ onTurn, hidden }: { onTurn: () => void; hidden: boolean }) {
  return (
    <button
      type="button"
      onClick={onTurn}
      aria-label={say("ui.world.other-side")}
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      className={`thumb-round press relative flex size-[48px] items-center justify-center transition-opacity duration-200 ${hidden ? "pointer-events-none opacity-0" : "pointer-events-auto"}`}
      data-turn-house
    >
      <TurnGlyph />
    </button>
  );
}

/** A quarter-turn arrow sweeping round a little house, in the thumbs' ink. */
function TurnGlyph() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden data-turn-glyph>
      <path d="M11 17.5 16 13l5 4.5V22h-10z" fill="var(--signal)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6.5 13.5a10 10 0 0 1 17.2-4.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="m24.9 4.6-.9 5.3-5.2-1.1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25.5 18.5a10 10 0 0 1-17.2 4.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="m7.1 27.4.9-5.3 5.2 1.1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A thumb's picture: a stand-in until the map and the phone have tiles of their own. */
function ThumbPicture({ emoji }: { emoji: string }) {
  return (
    <span className="text-[22px] leading-none" aria-hidden data-thumb-picture>
      {emoji}
    </span>
  );
}

function ThumbButton({ label, onClick, id, dot = false, children }: { label: string; onClick: () => void; id: string; dot?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} data-thumb={id} className="thumb-round press pointer-events-auto relative flex size-[62px] flex-col items-center justify-center gap-px">
      {children}
      <span className="text-[12px] leading-none font-bold">{label}</span>
      {dot ? <span className="pop absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-signal shadow-[0_0_0_2.5px_var(--sheet-2)]" aria-hidden data-dot /> : null}
    </button>
  );
}
