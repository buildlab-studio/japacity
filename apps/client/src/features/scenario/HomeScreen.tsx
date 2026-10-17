// The door's third screen, Where you live (prologue.md R-PROLOGUE-013; the door's second design: B's stacked postcards over A's
// lower elements, with A's row of homes made small to switch): who you are so far in a strip at the top, its two halves
// the ways back to your look and name and to your life and age; the home picked as the big postcard in front with the
// J's postage stamp carrying the money to start, the other homes stacked behind it; the homes as small picture tiles to
// switch, the pick ringed, a home the life cannot pay for locked with what it is short; the picked home's line and its
// costs as chips; and the self-contain, locked, as the goal. A ready life starts in the family house, so its screen
// shows that home alone. Begin is the screen's one action.
import { Lock } from "lucide-react";

import { type Archetype, type Home, homesFor, moneyDrawn } from "../../shared/frontdoor/archetypes";
import { homeFigures, pocketIn, selfContainReached, selfContainYear, startIn } from "../../shared/frontdoor/homes";
import { homePicture, LIFE_THINGS } from "../../shared/frontdoor/lives";
import { FaceSticker, ModelPicture } from "../../shared/frontdoor/LookPicture";
import { StickerChip } from "../../shared/ui/lively/StickerChip";
import { Mark } from "../../shared/ui/Wordmark";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";

/** What a home shows on the door at an age: the figure, and whether it is what the life starts with, short of, or still needs. */
function homeMoney(archetype: Archetype, years: number, home: Home): { figure: string; kind: "start" | "short" | "needed" } {
  const pocket = pocketIn(archetype, years, home);
  if (pocket < 0) return { figure: formatMoney(-pocket, "NGN"), kind: home === "compound-room" ? "needed" : "short" };
  const start = formatMoney(startIn(archetype, years, home), "NGN");
  return { figure: moneyDrawn(archetype) ? say("ui.door.home.about", { amount: start }) : start, kind: "start" };
}

/** A home's cost line, whole, as content says it. */
function homeCosts(home: Home | "self-contain"): string {
  if (home === "self-contain") return say("ui.door.home.costs.self-contain", { amount: formatMoney(selfContainYear(), "NGN") });
  const { now, monthly, rentYear } = homeFigures(home);
  return say(`ui.door.home.costs.${home}`, { amount: formatMoney(monthly, "NGN"), rent: formatMoney(rentYear ?? 0, "NGN"), movein: formatMoney(now, "NGN") });
}

/** A home's picture: the room as the game draws it, or the model on a soft tile. */
function HomePicture({ home, className = "", size }: { home: Home | "self-contain"; className?: string; size: number }) {
  const picture = homePicture(home);
  if ("src" in picture) return <span className={`block bg-cover ${className}`} style={{ backgroundImage: `url(${picture.src})`, backgroundPosition: "center 55%" }} aria-hidden data-home-picture={home} />;
  return (
    <span className={`flex items-center justify-center bg-tint-study ${className}`} aria-hidden data-home-picture={home}>
      <ModelPicture model={picture.model} size={size} />
    </span>
  );
}

/** The strip at the top: your face, your name and who you are so far; the face goes back to the look, the words to the life. */
export function Board({ look, name, caption, thing, onYou, onLife }: { look: string; name: string; caption: string; thing: string | null; onYou: (() => void) | null; onLife: (() => void) | null }) {
  return (
    <div className="band-pill mx-5 mt-3 flex items-center gap-2.5 py-1.5 pr-3.5 pl-1.5" data-door-board>
      <button type="button" className="shrink-0" aria-label={say("ui.door.edit.you")} onClick={onYou ?? undefined} disabled={onYou === null} data-door-edit="you">
        <FaceSticker look={look} size={40} tint="food" />
      </button>
      <button type="button" className="min-w-0 flex-1 truncate text-left text-[14px] font-bold" aria-label={say("ui.door.edit.life")} onClick={onLife ?? undefined} disabled={onLife === null} data-door-edit="life">
        {name === "" ? say("prologue.page.empty") : name}
        {caption === "" ? null : <span className="font-medium text-text-2"> · {caption}</span>}
      </button>
      {thing === null ? null : (
        <span className="sticker-cut shrink-0" style={{ rotate: "6deg" }} aria-hidden>
          <ModelPicture model={thing} size={38} />
        </span>
      )}
    </div>
  );
}

