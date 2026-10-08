// A pair's conversation in preset phrases (R-PAIR-010, R-PAIR-011): the thread
// from the server's rows with read marks, a phrase with its fill-in from the
// fixed lists, and a refusal said plainly (R-PAIR-013). Nobody types.
import { content } from "@japacity/content";
import type { ConversationRow, Id, SayRefusal } from "@japacity/sim";
import { fillOptions } from "@japacity/sim";
import { Check, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";

import { useView } from "../../authority/GameProvider";
import { conversationPhrases, fillWords, phraseWords } from "../../shared/sim/people";
import type { SayReply } from "../../shared/net/contract";
import { Button } from "../../shared/ui/Button";
import { Tag } from "../../shared/ui/Panel";
import { hasWords, say, sayCount } from "../../shared/words/text";
import type { PairApi } from "./pairApi";
import { Safety } from "./Safety";

const PHRASES = conversationPhrases();

/** Why a phrase did not go, in plain words and never about the other side's settings. */
function refusalWords(reply: Exclude<SayReply, { ok: true }>): string {
  if (reply.code === "rate-limited") return reply.retryAfter === undefined ? say("ui.talk.failed.too-many") : sayCount("ui.online.wait", reply.retryAfter, { seconds: reply.retryAfter });
  const failed: SayRefusal | undefined = reply.failed;
  if (failed !== undefined && hasWords(`ui.talk.failed.${failed}`)) return say(`ui.talk.failed.${failed}`);
  return say("ui.talk.failed.other", { why: reply.detail });
}

function Row({ row, mine }: { row: ConversationRow; mine: boolean }) {
  const words = phraseWords(row.phrase, row.fill);
  return (
    <li className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`} data-row={row.id}>
      <span className="text-xs text-muted">{say(mine ? "ui.talk.you" : "ui.talk.them")}</span>
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

export function Conversation({ api, pair }: { api: PairApi; pair: string }) {
  const id = useId();
  const view = useView();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [me, setMe] = useState<string | null>(null);
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
        setMe(reply.me);
        setRows((held) => {
          const known = new Set(held.map((row) => row.id));
          return [...held, ...reply.rows.filter((row) => !known.has(row.id))];
        });
      } catch (error) {
        setRefusal(say("ui.talk.failed.other", { why: error instanceof Error ? error.message : String(error) }));
      }
    },
    [api, pair],
  );

  useEffect(() => {
    void fetchAfter(null);
  }, [fetchAfter]);

  const send = async () => {
    setBusy(true);
    setRefusal(null);
    try {
      const reply = await api.say(pair, phraseId, chosenFill);
      if (reply.ok) setRows((held) => [...held, reply.row]);
      else setRefusal(refusalWords(reply));
    } catch (error) {
      setRefusal(say("ui.talk.failed.other", { why: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  };

  const theirs = rows.filter((row) => me !== null && row.sender !== me).map((row) => row.id);
  const last = rows.at(-1)?.id ?? null;

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
        <ol className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {rows.map((row) => (
            <Row key={row.id} row={row} mine={me !== null && row.sender === me} />
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
      <Safety api={api} pair={pair} messages={theirs} />
    </section>
  );
}
