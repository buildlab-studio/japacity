// The phone (docs/design/11-the-world-first.md, section 2b): the home of the support pages, each an
// app with its own screen, opened over the world. One app at a time; the back arrow returns to the
// grid and the close returns to the world. The apps' screens are the features' own, handed in by
// the app shell so this folder never imports another feature.
import { ChevronLeft, X } from "lucide-react";
import { type ReactNode, useState } from "react";

import { cityWords } from "./city.words";

export interface PhoneApp {
  id: string;
  name: string;
  /** The tile's colour, a Tailwind background class. */
  tile: string;
  /** The tile's letter. */
  letter: string;
  screen: ReactNode;
  /** A dot on the tile: something waits inside. */
  waiting?: boolean;
}

export function Phone({ apps, onClose }: { apps: readonly PhoneApp[]; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const app = apps.find((candidate) => candidate.id === open) ?? null;
  return (
    <div className="fixed inset-0 z-[44] flex items-end justify-center bg-ink/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center" data-phone role="dialog" aria-label={cityWords("city.phone")}>
      <div className="flex max-h-[88dvh] w-full max-w-sm flex-col overflow-hidden rounded-[2rem] border-[6px] border-ink bg-paper shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          {app === null ? (
            <span className="flex-1 px-1 text-sm font-semibold text-muted">{cityWords("city.phone")}</span>
          ) : (
            <>
              <button type="button" onClick={() => setOpen(null)} aria-label={cityWords("city.phone.back")} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-sunk">
                <ChevronLeft size={20} />
              </button>
              <h2 className="flex-1 truncate font-display text-lg">{app.name}</h2>
            </>
          )}
          <button type="button" onClick={onClose} aria-label={cityWords("city.close")} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-sunk">
            <X size={18} />
          </button>
        </div>
        {app === null ? (
          <ul className="grid grid-cols-3 gap-4 p-5" aria-label={cityWords("city.phone.apps")}>
            {apps.map((candidate) => (
              <li key={candidate.id} className="flex flex-col items-center gap-1.5">
                <button type="button" onClick={() => setOpen(candidate.id)} data-app={candidate.id} className="relative flex size-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-md" style={undefined}>
                  <span className={`absolute inset-0 rounded-2xl ${candidate.tile}`} aria-hidden />
                  <span className="relative">{candidate.letter}</span>
                  {candidate.waiting === true ? <span className="absolute -top-1 -right-1 size-3.5 rounded-full border-2 border-paper bg-bad" aria-hidden /> : null}
                </button>
                <span className="text-sm font-semibold">{candidate.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="@container min-h-0 flex-1 overflow-y-auto p-4" data-app-screen={app.id}>
            {app.screen}
          </div>
        )}
      </div>
    </div>
  );
}
