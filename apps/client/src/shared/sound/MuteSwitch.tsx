// The mute switch: remembered on the device, no volume slider, since phones do not let a page
// set the volume. Muted, nothing is fetched (docs/design/06-audio.md, section 7).
import { Volume2, VolumeX } from "lucide-react";

import { setMuted } from "./sound";
import { soundWords } from "./sound.words";
import { useSound } from "./useSound";

export function MuteSwitch() {
  const muted = useSound((state) => state.muted);
  const label = soundWords(muted ? "sound.unmute" : "sound.mute");
  return (
    <button
      type="button"
      aria-pressed={muted}
      aria-label={label}
      title={label}
      data-muted={muted}
      onClick={() => setMuted(!muted)}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-sheet-line text-ink hover:bg-sheet-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {muted ? <VolumeX size={20} aria-hidden /> : <Volume2 size={20} aria-hidden />}
    </button>
  );
}
