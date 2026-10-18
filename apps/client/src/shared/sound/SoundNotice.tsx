// The game's one small notice (docs/design/05-audio.md, section 7): a corner of the screen,
// never over the question or the answers, never needing to be closed, gone by itself after a few
// seconds, at most once a scene. Read out to screen readers without taking the focus.
import { Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { clearNotice, NOTICE_MS, type NoticeCase, tapNotice } from "./sound";
import { soundWords } from "./sound.words";
import { useSound } from "./useSound";

const ICONS: Record<NoticeCase, typeof Volume2 | null> = { on: Volume2, blocked: VolumeX, saver: VolumeX, unsupported: null };

function Body({ which }: { which: NoticeCase }) {
  const Icon = ICONS[which];
  const words = soundWords(`sound.notice.${which}`);
  const content = (
    <>
      {Icon === null ? null : <Icon size={16} aria-hidden className="shrink-0" />}
      <span>{words}</span>
      {which === "on" ? <VolumeX size={16} aria-label={soundWords("sound.notice.on.action")} className="shrink-0 opacity-70" /> : null}
    </>
  );
  const box = "pointer-events-auto flex items-center gap-2 rounded-[4px] border border-sheet-line bg-sheet-2 px-3 py-1.5 text-sm shadow-lg";
  if (which === "unsupported") return <p className={box}>{content}</p>;
  return (
    <button type="button" className={`${box} min-h-9 hover:bg-sheet-muted focus-visible:outline-2 focus-visible:outline-ink`} onClick={() => tapNotice(which)}>
      {content}
    </button>
  );
}

export function SoundNotice() {
  const notice = useSound((state) => state.notice);
  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => clearNotice(notice.id), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  if (typeof document === "undefined") return null;
  return createPortal(
    // Top right, below the safe area: the scenes keep their question and answers clear of it.
    <div role="status" aria-live="polite" data-sound-notice={notice?.which ?? "none"} className="pointer-events-none fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-50 flex max-w-[min(20rem,calc(100vw-1.5rem))] justify-end">
      {notice === null ? null : <Body key={notice.id} which={notice.which} />}
    </div>,
    document.body,
  );
}
