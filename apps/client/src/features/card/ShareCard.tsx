// The share cards (docs/rules/share.md, chapter.md R-CHAPTER-006, road.md):
// one for each moment the view carries. On screen the card is type and colour;
// the image that travels adds the kind's composed art (shared/card). Every card
// says in plain sight that Japacity is a game, is sent by the game itself, and
// is offered, never sent: nothing leaves the device until the player taps.
import { Dialog } from "@base-ui/react/dialog";
import type { JapaType, ShareKind } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { counting } from "../../shared/analytics/start";
import type { Encoded } from "../../shared/card/encode";
import { cardFace, type CardFace, type ShareCard } from "../../shared/card/face";
import { renderCard, renderStub } from "../../shared/card/render";
import { stubFace, type StubFace } from "../../shared/card/stub";
import { browserDevice, canShareFiles, sendCard, type Device } from "../../shared/card/travel";
import { Button } from "../../shared/ui/Button";
import { FullScreen } from "../../shared/ui/FullScreen";
import { Card } from "../../shared/ui/Panel";
import { cardKey, useCardsTurn } from "../../shared/ui/stage";
import { japaTypeOf } from "../../shared/words/japaType";
import { say } from "../../shared/words/text";
import { gallery, useKept, type Kept } from "./gallery";

/** True inside the full-screen sheet, where the card's title names the dialog. */
const InDialog = createContext(false);

/** The card's title in the plain face, as the word mark: the display caps read hard on a phone. */
function CardTitle({ children }: { children: ReactNode }) {
  const className = "font-sans text-3xl leading-tight font-black";
  return use(InDialog) ? <Dialog.Title className={className}>{children}</Dialog.Title> : <h2 className={className}>{children}</h2>;
}

/** The stripes of a Lagos bus, as a band of colour. Pure CSS, no image. */
function Stripes() {
  return <div aria-hidden="true" className="h-3 w-full shrink-0 bg-[repeating-linear-gradient(90deg,var(--ink)_0_18px,var(--accent)_18px_36px)]" />;
}

function Footer({ face }: { face: Pick<CardFace, "sender" | "disclaimer" | "address" | "officialLine"> }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-current/30 pt-2 text-sm">
      <div className="flex items-end justify-between gap-2">
        <span className="font-sans text-xl leading-none font-black" data-word-mark>
          {face.sender}
        </span>
        <span className="font-semibold" data-game-line>
          {face.disclaimer}
        </span>
      </div>
      <span className="text-xs leading-tight">{face.address}</span>
      <span className="text-[0.6875rem] leading-tight">{face.officialLine}</span>
    </div>
  );
}