/** The postage stamp on the postcard in front: the J and the money to start, or what the home is short of. */
function PostageStamp({ figure, word }: { figure: string; word: string }) {
  return (
    <span className="door-stamp absolute top-[-14px] right-[-12px] z-[4] h-[104px] w-[98px]" style={{ rotate: "6deg" }} data-home-stamp>
      <span>
        <Mark ground="light" px={30} />
        <b className="num text-[14px] leading-tight">{figure}</b>
        <i className="text-[12px] font-bold not-italic">{word}</i>
      </span>
    </span>
  );
}

/** The homes as stacked postcards: the one picked in front, the others fanned behind it. */
function Stack({ home, homes, stamp }: { home: Home; homes: readonly Home[]; stamp: { figure: string; word: string } | null }) {
  const behind = homes.filter((one) => one !== home).slice(0, 2);
  return (
    <div className="relative mx-auto mt-5 h-[262px] w-[330px] max-w-[calc(100%-32px)]" data-home-stack={home}>
      {behind.map((one, at) => (
        <div key={one} className="door-postcard absolute top-[18px] h-[200px] w-[230px]" style={at === 0 ? { left: -6, rotate: "-9deg" } : { right: -6, rotate: "8deg" }} data-home-card={one}>
          <HomePicture home={one} size={120} className="h-[150px] rounded-[4px]" />
        </div>
      ))}
      <div key={home} className="door-postcard door-deal absolute top-[6px] left-[16px] right-[16px] z-[3]" style={{ rotate: "-2.5deg" }} data-home-card={home} data-front>
        <HomePicture home={home} size={150} className="h-[168px] rounded-[4px]" />
        <p className="mx-0.5 mt-2.5 text-[17px] leading-tight font-bold" data-home-name>
          {say(`ui.door.home.${home}`)} · {say(`ui.door.home.where.${home}`)}
        </p>
        {stamp === null ? null : <PostageStamp figure={stamp.figure} word={stamp.word} />}
      </div>
    </div>
  );
}

/** The picked home's line and its costs as chips: the month's living, the rent or the share, what moving in takes. */
function Detail({ home }: { home: Home }) {
  const costs = homeCosts(home);
  return (
    <div className="door-card mx-5 mt-4 px-3.5 py-3" data-home-detail={home}>
      {/* The postcard in front names the home and where it is; the card under it says what it is and what it costs. */}
      <p className="text-[14px] leading-snug text-text-2" data-home-line>
        {say(`ui.door.home.line.${home}`)}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2" role="list" aria-label={costs} data-home-costs>
        {costs.split(" · ").map((part, at) => (
          <span key={part} role="listitem">
            <StickerChip tint={at === 0 ? "money" : "study"} tilt={at % 2 === 0 ? -2 : 2} className="chip-wrap px-2.5! text-[13px]!" >
              {part.charAt(0).toUpperCase() + part.slice(1)}
            </StickerChip>
          </span>
        ))}
      </div>
    </div>
  );
}

