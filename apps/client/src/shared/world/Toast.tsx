// A short line that lands over the scene after something happens, then goes (R-WORLD-017's arrival,
// a thing done). One at a time; a new one replaces the last.
import { useEffect, useState } from "react";

export const TOAST_MS = 2600;

/** The toast's state: call `show` with words; the component clears itself. */
export function useToast(): { words: string | null; show: (words: string) => void } {
  const [words, setWords] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (words === null) return;
    const timer = window.setTimeout(() => setWords(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [words, at]);
  return {
    words,
    show: (next) => {
      setWords(next);
      setAt(performance.now());
    },
  };
}

export function Toast({ words }: { words: string | null }) {
  if (words === null) return null;
  return (
    <div key={words} className="pop pointer-events-none fixed inset-x-0 bottom-[calc(max(14px,env(safe-area-inset-bottom))+124px)] z-[45] flex justify-center px-6" role="status" data-toast>
      <div className="band rounded-[6px] px-4 py-2.5 text-center text-[15px] font-bold shadow-xl">{words}</div>
    </div>
  );
}
