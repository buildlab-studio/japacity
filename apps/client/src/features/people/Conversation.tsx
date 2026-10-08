// A pair's conversation in preset phrases (R-PAIR-010, R-PAIR-011): the thread
// from the server's rows with read marks, a phrase with its fill-in from the
// fixed lists, and a refusal said plainly (R-PAIR-013). Nobody types.
import { content } from "@japacity/content";
import type { ConversationRow, Id, SayRefusal } from "@japacity/sim";
import { fillOptions } from "@japacity/sim";
import { Check, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { BlockReport } from "../../shared/moderation/BlockReport";
import type { ServerRejection } from "../../shared/net/contract";
import { conversationPhrases, fillWords, phraseWords } from "../../shared/sim/people";
import { Button } from "../../shared/ui/Button";
import { Tag } from "../../shared/ui/Panel";
import { hasWords, say, sayCount } from "../../shared/words/text";
import type { PairApi } from "./pairApi";

const PHRASES = conversationPhrases();

const SAY_REFUSALS: readonly string[] = ["not-possible", "blocked", "too-many", "region", "not-here", "wrong-place", "bad-fill"] satisfies readonly SayRefusal[];

/** Why a phrase did not go, from the check the code names, and never about the other side's settings. */
function refusalWords(reply: ServerRejection): string {
  if (reply.code === "rate-limited") return reply.retryAfter === undefined ? say("ui.talk.failed.too-many") : sayCount("ui.online.wait", reply.retryAfter, { seconds: reply.retryAfter });
  if (SAY_REFUSALS.includes(reply.code) && hasWords(`ui.talk.failed.${reply.code}`)) return say(`ui.talk.failed.${reply.code}`);
  return say("ui.talk.failed.other", { why: reply.detail });
}

function Row({ row, mine, name }: { row: ConversationRow; mine: boolean; name: string }) {
  const words = phraseWords(row.phrase, row.fill);
  return (
    <li className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`} data-row={row.id}>
      <span className="text-xs text-muted">{mine ? say("ui.talk.you") : name}</span>
      <span className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "bg-ink text-paper" : "border border-line bg-surface"}`}>{words}</span>
      {mine ? (
        row.readAt === null ? null : (
          <span className="flex items-center gap-1 text-xs text-muted">
            <Check size={12} />
            {say("ui.talk.read")}
          </span>
        )
      ) : row.readAt === null ? (
        <Tag tone="accent">{say("ui.talk.unread")}</Tag>
      ) : null}
    </li>
  );
}