/** The self-contain: always shown, locked as the goal with its figure and no action; reached, it says so and stays. */
function Goal({ reached }: { reached: boolean }) {
  return (
    <div className="door-card door-goal mx-5 mt-3.5 flex items-center gap-2.5 py-2 pr-3 pl-2" aria-disabled="true" aria-label={say("ui.door.home.self-contain")} aria-description={say("ui.door.home.said.goal", { amount: formatMoney(selfContainYear(), "NGN") })} data-home="self-contain">
      <span className="sticker-cut shrink-0 opacity-70 grayscale" style={{ rotate: "-4deg" }} aria-hidden>
        <ModelPicture model="bld_laptop-house" size={52} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[15px] font-bold">
          {say("ui.door.home.self-contain")} · {say("ui.door.home.where.self-contain")}
        </span>
        <span className="block truncate text-[12px] text-text-2" data-home-costs>
          {homeCosts("self-contain")}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1" data-home-left="goal">
        <StickerChip tilt={3} className="bg-[var(--soft)]! text-[var(--soft-ink)]!">
          {say("ui.door.home.goal")}
        </StickerChip>
        {reached ? (
          <span className="text-[11px] font-bold text-text-2" data-home-reached>
            {say("ui.door.home.reached")}
          </span>
        ) : null}
      </span>
      <span className="round-button size-8! shadow-none!" aria-hidden>
        <Lock size={15} strokeWidth={2.6} />
      </span>
    </div>
  );
}

export interface HomeProps {
  archetype: Archetype;
  years: number;
  home: Home;
  onHome: (home: Home) => void;
}

/** Where you live for a tile: the stack, the homes to switch, the picked one's detail and the goal. */
export function HomeRow({ archetype, years, home, onHome }: HomeProps) {
  const offered = homesFor(archetype);
  const money = homeMoney(archetype, years, home);
  return (
    <section aria-label={say("ui.door.home")} data-door-home>
      <Stack home={home} homes={offered} stamp={{ figure: money.figure, word: say(`ui.door.home.${money.kind}`) }} />
      <div className={`mx-4 mt-1 grid gap-2 ${offered.length > 3 ? "grid-cols-4" : "grid-cols-3"}`} role="radiogroup" aria-label={say("ui.door.home")}>
        {offered.map((one, at) => {
          const on = one === home;
          const shown = homeMoney(archetype, years, one);
          const shut = shown.kind !== "start";
          const { monthly } = homeFigures(one);
          return (
            <button
              key={one}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={say(`ui.door.home.${one}`)}
              aria-description={say(shut ? `ui.door.home.said.${shown.kind}` : "ui.door.home.said.start", { amount: shown.figure, monthly: formatMoney(monthly, "NGN") })}
              disabled={shut}
              data-home={one}
              onClick={() => onHome(one)}
              className="door-home relative rounded-[10px] bg-sheet-2 p-1.5 pb-2 text-left shadow-[0_0_0_1.5px_var(--sheet-line),0_4px_8px_rgba(20,40,50,0.12)] disabled:opacity-70"
              style={{ rotate: on ? "0deg" : at % 2 === 0 ? "-2deg" : "2deg" }}
            >
              <HomePicture home={one} size={56} className="h-[58px] rounded-[6px]" />
              <span className="mx-0.5 mt-1.5 block min-h-[28px] text-[12px] leading-tight font-bold">{say(`ui.door.home.${one}`)}</span>
              <span className="mx-0.5 mt-1 block leading-tight" data-home-left={shown.kind}>
                <b className="num block text-[13px]">{shown.figure}</b>
                <i className="block text-[11px] font-medium text-text-2 not-italic">{say(`ui.door.home.${shown.kind}`)}</i>
              </span>
              {shut ? (
                <span className="round-button absolute top-1 right-1 size-6! shadow-none!" aria-hidden>
                  <Lock size={12} strokeWidth={2.8} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <Detail home={home} />
      <Goal reached={selfContainReached(archetype, years)} />
    </section>
  );
}

/** Where a ready life starts: the family house alone, as every fixed life does (home.md). */
export function ReadyHome({ home }: { home: Home }) {
  return (
    <section aria-label={say("ui.door.home")} data-door-home-ready>
      <Stack home={home} homes={[home]} stamp={null} />
      <p className="mx-5 mt-2 text-[14px] font-bold" data-page-home={home}>
        {say(`ui.page.home.${home}`)}
      </p>
    </section>
  );
}

/** A life's thing for the strip at the top, or none for a ready life. */
export function thingOf(archetype: Archetype | null): string | null {
  return archetype === null ? null : LIFE_THINGS[archetype.id].tile;
}