function Figures({ face }: { face: CardFace }) {
  return (
    <>
      {face.chapter === null ? null : <p className="font-semibold">{face.chapter}</p>}
      {face.name === null && face.route === null && face.percent === null ? null : (
        <div className="flex flex-col gap-0.5">
          {face.name === null ? null : <p className="font-bold" data-card-name>{face.name}</p>}
          {face.route === null ? null : <p className="text-sm font-semibold">{face.route}</p>}
          {face.percent === null ? null : (
            <>
              {/* Tabular digits, not the display face: its zero reads as a bag. */}
              <p className="num text-6xl leading-none">
                {face.percent}
                <span className="font-sans text-3xl font-bold">%</span>
              </p>
              <p className="text-xs">{face.percentLabel}</p>
            </>
          )}
        </div>
      )}
      {face.stats === null ? null : (
        <dl className="flex flex-col gap-1.5 text-xs">
          <div>
            <dt className="opacity-75">{face.monthsLabel}</dt>
            <dd className="text-base leading-snug font-bold">{face.stats.months}</dd>
          </div>
          <div>
            <dt className="opacity-75">{face.standingLabel}</dt>
            <dd className="text-base leading-snug font-bold">{face.stats.standing}</dd>
          </div>
        </dl>
      )}
      {face.most.length === 0 ? null : (
        <div className="flex flex-col gap-0.5 text-xs">
          <p className="opacity-75">{face.mostLabel}</p>
          <ol className="flex flex-col gap-0.5 font-semibold">
            {face.most.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

const TONES: Record<ShareKind, string> = {
  "send-off": "bg-accent text-accent-ink",
  "real-story": "bg-sheet text-ink",
  lost: "bg-sheet text-ink",
  chapter: "bg-sheet text-ink",
  granted: "bg-sheet text-ink",
  "first-pay-abroad": "bg-sheet text-ink",
  secured: "bg-sheet text-ink",
  december: "bg-sheet text-ink",
  "draw-win": "bg-sheet text-ink",
};

/** One card, laid out at nine by sixteen so it reads as the image it makes. Without a scenario it names no character. */
export function ShareCardFace({ card, scenario = null }: { card: ShareCard; scenario?: Id<"scenario"> | null }) {
  const face = cardFace(card, scenario);
  return (
    <article
      data-share-card={card.kind}
      className={`flex aspect-[9/16] w-[min(calc(100vw-2rem),24rem)] flex-col justify-between gap-3 overflow-hidden rounded-md p-5 shadow-2xl ${TONES[card.kind]}`}
    >
      <Stripes />
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-widest uppercase">{face.kicker}</p>
        <CardTitle>{face.title}</CardTitle>
      </div>
      <Figures face={face} />
      {face.body === null ? null : <p className={card.kind === "send-off" ? "text-sm italic" : "text-sm"}>{face.body}</p>}
      {face.credits.length === 0 ? null : (
        <ul className="flex flex-col gap-0.5 text-xs opacity-80" data-credits>
          {face.credits.map((credit) => (
            <li key={credit}>{credit}</li>
          ))}
        </ul>
      )}
      <Footer face={face} />
    </article>
  );
}

/** One field of the stub: its name small, its value large. */
function StubField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[0.6875rem] font-bold tracking-widest opacity-75">{label.toUpperCase()}</span>
      <span className="text-lg leading-tight font-black break-words">{children}</span>
    </div>
  );
}

/** The send-off's ticket stub on screen (R-SHARE-004): the same words the drawn stub carries, laid out as a ticket. */
export function StubCardFace({ face }: { face: StubFace }) {
  return (
    <article data-share-card="stub" className="flex w-[min(calc(100vw-2rem),36rem)] flex-col gap-3 rounded-md bg-accent p-3 text-accent-ink shadow-2xl">
      <div className="flex flex-wrap rounded-md bg-sheet text-ink">
        <div className="flex min-w-0 flex-[3] flex-col gap-2 p-3">
          <p className="text-xs font-bold">{face.kicker}</p>
          {face.name === null ? null : (
            <p className="font-sans text-2xl leading-none font-black" data-card-name>
              {face.name}
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <StubField label={face.labels.from}>{face.fields.from}</StubField>
            <StubField label={face.labels.to}>{face.fields.to}</StubField>
            <StubField label={face.labels.months}>{face.fields.months}</StubField>
            {face.fields.japacity === null ? null : <StubField label={face.labels.japacity}>{`${face.fields.japacity}%`}</StubField>}
          </div>
        </div>
        {face.type === null ? null : (
          <div className="flex min-w-[9rem] flex-[2] flex-col gap-1.5 border-l-2 border-dashed border-ink/30 p-3" data-type-badge>
            <p className="text-[0.6875rem] font-bold tracking-widest opacity-75">{face.type.label.toUpperCase()}</p>
            <p className="rounded-md bg-accent px-2 py-1.5 text-base leading-tight font-black text-accent-ink">{face.type.name}</p>
            <p className="text-xs">{face.type.line}</p>
          </div>
        )}
      </div>
      <Footer face={face} />
    </article>
  );
}

type Status = "idle" | "making" | "shared" | "saved" | "cancelled" | "failed";

const STATUS_WORDS: Record<Exclude<Status, "idle" | "cancelled">, string> = {
  making: "share.making",
  shared: "share.done.shared",
  saved: "share.done.saved",
  failed: "share.failed",
};

/**
 * The share button under a card (R-SHARE-003, R-SHARE-009): hands the drawn
 * image to the share sheet, or saves it where there is none. Where there is a
 * share sheet the image is drawn as the card opens, because the sheet must be
 * called while the tap still counts.
 */
export function ShareButton({ card, scenario, stub = null, device = browserDevice() }: { card: ShareCard; scenario: Id<"scenario">; stub?: StubFace | null; device?: Device }) {
  const [status, setStatus] = useState<Status>("idle");
  const face = cardFace(card, scenario);
  const sheet = canShareFiles(device);
  const drawn = useRef<Promise<Encoded> | null>(null);
  const key = cardKey(card);
  const render = () => (stub === null ? renderCard(face) : renderStub(stub));
  useEffect(() => {
    drawn.current = sheet && face.shareable ? render().catch((): Encoded => ({ ok: false, reason: "no-image", bytes: 0 })) : null;
    setStatus("idle");
    // The card's key and which of the two is picked name everything drawn, so the faces are not dependencies.
  }, [key, sheet, stub === null]);
  if (!face.shareable) return <p className="max-w-sm text-center text-sm opacity-80">{say("share.not-shareable")}</p>;
  const label = sheet ? say("share.button.share") : say("share.button.save");
  const go = async () => {
    setStatus("making");
    // R-ANALYTICS-002: pressed, and completed once the card was shared or saved.
    counting().count("share/pressed", card.kind);
    try {
      const made = await (drawn.current ?? render());
      const sent = made.ok ? await sendCard(made.blob, card.kind, device) : "failed";
      if (sent === "shared" || sent === "saved") counting().count("share/completed", card.kind);
      setStatus(sent);
    } catch {
      setStatus("failed");
    }
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="primary" disabled={status === "making"} onClick={() => void go()} data-share-button>
        {label}
      </Button>
      {status === "idle" || status === "cancelled" ? null : (
        <p role="status" className="max-w-sm text-center text-sm">
          {say(STATUS_WORDS[status])}
        </p>
      )}
    </div>
  );
}

/**
 * A card with its share button; at the send-off, the card and the ticket stub side by side to pick from
 * (R-SHARE-001: the stub is due beside the send-off card, and the player picks which to share).
 */
function CardToShare({ card, scenario, type }: { card: ShareCard; scenario: Id<"scenario">; type: JapaType | null }) {
  const [picked, setPicked] = useState<"card" | "stub">("card");
  const stub = stubFace(card, scenario, type);
  if (stub === null) {
    return (
      <>
        <ShareCardFace card={card} scenario={scenario} />
        <ShareButton card={card} scenario={scenario} />
      </>
    );
  }
  return (
    <>
      <div role="group" aria-label={say("share.stub.ready")} className="flex gap-2" data-card-pick>
        {(["card", "stub"] as const).map((which) => (
          <Button key={which} small variant={picked === which ? "primary" : "secondary"} aria-pressed={picked === which} onClick={() => setPicked(which)} data-pick={which}>
            {say(`share.stub.pick.${which}`)}
          </Button>
        ))}
      </div>
      {picked === "card" ? <ShareCardFace card={card} scenario={scenario} /> : <StubCardFace face={stub} />}
      <ShareButton card={card} scenario={scenario} stub={picked === "stub" ? stub : null} />
    </>
  );
}

/** The cards had in this life, each to open and share again. */
function GalleryView({ open, onClose, cards, scenario }: { open: boolean; onClose: () => void; cards: Kept[]; scenario: Id<"scenario"> }) {
  const [shown, setShown] = useState<Kept | null>(null);
  const close = () => {
    setShown(null);
    onClose();
  };
  return (
    <FullScreen open={open} onClose={close} title={say("share.gallery.title")}>
      <InDialog value={shown !== null}>
        {shown === null ? (
          <>
            <Dialog.Title className="font-display text-3xl">{say("share.gallery.title")}</Dialog.Title>
            <ul className="flex w-full max-w-sm flex-col gap-2" data-gallery>
              {cards.map((entry) => (
                <li key={entry.key}>
                  <Button className="w-full justify-between" onClick={() => setShown(entry)}>
                    <span>{say(`share.${entry.card.kind}.title`)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <CardToShare card={shown.card} scenario={scenario} type={shown.type ?? null} />
            <Button variant="quiet" onClick={() => setShown(null)}>
              {say("share.gallery.back")}
            </Button>
          </>
        )}
      </InDialog>
      <Button variant="secondary" onClick={close}>
        {say("ui.report.close")}
      </Button>
    </FullScreen>
  );
}

/**
 * The card when one is due: it opens on its own once the staged moments and
 * the month's report have passed, once for each moment, and a tile keeps it
 * within reach after it is closed. Closed cards go to the gallery.
 */
export function CardView() {
  const view = useView();
  const { card, scenario } = view;
  const turn = useCardsTurn();
  const closed = useGame((state) => state.cardClosed);
  const told = useGame((state) => state.cardTold);
  const closeCard = useGame((state) => state.closeCard);
  const kept = useKept(scenario, view.month);
  const key = cardKey(card);
  const [reopened, setReopened] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const others = kept.filter((entry) => entry.key !== key);
  // Read when the send-off is due, kept with its card when it closes (decision 0018).
  const type = japaTypeOf(view);
  // R-MOMENT-006: a chapter's close its moment card told is not told a third time;
  // its card goes to the gallery as a closed one does, without opening.
  useEffect(() => {
    if (card !== null && key !== null && told === key) gallery.getState().keep(scenario, card, type);
  }, [card, key, told, scenario, type]);
  const galleryTile =
    others.length === 0 ? null : (
      <div>
        <Button small variant="quiet" onClick={() => setGalleryOpen(true)} data-gallery-open>
          {say("share.gallery.open")}
        </Button>
        <GalleryView open={galleryOpen} onClose={() => setGalleryOpen(false)} cards={others} scenario={scenario} />
      </div>
    );
  if (card === null || key === null) return galleryTile;
  const open = turn && (closed !== key || reopened);
  const close = () => {
    closeCard(key);
    gallery.getState().keep(scenario, card, type);
    setReopened(false);
  };
  return (
    <>
      <Card tone="attention" className="flex flex-wrap items-center justify-between gap-3" data-card-tile>
        <p className="font-semibold">{say(`share.${card.kind}.ready`)}</p>
        <Button small onClick={() => setReopened(true)}>
          {say("ui.card.open")}
        </Button>
      </Card>
      {galleryTile}
      <FullScreen open={open} onClose={close} title={say(`share.${card.kind}.ready`)} tone="over">
        {/* R-WORLD-001: one tap on the dimmed world dismisses the moment; the face and its buttons keep their taps. */}
        <button type="button" aria-label={say("ui.card.dismiss")} onClick={close} className="absolute inset-0 cursor-default" data-card-scrim />
        <div className="relative flex flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}>
          <InDialog value>
            <CardToShare card={card} scenario={scenario} type={type} />
          </InDialog>
          <p className="max-w-sm text-center text-sm opacity-80">{say("ui.card.how")}</p>
          <Button variant="secondary" onClick={close}>
            {say("ui.report.close")}
          </Button>
        </div>
      </FullScreen>
    </>
  );
}
