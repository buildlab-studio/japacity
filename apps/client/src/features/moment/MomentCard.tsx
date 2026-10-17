// The screenshot moment (docs/rules/moments.md): one clean card over the scene for a big outcome, the kind of screen
// a player posts. The design's panel: a band head with the icon tile, the kicker and the title; one line large
// enough to read in a cropped screenshot; the figure that makes it land; and the game's small mark with its address
// in the corner, so every screenshot carries the game's name. A win is drawn light, a loss dark. One tap anywhere, or
// Close, dismisses it, and the sheet under it is as it was (R-MOMENT-006). It is no share card: nothing is drawn to an
// image, offered or sent (R-MOMENT-007).
import { Dialog } from "@base-ui/react/dialog";
import { BanknoteX, BookMarked, Bus, FileX, Luggage, PhoneOff, PiggyBank, PlaneLanding, Ticket, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import type { MomentShot } from "../../authority/store";
import { markFile } from "../../shared/ui/Wordmark";
import { Counter } from "../../shared/world/Band";
import { useSendOffShowing } from "../../shared/world/sendOff";
import { say } from "../../shared/words/text";
import { figureWords, momentFace, type MomentFace, type MomentIcon } from "../../shared/moment/moment";

const ICONS: Record<MomentIcon, LucideIcon> = {
  luggage: Luggage,
  "file-x": FileX,
  "phone-off": PhoneOff,
  "banknote-x": BanknoteX,
  bus: Bus,
  ticket: Ticket,
  "plane-landing": PlaneLanding,
  book: BookMarked,
  "piggy-bank": PiggyBank,
};

export { markFile };

/**
 * R-MOMENT-003: the figure's size by its length, so the longest sum still sits on one line inside the card at a
 * phone's width, and a short one stands as large as a headline.
 */
export function figureSize(shown: string): number {
  if (shown.length <= 4) return 88;
  if (shown.length <= 7) return 68;
  if (shown.length <= 10) return 54;
  return 44;
}

/** The figure, counting up to itself as the card lands, the way the month's results count what was kept. */
function Figure({ face }: { face: MomentFace }) {
  const [value, setValue] = useState(0);
  useEffect(() => setValue(face.figure.value), [face.figure.value]);
  // Sized for the figure as it lands, so the counting never reflows the card.
  const size = figureSize(figureWords(face.figure, face.figure.value));
  return (
    <div className="flex flex-col items-start" data-moment-figure={face.figure.value}>
      <span className="block leading-[0.95] tracking-[-0.03em]" style={{ fontSize: size }} data-moment-size={size}>
        {/* A frame's clock may start a hair before the count does: the figure never shows under nothing, so never a sign (R-MOMENT-004). */}
        <Counter value={value} format={(shown) => figureWords(face.figure, Math.max(0, shown))} />
      </span>
      <span aria-hidden className="mt-2.5 h-1.5 w-14 rounded-[1px] bg-signal" />
      <span className={`mt-2.5 text-[16px] leading-snug font-semibold ${face.tone === "bad" ? "text-on-strong/75" : "text-text-2"}`} data-moment-caption>
        {face.figure.caption}
      </span>
    </div>
  );
}

/** The card's face: what a screenshot of the moment shows. */
function MomentFaceView({ face }: { face: MomentFace }) {
  const Icon = ICONS[face.icon];
  const dark = face.tone === "bad";
  return (
    <article className={`pop w-full max-w-[380px] overflow-hidden rounded-[6px] shadow-[0_24px_60px_rgba(5,8,20,0.55)] ${dark ? "bg-strong text-on-strong" : "panel"}`} data-moment-card={face.kind} data-moment-tone={face.tone}>
      <header className="band adire relative flex items-center gap-3 px-4 pt-4 pb-3.5 pr-12">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[5px] bg-sheet text-strong">
          <Icon size={26} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <Dialog.Title className="text-[13px] leading-none font-extrabold tracking-[0.14em] uppercase label-strong" data-moment-kicker>
            {face.kicker}
          </Dialog.Title>
          <p className="title mt-1.5 text-[20px] leading-tight" data-moment-title>
            {face.title}
          </p>
        </div>
      </header>
      <div className="px-5 pt-5 pb-5">
        <Dialog.Description className="title text-[27px] leading-[1.13]" data-moment-line>
          {face.line}
        </Dialog.Description>
        <div className="mt-6">
          <Figure face={face} />
        </div>
        {face.chip === null ? null : (
          <p className={`mt-4 inline-flex rounded-[4px] px-2.5 py-1.5 text-[14px] font-bold ${dark ? "bg-on-strong/12 text-on-strong" : "bg-sheet-muted text-text"}`} data-moment-chip>
            {face.chip}
          </p>
        )}
      </div>
      <footer className={`flex items-center gap-2.5 border-t px-5 py-3.5 ${dark ? "border-on-strong/15" : "border-sheet-line"}`} data-moment-sign>
        <img src={markFile(dark ? "dark" : "light")} alt={face.mark} draggable={false} className="size-8 shrink-0" data-moment-mark />
        <span className="text-[17px] leading-none font-extrabold tracking-[-0.01em]" data-moment-address>
          {face.address}
        </span>
      </footer>
    </article>
  );
}

/**
 * The moment card when its turn comes (R-MOMENT-006). `over`: the results sheet it opens over at a month's end (it
 * sits in that sheet's tree, so a tap on it never reaches the sheet), or the world after an act or the draw's letter.
 */
export function MomentCard({ over }: { over: "results" | "world" }) {
  const screens = useGame((state) => state.momentScreen);
  // The store keeps the moments only while a screen stands to show them (R-MOMENT-006).
  useEffect(() => screens(), [screens]);
  const head = useGame((state) => state.momentCards[0] ?? null);
  const next = useGame((state) => state.nextMomentCard);
  const reportOpen = useGame((state) => state.reportOpen);
  const staged = useGame((state) => state.moments.length);
  // The send-off scene covers the world from the gate to the first ride (chapter.md R-CHAPTER-012): the landing's card waits for it.
  const scene = useSendOffShowing();
  // Over the world the staged wins told in the corner pass first; over the results the sheet is already up.
  const turn = scene ? false : over === "results" ? reportOpen : !reportOpen && staged === 0;
  // Each card mounts afresh, so its figure counts up from nothing and never from the card before.
  return head === null ? null : <MomentDialog key={`${head.line.key}:${JSON.stringify(head.line.params)}:${String(head.view.v)}`} shot={head} open={turn} onClose={next} />;
}

function MomentDialog({ shot, open, onClose }: { shot: MomentShot; open: boolean; onClose: () => void }) {
  const face = useMemo(() => momentFace(shot.line, shot.view, shot.before, shot.told), [shot]);
  // Focus lands on the screen itself, so no ring stands on Close in the picture a player takes.
  const screenRef = useRef<HTMLDivElement>(null);
  if (face === null) return null;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        {/* Over the results sheet the card is a nested dialog, whose backdrop shows only when forced: the sheet dims under it too. */}
        <Dialog.Backdrop forceRender className="motion-scrim fixed inset-0 z-[70] bg-device/85 data-closed:pointer-events-none data-ending-style:pointer-events-none" />
        {/* R-MOMENT-006: one tap anywhere dismisses it, the card as much as the dimmed world around it. */}
        <Dialog.Popup
          className="motion-card fixed inset-0 z-[71] flex items-center justify-center overflow-y-auto px-4 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] outline-hidden data-closed:pointer-events-none data-ending-style:pointer-events-none"
          onClick={onClose}
          ref={screenRef}
          initialFocus={screenRef}
          data-moment-screen={face.kind}
        >
          <div className="relative w-full max-w-[380px]">
            <MomentFaceView face={face} />
            <Dialog.Close aria-label={say("moment.close")} className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-[5px] text-on-strong/80">
              <X size={20} aria-hidden />
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
