// The two thumb buttons (docs/rules/world.md R-WORLD-004): Map at the left, Phone at the right,
// a dot on Phone when an app has something new. Both hide while riding and while the results show. As the lively layer
// draws them (docs/design/13-the-lively-layer.md): round white buttons with a picture each, navy at night, no pattern.
import type { ReactNode } from "react";

import { CentredColumn } from "../ui/lively/CentredColumn";
import { say } from "../words/text";

export interface ThumbBarProps {
  onMap: () => void;
  onPhone: () => void;
  phoneWaiting: boolean;
  hidden?: boolean;
}

export function ThumbBar({ onMap, onPhone, phoneWaiting, hidden = false }: ThumbBarProps) {
  return (
    <nav
      aria-label={say("ui.tabs")}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-[38] px-3 pb-[max(14px,env(safe-area-inset-bottom))] transition-opacity duration-300 ${hidden ? "opacity-0" : ""}`}
      aria-hidden={hidden}
      data-thumb-bar
    >
      {/* On a laptop the thumbs stand at the column's two sides, not the screen's (decision 0038). */}
      <CentredColumn className="flex items-end justify-between">
        <ThumbButton label={say("ui.world.map")} onClick={onMap} id="map">
          <ThumbPicture emoji="🗺️" />
        </ThumbButton>
        <ThumbButton label={say("ui.world.phone")} onClick={onPhone} id="phone" dot={phoneWaiting}>
          <ThumbPicture emoji="📱" />
        </ThumbButton>
      </CentredColumn>
    </nav>
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
