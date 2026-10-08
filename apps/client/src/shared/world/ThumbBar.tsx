// The two thumb buttons (docs/rules/world.md R-WORLD-004): Map at the left, Phone at the right,
// a dot on Phone when an app has something new. Both hide while riding and while the results show.
import { Map as MapIcon, Smartphone } from "lucide-react";
import type { ReactNode } from "react";

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
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-[38] flex items-end justify-between px-3 pb-[max(14px,env(safe-area-inset-bottom))] transition-opacity duration-300 ${hidden ? "opacity-0" : ""}`}
      aria-hidden={hidden}
      data-thumb-bar
    >
      <ThumbButton label={say("ui.world.map")} onClick={onMap} id="map">
        <MapIcon size={24} />
      </ThumbButton>
      <ThumbButton label={say("ui.world.phone")} onClick={onPhone} id="phone" dot={phoneWaiting}>
        <Smartphone size={24} />
      </ThumbButton>
    </nav>
  );
}

function ThumbButton({ label, onClick, id, dot = false, children }: { label: string; onClick: () => void; id: string; dot?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} data-thumb={id} className="band-2 press pointer-events-auto relative flex size-16 flex-col items-center justify-center gap-0.5 rounded-[6px] shadow-[0_10px_24px_rgba(10,14,30,0.4)]">
      {children}
      <span className="label text-[10px]">{label}</span>
      {dot ? <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full border-2 border-sheet bg-signal" aria-hidden data-dot /> : null}
    </button>
  );
}
