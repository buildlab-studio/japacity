// The share cards: the send-off when chapter 4 closes, and the real-story card
// and the ending after the road (docs/rules/chapter.md and road.md). Sized for
// a phone screenshot, drawn in type and colour only: no generated pictures.
// Every card says in plain sight that Japacity is a game, and is sent by the
// game itself, never dressed as a bank alert or a message from a person.
import { Dialog } from "@base-ui/react/dialog";
import type { PlayerView } from "@japacity/sim";
import { createContext, use, useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { FullScreen } from "../../shared/ui/FullScreen";
import { Card } from "../../shared/ui/Panel";
import { hasWords, nameOf, say, sayCount, words } from "../../shared/words/text";

type Shared = NonNullable<PlayerView["card"]>;

/** True inside the full-screen sheet, where the card's title names the dialog. */
const InDialog = createContext(false);

function CardTitle({ children }: { children: ReactNode }) {
  const className = "font-display text-4xl leading-tight";
  return use(InDialog) ? <Dialog.Title className={className}>{children}</Dialog.Title> : <h2 className={className}>{children}</h2>;
}

/** The stripes of a Lagos bus, as a band of colour. Pure CSS, no image. */
function Stripes() {
  return <div aria-hidden="true" className="h-3 w-full bg-[repeating-linear-gradient(90deg,var(--ink)_0_18px,var(--accent)_18px_36px)]" />;
}

function Footer() {
  return (
    <div className="flex items-end justify-between gap-2 border-t border-current/30 pt-3 text-sm">
      <span className="font-display text-xl leading-none">{say("ui.game")}</span>
      <span className="font-semibold" data-game-line>
        {say("ui.card.is-a-game")}
      </span>
    </div>
  );
}

function SendOff({ card }: { card: Shared }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest uppercase">{say("ui.card.send-off.kicker")}</p>
        <CardTitle>{words("chapter.send-off.title")}</CardTitle>
        <p className="italic">{words("chapter.send-off.close")}</p>
      </div>
      <div className="flex flex-col gap-1">
        {card.route === null ? null : <p className="text-lg font-semibold">{nameOf(card.route)}</p>}
        {card.percent === null ? null : (
          <p className="font-display text-8xl leading-none">
            {card.percent}
            <span className="font-sans text-4xl font-bold">%</span>
          </p>
        )}
        <p className="text-sm">{say("ui.card.japacity")}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="opacity-75">{say("ui.card.months")}</dt>
          <dd className="text-2xl font-bold tabular-nums">{card.months}</dd>
        </div>
        <div>
          <dt className="opacity-75">{say("ui.card.standing")}</dt>
          <dd className="text-2xl font-bold tabular-nums">{card.standing}</dd>
        </div>
      </dl>
      {card.topActivities.length === 0 ? null : (
        <div className="flex flex-col gap-1 text-sm">
          <p className="opacity-75">{say("ui.card.most")}</p>
          <ol className="flex flex-col gap-0.5 font-semibold">
            {card.topActivities.slice(0, 3).map((id) => (
              <li key={id}>{nameOf(id)}</li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

function RealStory() {
  const credits = hasWords("card.real-story.credits") ? words("card.real-story.credits") : null;
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest uppercase">{say("ui.card.real-story.kicker")}</p>
        <CardTitle>{say("ui.card.real-story.title")}</CardTitle>
      </div>
      <p>{hasWords("card.real-story.body") ? words("card.real-story.body") : say("ui.card.real-story.body")}</p>
      {credits === null ? <p className="text-sm opacity-80">{say("ui.card.real-story.credits-later")}</p> : <p className="text-sm">{credits}</p>}
    </>
  );
}

function Lost({ card }: { card: Shared }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest uppercase">{say("ui.card.lost.kicker")}</p>
        <CardTitle>{say("ui.card.lost.title")}</CardTitle>
      </div>
      <p>{sayCount("ui.card.lost.body", card.months, { months: card.months })}</p>
    </>
  );
}

/** One card, laid out at nine by sixteen so a phone screenshot takes all of it. */
export function ShareCardFace({ card }: { card: Shared }) {
  const tone = card.kind === "send-off" ? "bg-accent text-accent-ink" : "bg-paper text-ink";
  return (
    <article
      data-share-card={card.kind}
      className={`flex aspect-[9/16] w-[min(calc(100vw-2rem),24rem)] flex-col justify-between gap-4 overflow-hidden rounded-3xl p-6 shadow-2xl ${tone}`}
    >
      <Stripes />
      {card.kind === "send-off" ? <SendOff card={card} /> : card.kind === "real-story" ? <RealStory /> : <Lost card={card} />}
      <Footer />
    </article>
  );
}

function cardKey(card: Shared | null): string | null {
  return card === null ? null : `${card.kind}-${String(card.months)}`;
}

/**
 * The card when one is due: it opens on its own once any staged moment has
 * passed, and a tile keeps it within reach after it is closed.
 */
export function CardView() {
  const { card } = useView();
  const moments = useGame((state) => state.moments);
  const key = cardKey(card);
  const [closed, setClosed] = useState<string | null>(null);
  const [reopened, setReopened] = useState(false);
  if (card === null || key === null) return null;
  const open = moments.length === 0 && (closed !== key || reopened);
  const close = () => {
    setClosed(key);
    setReopened(false);
  };
  return (
    <>
      <Card tone="attention" className="flex flex-wrap items-center justify-between gap-3" data-card-tile>
        <p className="font-semibold">{say(`ui.card.${card.kind}.ready`)}</p>
        <Button small onClick={() => setReopened(true)}>
          {say("ui.card.open")}
        </Button>
      </Card>
      <FullScreen open={open} onClose={close} title={say(`ui.card.${card.kind}.ready`)}>
        <InDialog value>
          <ShareCardFace card={card} />
        </InDialog>
        <p className="max-w-sm text-center text-sm opacity-80">{say("ui.card.how")}</p>
        <Button variant="secondary" onClick={close}>
          {say("ui.report.close")}
        </Button>
      </FullScreen>
    </>
  );
}