/** `name`: the other side as the reader's screen names them, for the report sheet. */
export function Conversation({ api, pair, name }: { api: PairApi; pair: string; name: string }) {
  const id = useId();
  const view = useView();
  const nudges = useGame((state) => state.messageNudges);
  const [rows, setRows] = useState<ConversationRow[]>([]);
  // The other side's character, from the record: their rows are the ones to mark new and to cite.
  const [them, setThem] = useState<string | null>(null);
  const [phraseId, setPhraseId] = useState<Id<"phrase">>(PHRASES[0]?.id ?? "phrase.hello");
  const [fill, setFill] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const phrase = content.phrase[phraseId];
  const fills = phrase === undefined ? [] : fillOptions(phrase, content, view);
  const chosenFill = phrase?.fill === null ? null : fill !== null && fills.includes(fill) ? fill : (fills[0] ?? null);

  const fetchAfter = useCallback(
    async (after: string | null) => {
      try {
        const reply = await api.conversation(pair, after);
        if (!reply.ok) {
          setRefusal(say("ui.talk.failed.other", { why: reply.detail }));
          return;
        }
        setRows((held) => {
          const known = new Set(held.map((row) => row.id));
          return [...held, ...reply.messages.filter((row) => !known.has(row.id))];
        });
      } catch (error) {
        setRefusal(say("ui.talk.failed.other", { why: error instanceof Error ? error.message : String(error) }));
      }
    },
    [api, pair],
  );

  useEffect(() => {
    let live = true;
    void api
      .pair(pair)
      .then((reply) => {
        if (live && reply.ok) setThem(reply.pair.them);
      })
      .catch(() => undefined);
    void fetchAfter(null);
    return () => {
      live = false;
    };
  }, [api, pair, fetchAfter]);

  const last = rows.at(-1)?.id ?? null;
  const thread = useRef<HTMLOListElement>(null);
  // The newest row is the one to read, so the thread opens scrolled to its end.
  useEffect(() => {
    const list = thread.current;
    if (list !== null) list.scrollTop = list.scrollHeight;
  }, [last]);
  const lastRef = useRef(last);
  useEffect(() => {
    lastRef.current = last;
  }, [last]);
  // R-PAIR-011: the server nudged that a row is new; fetch from where the thread left off.
  useEffect(() => {
    if (nudges > 0) void fetchAfter(lastRef.current);
  }, [nudges, fetchAfter]);

  const send = async () => {
    setBusy(true);
    setRefusal(null);
    try {
      const reply = await api.say(pair, phraseId, chosenFill);
      if (reply.ok) setRows((held) => [...held, reply.message]);
      else setRefusal(refusalWords(reply));
    } catch (error) {
      setRefusal(say("ui.talk.failed.other", { why: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  };

  const theirs = rows.filter((row) => them !== null && row.sender === them).map((row) => row.id);
  const mine = (row: ConversationRow) => them !== null && row.sender !== them;

  return (
    <section aria-label={say("ui.talk.title")} className="flex flex-col gap-3 rounded-lg border border-line p-3" data-conversation={pair}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="flex items-center gap-2 font-semibold">
          <MessageCircle size={16} />
          {say("ui.talk.title")}
        </h4>
        <Button small variant="quiet" onClick={() => void fetchAfter(last)}>
          {say("ui.talk.more")}
        </Button>
      </div>
      <p className="text-sm text-muted">{say("ui.talk.help")}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{say("ui.talk.empty")}</p>
      ) : (
        <ol ref={thread} className="flex max-h-72 flex-col gap-2 overflow-y-auto pb-1">
          {rows.map((row) => (
            <Row key={row.id} row={row} mine={mine(row)} name={name} />
          ))}
        </ol>
      )}
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor={`${id}-phrase`} className="text-sm font-medium">
          {say("ui.talk.phrase")}
        </label>
        <select
          id={`${id}-phrase`}
          value={phraseId}
          onChange={(event) => {
            setPhraseId(event.target.value as Id<"phrase">);
            setFill(null);
          }}
          className="min-h-11 rounded-lg border border-line bg-paper px-3"
        >
          {PHRASES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {phraseWords(entry.id, null)}
            </option>
          ))}
        </select>
        {phrase === undefined || phrase.fill === null ? null : (
          <>
            <label htmlFor={`${id}-fill`} className="text-sm font-medium">
              {say("ui.talk.fill")}
            </label>
            <select id={`${id}-fill`} value={chosenFill ?? ""} onChange={(event) => setFill(event.target.value)} className="min-h-11 rounded-lg border border-line bg-paper px-3">
              {fills.map((value) => (
                <option key={value} value={value}>
                  {fillWords(phrase.id, phrase.fill ?? "", value)}
                </option>
              ))}
            </select>
          </>
        )}
        <div>
          <Button type="submit" small disabled={busy || (phrase?.fill !== null && chosenFill === null)}>
            {say("ui.talk.send")}: {phraseWords(phraseId, chosenFill)}
          </Button>
        </div>
      </form>
      {refusal === null ? null : (
        <p role="alert" className="text-sm text-bad">
          {refusal}
        </p>
      )}
      <BlockReport who={{ pair, name }} cites={theirs.length > 0 ? { messages: theirs } : { pair }} surface="conversation" />
    </section>
  );
}
