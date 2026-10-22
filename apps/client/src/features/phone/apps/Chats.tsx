// Chats (world:phone-holds-what-phones-hold, world:nobody-picked-from-list): the family group as bubbles, the month's
// people lines, and the partner's and a friend's messages when the view has a pair. Sending is a
// preset phrase the pair rules allow (pair:preset-phrases-only), picked from chips: nobody types. Once courting, a
// bond lives in its thread, whose head carries its stage and choices; the People row at the top opens
// the slots of this life with the invite card (world:nobody-picked-from-list, person:invite-fills-a-slot). Both are the people
// feature's own screens, handed in by the shell.
import type { ConversationReply, PairReply, SayReply, ServerRejection } from "@japacity/api";
import { content } from "@japacity/content";
import { fillOptions, type ConversationRow, type Id, type SayRefusal } from "@japacity/sim";
import { ChevronRight, UserRound, Users } from "lucide-react";
import { createContext, Fragment, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { bondName, conversationPhrases, endStillTold, fillWords, momentWords, phraseWords, type BondView } from "../../../shared/view/person";
import { hasWords, monthsAgo, say, sayCount, words } from "../../../shared/words/text";
import { faceMark } from "../../../shared/ui/lively/Face";
import { PressButton } from "../../../shared/ui/lively/PressButton";
import { Head, useInnerBack } from "../act";
import { familyFeedLines } from "../feed";
import { troubleWords } from "../../../shared/words/trouble";
import { BlockReport } from "../../../shared/moderation/BlockReport";

/** The server's pair routes the phone needs: the shell hands in the people feature's own, or null offline. */
export interface PairTalk {
  pair(pair: string): Promise<PairReply>;
  conversation(pair: string, after: string | null): Promise<ConversationReply>;
  say(pair: string, phrase: Id<"phrase">, fill: string | null): Promise<SayReply>;
}

export const PhoneTalk = createContext<PairTalk | null>(null);

/** The people feature's screens Chats shows, from the shell: a bond's head over its thread, and the slots behind the People row. */
export interface PhonePeopleScreens {
  head: (bond: BondView) => ReactNode;
  slots: ReactNode;
}

export const PhonePeople = createContext<PhonePeopleScreens | null>(null);

/** The People row's id among the threads: never a bond's. */
const SLOTS = "people";

const PHRASES = conversationPhrases();

/**
 * The people a chat is open with: a player on the other side of a pair, or a computer partner. A bond that ended keeps
 * its thread through the month it ended in, its head saying so, and then it goes (person:computer-partner-drifts).
 */
function chatPeople(view: ReturnType<typeof useView>): BondView[] {
  return view.people.bonds.filter((bond) => (bond.stage !== "ended" || endStillTold(view, bond)) && (bond.pair !== null || (bond.role === "partner" && bond.person !== null)));
}

/** A computer partner's answer once courted, the first message of their thread (person:courting-opens-a-bond), or null when content has none. */
function courtedLine(person: string | null): string | null {
  const key = `${person ?? ""}.courted`;
  return person !== null && hasWords(key) ? say(key) : null;
}

/** Who said it, as a pill with their flat mark; the mark's letter is drawn, so it never joins the words of the message. */
function NamePill({ name }: { name: string }) {
  const mark = faceMark(name);
  return (
    <span className="pill py-1 pr-3 pl-1 text-[13px]" data-face={name}>
      <span className="face-mark drawn-pic flex size-6 shrink-0 items-center justify-center text-[13px] font-bold text-white" style={{ background: mark.colour }} data-pic={mark.initial} aria-hidden />
      {name}
    </span>
  );
}

/**
 * A message: who said it as a name pill with their mark, the words in a white
 * bubble; yours in navy. A pair's row carries its read state (pair:conversation-phrases-stored): yours says read once read, theirs
 * is marked new while unread.
 */
function Bubble({ from, mine = false, courted = false, row, read, children }: { from: string | null; mine?: boolean; courted?: boolean; row?: string; read?: boolean; children: string }) {
  return (
    <li className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`} data-courted={courted ? "" : undefined} data-row={row}>
      {from === null ? null : <NamePill name={from} />}
      <span className={`max-w-[88%] px-3.5 py-2.5 text-[15px] leading-snug ${mine ? "phone-bubble-mine" : "phone-bubble"}`}>{children}</span>
      {read === undefined ? null : mine ? (
        read ? (
          <span className="px-1 text-[12px] font-semibold text-text-2" data-read>
            {say("ui.talk.read")}
          </span>
        ) : null
      ) : read ? null : (
        <span className="sticker-chip bg-[var(--soft)] text-[12px]" style={{ rotate: "-2deg", color: "var(--soft-ink)" }} data-unread>
          {say("ui.talk.unread")}
        </span>
      )}
    </li>
  );
}

const SAY_REFUSALS: readonly string[] = ["not-possible", "blocked", "too-many", "not-here", "wrong-place", "bad-fill"] satisfies readonly SayRefusal[];

/** Why a phrase did not go, from the check the code names, and never about the other side's settings (pair:phrase-checks-before-send). */
function refusalWords(reply: ServerRejection): string {
  if (reply.code === "rate-limited") return reply.retryAfter === undefined ? say("ui.talk.failed.too-many") : sayCount("ui.online.wait", reply.retryAfter, { seconds: reply.retryAfter });
  if (SAY_REFUSALS.includes(reply.code) && hasWords(`ui.talk.failed.${reply.code}`)) return say(`ui.talk.failed.${reply.code}`);
  return say("ui.talk.failed.other", { why: reply.detail });
}

function Family() {
  const view = useView();
  const feed = familyFeedLines(view);
  const people = (view.report?.lines ?? []).filter((line) => line.key.startsWith("line.people."));
  return (
    <div data-chat="family">
      {feed.length === 0 ? (
        <p className="text-[14px] text-text-2">{say("phone.chats.family.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2.5" data-feed>
          {feed.map((line, index) => (
            <Fragment key={`${line.id}-${String(line.month)}`}>
              {index === 0 || feed[index - 1]?.month !== line.month ? (
                <li className="self-center py-1 text-[13px] font-semibold text-text-2">{monthsAgo(line.month, view.month)}</li>
              ) : null}
              <Bubble from={line.from}>{line.words}</Bubble>
            </Fragment>
          ))}
        </ul>
      )}
      {people.length === 0 ? null : (
        <>
          <Head>{say("phone.chats.people")}</Head>
          <ul className="flex flex-col gap-1.5" data-people-lines>
            {people.map((line, index) => (
              <li key={`${line.key}-${String(index)}`} className="phone-bubble px-3 py-2 text-center text-[14px] text-text-2">
                {words(line.key, line.params)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * A computer partner: no messages of their own beyond their answer when courted, which opens the thread (person:courting-opens-a-bond);
 * the moments together arrive after it. A thread kept for the month a bond ended in shows the same, read only.
 */
function Computer({ bond, name }: { bond: BondView; name: string }) {
  const moments = bond.moments ?? [];
  const first = courtedLine(bond.person);
  return (
    <div data-chat={bond.id}>
      {bond.stage === "ended" ? null : <p className="text-[14px] text-text-2">{say("phone.chats.computer", { name })}</p>}
      {first === null && moments.length === 0 ? null : (
        <ul className="mt-3 flex flex-col gap-2" data-thread>
          {first === null ? null : (
            <Bubble from={name} courted>
              {first}
            </Bubble>
          )}
          {moments.slice(-6).map((moment, index) => (
            <Bubble key={index} from={name}>
              {momentWords(moment)}
            </Bubble>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A pair's thread (pair:preset-phrases-only, pair:conversation-phrases-stored): the server's rows, and a phrase from chips. */
function Thread({ talk, pair, name }: { talk: PairTalk; pair: string; name: string }) {
  const view = useView();
  const nudges = useGame((state) => state.messageNudges);
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [them, setThem] = useState<string | null>(null);
  const [phraseId, setPhraseId] = useState<Id<"phrase"> | null>(null);
  const [fill, setFill] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const phrase = phraseId === null ? undefined : content.phrase[phraseId];
  const fills = phrase === undefined ? [] : fillOptions(phrase, content, view);
  const chosenFill = phrase?.fill === null ? null : fill !== null && fills.includes(fill) ? fill : (fills[0] ?? null);
  const theirs = rows.filter((row) => them !== null && row.sender === them).map((row) => row.id);

  const fetchAfter = useCallback(
    async (after: string | null) => {
      try {
        const reply = await talk.conversation(pair, after);
        if (!reply.ok) return setRefusal(say("ui.talk.failed.other", { why: reply.detail }));
        setRows((held) => {
          const known = new Set(held.map((row) => row.id));
          return [...held, ...reply.messages.filter((row) => !known.has(row.id))];
        });
      } catch (error) {
        setRefusal(troubleWords(error));
      }
    },
    [talk, pair],
  );
  useEffect(() => {
    let live = true;
    void talk
      .pair(pair)
      .then((reply) => {
        if (live && reply.ok) setThem(reply.pair.them);
      })
      .catch(() => undefined);
    void fetchAfter(null);
    return () => {
      live = false;
    };
  }, [talk, pair, fetchAfter]);
  const last = useRef<string | null>(null);
  useEffect(() => {
    last.current = rows.at(-1)?.id ?? null;
  }, [rows]);
  // pair:conversation-phrases-stored: the server nudged that a row is new; fetch from where the thread left off.
  useEffect(() => {
    if (nudges > 0) void fetchAfter(last.current);
  }, [nudges, fetchAfter]);

  const send = async () => {
    if (phraseId === null) return;
    setBusy(true);
    setRefusal(null);
    try {
      const reply = await talk.say(pair, phraseId, chosenFill);
      if (reply.ok) {
        setRows((held) => [...held, reply.message]);
        setPhraseId(null);
      } else {
        setRefusal(refusalWords(reply));
      }
    } catch (error) {
      setRefusal(troubleWords(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={say("ui.talk.title")} data-chat={pair}>
      {rows.length === 0 ? (
        <p className="text-[14px] text-text-2">{say("ui.talk.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-thread>
          {rows.map((row) => (
            <Bubble key={row.id} from={them !== null && row.sender === them ? name : null} mine={them !== null && row.sender !== them} row={row.id} read={row.readAt !== null}>
              {phraseWords(row.phrase, row.fill)}
            </Bubble>
          ))}
        </ul>
      )}
      <Head>{say("phone.chats.pick")}</Head>
      <div className="-mx-3 flex flex-wrap gap-2 px-3 pt-1 pb-2" role="radiogroup" aria-label={say("phone.chats.pick")}>
        {PHRASES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={entry.id === phraseId}
            data-phrase={entry.id}
            onClick={() => {
              setPhraseId(entry.id);
              setFill(null);
            }}
            className={`press phone-ghost min-h-10 w-auto shrink-0 px-3.5 text-[14px] whitespace-nowrap ${entry.id === phraseId ? "bg-[var(--soft)]" : ""}`}
          >
            {phraseWords(entry.id, null)}
          </button>
        ))}
      </div>
      {phrase === undefined || phrase.fill === null ? null : (
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={say("ui.talk.fill")}>
          {fills.map((value) => (
            <button key={value} type="button" role="radio" aria-checked={value === chosenFill} data-fill={value} onClick={() => setFill(value)} className={`press phone-ghost min-h-9 w-auto px-3 text-[14px] ${value === chosenFill ? "bg-[var(--soft)]" : ""}`}>
              {fillWords(phrase.id, phrase.fill ?? "", value)}
            </button>
          ))}
        </div>
      )}
      {phraseId === null ? null : (
        <PressButton className="mt-3 w-full" disabled={busy || (phrase?.fill !== null && chosenFill === null)} onClick={() => void send()} data-say>
          <span className="shrink-0">{say("phone.chats.say")}</span>
          <span aria-hidden>·</span>
          <span className="min-w-0 truncate">{phraseWords(phraseId, chosenFill)}</span>
        </PressButton>
      )}
      {refusal === null ? null : (
        <p role="alert" className="mt-2 text-[14px] text-out">
          {refusal}
        </p>
      )}
      {/* Block and report on the conversation itself, citing their messages (moderation:report-from-every-surface). */}
      <div className="mt-3">
        <BlockReport who={{ pair, name }} cites={theirs.length > 0 ? { messages: theirs } : { pair }} surface="conversation" />
      </div>
    </section>
  );
}

export function Chats() {
  const view = useView();
  const talk = use(PhoneTalk);
  const screens = use(PhonePeople);
  const [open, setOpen] = useState<string | null>(null);
  const people = chatPeople(view);
  const bond = people.find((candidate) => candidate.id === open) ?? null;
  const groupName = say("family.group.name");
  // A thread or the People slots is an inner screen: the head's Back returns to the chats, the one way back (world:phone-rises-over-scene).
  useInnerBack(open === null ? null : () => setOpen(null));

  if (open === SLOTS && screens !== null) {
    return (
      <div data-phone-app="chats">
        <h3 className="mb-3 text-[20px] font-bold">{say("phone.chats.slots")}</h3>
        <div data-chat={SLOTS}>{screens.slots}</div>
      </div>
    );
  }

  if (open !== null) {
    const name = bond === null ? groupName : bondName(bond, view.people.bonds);
    return (
      <div data-phone-app="chats">
        <h3 className="mb-3 flex items-center gap-2 text-[20px] font-bold">
          {name}
          {/* The quiet mark a person the game plays carries on every screen (person:computer-candidates-labelled, person:computer-mark-is-quiet), and a stand-in's (person:stand-in-acts-narrowly). */}
          {bond !== null && bond.label !== "player" ? (
            <span className="sticker-chip bg-sheet-2 text-text-2" style={{ rotate: "-2deg" }} data-person-mark={bond.label}>
              {say(`ui.people.mark.${bond.label}`)}
            </span>
          ) : null}
        </h3>
        {bond === null || screens === null ? null : screens.head(bond)}
        {bond === null ? (
          <Family />
        ) : bond.pair !== null && bond.stage !== "ended" ? (
          talk === null ? (
            <p className="text-[14px] text-text-2">{say("ui.talk.offline")}</p>
          ) : (
            <Thread talk={talk} pair={bond.pair} name={name} />
          )
        ) : (
          <Computer bond={bond} name={name} />
        )}
      </div>
    );
  }

  const feed = familyFeedLines(view);
  const latest = feed.at(-1);
  return (
    <div data-phone-app="chats">
      <ul className="flex flex-col gap-2.5">
        {screens === null ? null : (
          <li>
            <button type="button" onClick={() => setOpen(SLOTS)} className="lively-card press flex w-full items-center gap-3 p-3 text-left" data-chat-row={SLOTS}>
              <span className="phone-pic flex size-12 shrink-0 items-center justify-center bg-tint-people" aria-hidden>
                <UserRound size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-bold">{say("phone.chats.slots")}</span>
                <span className="block truncate text-[14px] text-text-2">{say("phone.chats.slots.line")}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-text-2" aria-hidden />
            </button>
          </li>
        )}
        <li>
          <button type="button" onClick={() => setOpen("family")} className="lively-card press flex w-full items-center gap-3 p-3 text-left" data-chat-row="family">
            <span className="phone-pic flex size-12 shrink-0 items-center justify-center bg-tint-people" aria-hidden>
              <Users size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-bold">{groupName}</span>
              <span className="block truncate text-[14px] text-text-2">{latest === undefined ? say("phone.chats.family.none") : say("phone.chats.family.line", { from: latest.from, words: latest.words })}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-text-2" aria-hidden />
          </button>
        </li>
        {people.map((person) => {
          const name = bondName(person, view.people.bonds);
          const mark = faceMark(name);
          return (
            <li key={person.id}>
              <button type="button" onClick={() => setOpen(person.id)} className="lively-card press flex w-full items-center gap-3 p-3 text-left" data-chat-row={person.id}>
                <span className="face-mark flex size-12 shrink-0 items-center justify-center text-[20px] font-bold text-white" style={{ background: mark.colour }} aria-hidden>
                  {mark.initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-bold">{say("phone.chats.with", { name })}</span>
                  <span className="block truncate text-[14px] text-text-2">{say(`ui.people.stage.${person.stage}`)}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-text-2" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
