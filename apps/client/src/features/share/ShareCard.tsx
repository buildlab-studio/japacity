// The share cards (docs/rules/share.md, chapter:send-off-card-on-close, road.md):
// one for each moment the view carries. On screen the card is type and colour;
// the image that travels adds the kind's composed art (shared/share). Every card
// says in plain sight that Japacity is a game, is sent by the game itself, and
// is offered, never sent: nothing leaves the device until the player taps.
import { Dialog } from "@base-ui/react/dialog";
import type { JapaType, ShareKind } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { counting } from "../../shared/analytics/start";
import type { Encoded } from "../../shared/share/encode";
import { bandName, cardFace, type CardFace, type ShareCard } from "../../shared/share/face";
import { renderCard, renderStub } from "../../shared/share/render";
import { stubFace, type StubFace } from "../../shared/share/stub";
import { browserDevice, canShareFiles, sendCard, type Device } from "../../shared/share/travel";
import { Button } from "../../shared/ui/Button";
import { FullScreen } from "../../shared/ui/FullScreen";
import { Seal } from "../../shared/ui/Wordmark";
import { Card } from "../../shared/ui/Panel";
import { cardKey, useCardsTurn } from "../../shared/ui/stage";
import { type Seat, useSeat, useSendOffSaved, useSendOffShowing } from "../../shared/world/sendOff";
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
        <span className="flex items-center gap-2">
          <Seal ground="light" px={32} />
          <span className="font-sans text-xl leading-none font-black" data-word-mark>
            {face.sender}
          </span>
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
    // Grown to its longest word and never below it, so a place name ("United Kingdom") wraps between words, not inside one.
    <div className="flex flex-1 basis-[40%] flex-col">
      <span className="text-[0.6875rem] font-bold tracking-widest opacity-75">{label.toUpperCase()}</span>
      <span className="text-lg leading-tight font-black">{children}</span>
    </div>
  );
}

