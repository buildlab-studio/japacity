// An act's facts in one of two looks (text:show-then-tell). Chips: tilted sticker pills in a row that wraps, each an icon and
// a few words. Rows: each fact a short line with its icon on a soft square at the left, one under another. Both read the
// same typed facts in the same order, and both take the night's paint from the role tokens alone.
import { ArrowLeftRight, CalendarDays, Clock, Coins, PlaneTakeoff, Receipt, Tag, TriangleAlert } from "lucide-react";
import type { ComponentType } from "react";

import { pageSearch } from "../world/dayClock";
import { type Fact, ordered } from "../words/facts";
import { countsRoutes, countsWords } from "../words/profile";
import { say } from "../words/text";
import { chanceTint, Gauge } from "./ChanceGauge";

export type FactsLook = "chips" | "rows";

/** The look a development build was asked for (`?facts=rows`); the chips otherwise, and always in a build for players. */
export function factsLook(search: string = pageSearch(), dev: boolean = import.meta.env.DEV): FactsLook {
  if (!import.meta.env.DEV || !dev) return "chips";
  return new URLSearchParams(search).get("facts") === "rows" ? "rows" : "chips";
}

/**
 * Whether a development build was asked for a picker's acts as rows with one button (`?picker=rows`); the cards otherwise, and
 * always in a build for players.
 */
export function pickerRows(search: string = pageSearch(), dev: boolean = import.meta.env.DEV): boolean {
  if (!import.meta.env.DEV || !dev) return false;
  return new URLSearchParams(search).get("picker") === "rows";
}

type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean; strokeWidth?: number }>;

const ICONS: Readonly<Record<Exclude<Fact["kind"], "chance">, Icon>> = {
  pay: Coins,
  time: Clock,
  when: CalendarDays,
  bill: Receipt,
  fee: Tag,
  rate: ArrowLeftRight,
  counts: PlaneTakeoff,
  catch: TriangleAlert,
};

/** A fact's words; the chance by its band's word, where it counts by the ways' short names. */
export function factWords(fact: Fact): string {
  switch (fact.kind) {
    case "chance":
      return say(`jobs.chance.${fact.band}`);
    case "counts":
      return countsRoutes(fact.id) ?? "";
    case "pay":
    case "time":
    case "when":
    case "bill":
    case "fee":
    case "rate":
    case "catch":
      return fact.words;
    default: {
      const never: never = fact;
      return never;
    }
  }
}

/** The tint of a fact's chip, or of its square in a row: money green for pay, a bill and where it counts, the chance by its band. */
function tintOf(fact: Fact): string {
  if (fact.kind === "pay" || fact.kind === "counts") return "bg-tint-money";
  if (fact.kind === "chance") return chanceTint(fact.band);
  if (fact.kind === "time") return "bg-tint-study";
  if (fact.kind === "bill" || fact.kind === "fee") return "bg-[var(--soft)]";
  if (fact.kind === "catch") return "bg-tint-body";
  return "bg-sheet-2";
}

/** What a screen reader hears for a fact whose words alone would not say what it is. */
function spokenOf(fact: Fact): string | undefined {
  return fact.kind === "counts" ? (countsWords(fact.id) ?? undefined) : undefined;
}

function FactIcon({ fact, size }: { fact: Fact; size: number }) {
  if (fact.kind === "chance") return <Gauge chance={fact.band} />;
  const Glyph = ICONS[fact.kind];
  return <Glyph size={size} aria-hidden strokeWidth={2.4} className={fact.kind === "pay" || fact.kind === "counts" ? "shrink-0 text-[var(--money-ink)]" : fact.kind === "catch" ? "shrink-0 text-out" : "shrink-0"} />;
}

/** The facts as tilted sticker chips in a row that wraps (look A). */
function Chips({ facts }: { facts: readonly Fact[] }) {
  return (
    <div className="flex flex-wrap gap-2" data-facts="chips">
      {facts.map((fact, index) => {
        const spoken = spokenOf(fact);
        return (
          <span
            key={`${fact.kind}-${String(index)}`}
            className={`sticker-chip chip-wrap text-[13px] ${tintOf(fact)} ${fact.kind === "pay" || fact.kind === "counts" ? "num" : ""}`}
            style={{ rotate: `${index % 2 === 0 ? -1.5 : 1.5}deg`, ...(fact.kind === "pay" || fact.kind === "counts" ? { color: "var(--money-ink)" } : {}) }}
            data-fact={fact.kind}
            {...(spoken === undefined ? {} : { role: "img", "aria-label": spoken, title: spoken })}
          >
            <FactIcon fact={fact} size={14} />
            <span {...(spoken === undefined ? {} : { "aria-hidden": true })}>{factWords(fact)}</span>
          </span>
        );
      })}
    </div>
  );
}

/** The facts as short rows, each with its icon on a soft square at the left (look B). */
function Rows({ facts }: { facts: readonly Fact[] }) {
  return (
    <ul className="flex flex-col" data-facts="rows">
      {facts.map((fact, index) => {
        const spoken = spokenOf(fact);
        return (
          <li key={`${fact.kind}-${String(index)}`} className="flex min-h-10 items-center gap-3 border-b border-sheet-line py-1.5 last:border-b-0" data-fact={fact.kind}>
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ${tintOf(fact)}`}>
              <FactIcon fact={fact} size={17} />
            </span>
            <span
              className={`min-w-0 flex-1 text-[15px] leading-snug font-bold ${fact.kind === "pay" ? "num text-[var(--money-ink)]" : fact.kind === "catch" ? "text-out" : ""}`}
              {...(spoken === undefined ? {} : { role: "img", "aria-label": spoken, title: spoken })}
            >
              {factWords(fact)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The facts as small lines under a choice's name, each with its small icon: rows inside a card that is itself a row. */
function Lines({ facts }: { facts: readonly Fact[] }) {
  return (
    <ul className="flex flex-col gap-1" data-facts="lines">
      {facts.map((fact, index) => {
        const spoken = spokenOf(fact);
        return (
          <li key={`${fact.kind}-${String(index)}`} className={`flex items-center gap-2 text-[14px] leading-snug font-semibold ${fact.kind === "catch" ? "text-out" : ""}`} data-fact={fact.kind}>
            <span className="flex w-4 shrink-0 justify-center">
              <FactIcon fact={fact} size={15} />
            </span>
            <span className="min-w-0 flex-1" {...(spoken === undefined ? {} : { role: "img", "aria-label": spoken, title: spoken })}>
              {factWords(fact)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The facts, in their one order, in the look asked for; `dense` draws rows as small lines. Nothing when there are none. */
export function Facts({ facts, look = factsLook(), dense = false }: { facts: readonly Fact[]; look?: FactsLook; dense?: boolean }) {
  const shown = ordered(facts).filter((fact) => factWords(fact) !== "");
  if (shown.length === 0) return null;
  if (look === "chips") return <Chips facts={shown} />;
  return dense ? <Lines facts={shown} /> : <Rows facts={shown} />;
}
