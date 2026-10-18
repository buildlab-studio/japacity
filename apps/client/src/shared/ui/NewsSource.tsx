// Where a story is heard, a small icon and a word beside it on News.
// A rumour is marked as a rumour whatever its source, so talk never reads like a changed rule (news:stages-move-forward-only).
import { content, text } from "@japacity/content";
import type { NewsSource, NewsStage } from "@japacity/sim";
import { Ear, Landmark, Newspaper, Radio, UserRound, Users, type LucideIcon } from "lucide-react";

import { say } from "../words/text";

export type SourceKind = NewsSource | "rumour";

const ICONS: Record<SourceKind, LucideIcon> = {
  radio: Radio,
  paper: Newspaper,
  official: Landmark,
  street: Users,
  person: UserRound,
  rumour: Ear,
};

/**
 * Where this stage of a story is heard. A story content does not hold (the clearing of the settlement, the
 * character's own news) is the street's.
 */
export function newsSource(id: string, stage: NewsStage): { kind: SourceKind; word: string } {
  if (stage === "rumour") return { kind: "rumour", word: say("ui.news.source.rumour") };
  const source = content.news[id as keyof typeof content.news]?.source;
  const kind: NewsSource = source === undefined ? "street" : (source[stage] ?? source.announced);
  if (kind === "person") return { kind, word: text[`${id}.${stage}.source`] ?? text[`${id}.announced.source`] ?? say("ui.news.source.street") };
  return { kind, word: say(`ui.news.source.${kind}`) };
}

export function SourceMark({ id, stage }: { id: string; stage: NewsStage }) {
  const { kind, word } = newsSource(id, stage);
  const Icon = ICONS[kind];
  return (
    <span className="inline-flex items-center gap-1" data-source={kind}>
      <Icon size={14} aria-hidden />
      {word}
    </span>
  );
}