/** The send-off's ticket stub on screen (share:card-contents): the same words the drawn stub carries, laid out as a ticket. */
function StubCardFace({ face }: { face: StubFace }) {
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
          <div className="flex flex-wrap gap-x-3 gap-y-2">
            <StubField label={face.labels.from}>{face.fields.from}</StubField>
            <StubField label={face.labels.to}>
              {face.fields.to}
              {face.seat === null ? null : (
                <span className="block text-sm font-bold opacity-75" data-stub-seat>
                  {face.seat}
                </span>
              )}
            </StubField>
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
 * The share button under a card (share:card-offered-never-sent, share:card-drawn-on-device): hands the drawn
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
    // analytics:client-sends-interface-counts: pressed, and completed once the card was shared or saved.
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
 * The card named as the band names the character (share:card-contents), read from the card's face (`bandName`), the
 * one source the send-off scene reads too, so the band and the card never name the character two ways.
 */
function bandNamed(card: ShareCard): ShareCard {
  if ((card.name ?? "").trim() !== "") return card;
  const name = bandName();
  return name === null ? card : { ...card, name };
}

/**
 * A card with its share button; at the send-off, the card and the ticket stub side by side to pick from
 * (share:cards-due-at-set-moments: the stub is due beside the send-off card, and the player picks which to share). Given a `foot` (the
 * screenshot's hint and Close over the dimmed world), the share button stands with it on a ground of its own, never
 * printed over what lies under the dim, such as the phone's icons.
 */
function CardToShare({ card: due, scenario, type, seat = null, foot = null, note = null }: { card: ShareCard; scenario: Id<"scenario">; type: JapaType | null; seat?: Seat | null; foot?: ReactNode; note?: ReactNode }) {
  const [picked, setPicked] = useState<"card" | "stub">("card");
  const card = bandNamed(due);
  const stub = stubFace(card, scenario, type, seat);
  const share = <ShareButton card={card} scenario={scenario} stub={stub !== null && picked === "stub" ? stub : null} />;
  const footed =
    foot === null ? (
      share
    ) : (
      <div className="sticky bottom-0 flex w-full max-w-[24rem] flex-col items-center gap-2 rounded-[16px] bg-sheet p-3 text-text shadow-2xl" data-card-foot>
        {/* The share and Close side by side, the hint under them: a short foot, so the card and its picker keep the screen. */}
        <div className="flex w-full items-start justify-center gap-3">
          {share}
          {foot}
        </div>
        {note}
      </div>
    );
  if (stub === null) {
    return (
      <>
        <ShareCardFace card={card} scenario={scenario} />
        {footed}
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
      {footed}
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
            <CardToShare card={shown.card} scenario={scenario} type={shown.type ?? null} seat={shown.seat ?? null} />
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
  // Read when the send-off is due, kept with its card when it closes (decision 0024).
  const type = japaTypeOf(view);
  const seat = useSeat();
  const scene = useSendOffShowing();
  const saved = useSendOffSaved();
  // share:send-off-card-kept: the send-off card is no screen of its own. It is saved as the first ride says so, or at once when no scene
  // shows it (a life reopened after the plane), and from then it is reached where the phone keeps the cards (Keepsake).
  const sendOff = card?.kind === "send-off";
  useEffect(() => {
    if (!sendOff || card === null || key === null || closed === key || (scene && !saved)) return;
    closeCard(key);
    gallery.getState().keep(scenario, card, type, seat);
  }, [sendOff, card, key, closed, scene, saved, scenario, type, seat, closeCard]);
  // moment:card-shows-when-outcome-lands: a chapter's close its moment card told is not told a third time;
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
  const open = turn && !scene && (sendOff ? reopened : closed !== key || reopened);
  const close = () => {
    closeCard(key);
    gallery.getState().keep(scenario, card, type, sendOff ? seat : null);
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
      <CardScreen open={open} onClose={close} card={card} scenario={scenario} type={type} seat={sendOff ? (keptSeat(kept, key) ?? seat) : null} />
    </>
  );
}

/** The seat kept with a send-off card in the gallery, or null. */
function keptSeat(kept: readonly Kept[], key: string): Seat | null {
  return kept.find((entry) => entry.key === key)?.seat ?? null;
}

/** The card full screen over the dimmed world, with its share, the screenshot hint and Close. */
function CardScreen({ open, onClose, card, scenario, type, seat }: { open: boolean; onClose: () => void; card: ShareCard; scenario: Id<"scenario">; type: JapaType | null; seat: Seat | null }) {
  return (
    <FullScreen open={open} onClose={onClose} title={say(`share.${card.kind}.ready`)} tone="over">
      {/* world:world-fills-the-screen: one tap on the dimmed world dismisses the moment; the face and its buttons keep their taps. */}
      <button type="button" aria-label={say("ui.card.dismiss")} onClick={onClose} className="absolute inset-0 cursor-default" data-card-scrim />
      {/* The face, its picker and its foot scroll inside the screen's height, so on a short screen nothing stands above the
          top edge out of reach, the foot held at the bottom. */}
      <div className="relative flex max-h-full w-full flex-col items-center gap-3 overflow-y-auto overscroll-contain" onClick={(event) => event.stopPropagation()} data-card-screen>
        <InDialog value>
          <CardToShare
            card={card}
            scenario={scenario}
            type={type}
            seat={seat}
            foot={
              <Button variant="secondary" onClick={onClose}>
                {say("ui.report.close")}
              </Button>
            }
            note={<p className="text-center text-sm leading-snug text-text-2">{say("ui.card.how")}</p>}
          />
        </InDialog>
      </div>
    </FullScreen>
  );
}

/**
 * The send-off card where the phone keeps the player's cards (share:send-off-card-kept): from the first ride until the card's
 * time ends (the first month abroad), a tile on the phone's home with Open the card, the share of share:card-drawn-on-device unchanged and
 * the stub carrying the seat the counter gave. Nothing while the scene still shows, or before the card is due.
 */
export function Keepsake() {
  const view = useView();
  const { card, scenario } = view;
  const kept = useKept(scenario, view.month);
  const seat = useSeat();
  const scene = useSendOffShowing();
  const [open, setOpen] = useState(false);
  const key = cardKey(card);
  if (card?.kind !== "send-off" || key === null || scene) return null;
  return (
    <div className="phone-notice mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 p-3" data-keepsake>
      <p className="font-semibold">{say("share.send-off.ready")}</p>
      <Button small onClick={() => setOpen(true)} data-keepsake-open>
        {say("ui.card.open")}
      </Button>
      <CardScreen open={open} onClose={() => setOpen(false)} card={card} scenario={scenario} type={japaTypeOf(view)} seat={keptSeat(kept, key) ?? seat} />
    </div>
  );
}
