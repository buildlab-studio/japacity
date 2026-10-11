// Chats (docs/rules/world.md R-WORLD-019, R-WORLD-020): the family group as bubbles, the month's
// people lines, and the partner's and a friend's messages when the view has a pair. Sending is a
// preset phrase the pair rules allow (R-PAIR-010), picked from chips: nobody types. Once courting, a
// bond lives in its thread, whose head carries its stage and choices; the People row at the top opens
// the slots of this life with the invite card (R-WORLD-020, people.md R-PEOPLE-010). Both are the people
// feature's own screens, handed in by the shell.
import { content } from "@japacity/content";
import { fillOptions, type ConversationRow, type Id } from "@japacity/sim";
import { ChevronLeft, ChevronRight, UserRound, Users } from "lucide-react";
import { createContext, Fragment, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import type { ConversationReply, PairReply, SayReply } from "../../../shared/net/contract";
import { bondName, conversationPhrases, fillWords, momentWords, phraseWords, type BondView } from "../../../shared/sim/people";
import { monthsAgo, say, words } from "../../../shared/words/text";
import { Head } from "../act";
import { familyFeedLines } from "../feed";
import { phoneWords } from "../phone.words";

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

/** The people a chat is open with: a player on the other side of a pair, or a computer partner. */
export function chatPeople(view: ReturnType<typeof useView>): BondView[] {
  return view.people.bonds.filter((bond) => bond.stage !== "ended" && (bond.pair !== null || (bond.role === "partner" && bond.person !== null)));
}

function Bubble({ from, mine = false, children }: { from: string | null; mine?: boolean; children: string }) {
  return (
    <li className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
      {from === null ? null : <span className="px-1 text-[11px] font-bold text-text-2">{from}</span>}
      <span className={`max-w-[85%] rounded-[14px] px-3 py-2 text-[14px] leading-snug ${mine ? "band rounded-br-[4px]" : "rounded-bl-[4px] border border-sheet-line bg-sheet-2"}`}>{children}</span>
    </li>
  );
}

function Family() {
  const view = useView();
  const feed = familyFeedLines(view);
  const people = (view.report?.lines ?? []).filter((line) => line.key.startsWith("line.people."));
  return (
    <div data-chat="family">
      {feed.length === 0 ? (
        <p className="text-[14px] text-text-2">{phoneWords("phone.chats.family.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-feed>
          {feed.map((line, index) => (
            <Fragment key={`${line.id}-${String(line.month)}`}>
              {index === 0 || feed[index - 1]?.month !== line.month ? (
                <li className="label self-center py-1 text-[10px] text-text-2">{monthsAgo(line.month, view.month)}</li>
              ) : null}
              <Bubble from={line.from}>{line.words}</Bubble>
            </Fragment>
          ))}
        </ul>
      )}
      {people.length === 0 ? null : (
        <>
          <Head>{phoneWords("phone.chats.people")}</Head>
          <ul className="flex flex-col gap-1.5" data-people-lines>
            {people.map((line, index) => (
              <li key={`${line.key}-${String(index)}`} className="rounded-[6px] bg-sheet-muted px-3 py-2 text-center text-[13px] text-text-2">
                {words(line.key, line.params)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** A computer partner: no messages of their own; the moments together arrive here. */
function Computer({ bond, name }: { bond: BondView; name: string }) {
  const moments = bond.moments ?? [];
  return (
    <div data-chat={bond.id}>
      <p className="text-[14px] text-text-2">{phoneWords("phone.chats.computer", { name })}</p>
      {moments.length === 0 ? null : (
        <ul className="mt-3 flex flex-col gap-2">
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

/** A pair's thread (R-PAIR-010, R-PAIR-011): the server's rows, and a phrase from chips. */
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
        setRefusal(say("ui.talk.failed.other", { why: error instanceof Error ? error.message : String(error) }));
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
  // R-PAIR-011: the server nudged that a row is new; fetch from where the thread left off.
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
        setRefusal(say("ui.talk.failed.other", { why: reply.detail }));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-chat={pair}>
      {rows.length === 0 ? (
        <p className="text-[14px] text-text-2">{say("ui.talk.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-thread>
          {rows.map((row) => (
            <Bubble key={row.id} from={them !== null && row.sender === them ? name : null} mine={them !== null && row.sender !== them}>
              {phraseWords(row.phrase, row.fill)}
            </Bubble>
          ))}
        </ul>
      )}
      <Head>{phoneWords("phone.chats.pick")}</Head>
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1" role="radiogroup" aria-label={phoneWords("phone.chats.pick")}>
        {PHRASES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={entry.id === phraseId}
            onClick={() => {
              setPhraseId(entry.id);
              setFill(null);
            }}
            className={`press shrink-0 rounded-[14px] px-3 py-2 text-[13px] font-bold whitespace-nowrap ${entry.id === phraseId ? "btn-dark" : "border border-sheet-line bg-sheet-2"}`}
          >
            {phraseWords(entry.id, null)}
          </button>
        ))}
      </div>
      {phrase === undefined || phrase.fill === null ? null : (
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={say("ui.talk.fill")}>
          {fills.map((value) => (
            <button key={value} type="button" role="radio" aria-checked={value === chosenFill} onClick={() => setFill(value)} className={`press rounded-[14px] px-3 py-1.5 text-[13px] font-bold ${value === chosenFill ? "btn-dark" : "border border-sheet-line bg-sheet-2"}`}>
              {fillWords(phrase.id, phrase.fill ?? "", value)}
            </button>
          ))}
        </div>
      )}
      {phraseId === null ? null : (
        <button type="button" className="btn-main mt-3" disabled={busy || (phrase?.fill !== null && chosenFill === null)} onClick={() => void send()} data-say>
          <span className="truncate">{phraseWords(phraseId, chosenFill)}</span>
          <span className="text-[13px] opacity-80">{phoneWords("phone.chats.say")}</span>
        </button>
      )}
      {refusal === null ? null : (
        <p role="alert" className="mt-2 text-[14px] text-out">
          {refusal}
        </p>
      )}
    </div>
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

  if (open === SLOTS && screens !== null) {
    return (
      <div data-phone-app="chats">
        <button type="button" onClick={() => setOpen(null)} className="press mb-2 flex items-center gap-1 text-[14px] font-bold text-text-2" data-chats-back>
          <ChevronLeft size={16} aria-hidden />
          {phoneWords("phone.app.chats")}
        </button>
        <h3 className="title mb-3 text-[18px]">{phoneWords("phone.chats.slots")}</h3>
        <div data-chat={SLOTS}>{screens.slots}</div>
      </div>
    );
  }

  if (open !== null) {
    const name = bond === null ? groupName : bondName(bond, view.people.bonds);
    return (
      <div data-phone-app="chats">
        <button type="button" onClick={() => setOpen(null)} className="press mb-2 flex items-center gap-1 text-[14px] font-bold text-text-2" data-chats-back>
          <ChevronLeft size={16} aria-hidden />
          {phoneWords("phone.app.chats")}
        </button>
        <h3 className="title mb-3 flex items-center gap-2 text-[18px]">
          {name}
          {/* The quiet mark a person the game plays carries on every screen (people.md R-PEOPLE-009, R-PEOPLE-054). */}
          {bond?.label === "computer" ? (
            <span className="rounded-[3px] border border-sheet-line px-1.5 py-px text-[11px] font-extrabold text-text-2 uppercase" data-person-mark="computer">
              {say("ui.people.mark.computer")}
            </span>
          ) : null}
        </h3>
        {bond === null || screens === null ? null : screens.head(bond)}
        {bond === null ? (
          <Family />
        ) : bond.pair !== null ? (
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
      <ul className="flex flex-col divide-y divide-sheet-line">
        {screens === null ? null : (
          <li>
            <button type="button" onClick={() => setOpen(SLOTS)} className="press flex w-full items-center gap-3 py-2.5 text-left" data-chat-row={SLOTS}>
              <span className="band-2 flex size-10 shrink-0 items-center justify-center rounded-[10px]">
                <UserRound size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{phoneWords("phone.chats.slots")}</span>
                <span className="block truncate text-[13px] text-text-2">{phoneWords("phone.chats.slots.line")}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-text-2" aria-hidden />
            </button>
          </li>
        )}
        <li>
          <button type="button" onClick={() => setOpen("family")} className="press flex w-full items-center gap-3 py-2.5 text-left" data-chat-row="family">
            <span className="band flex size-10 shrink-0 items-center justify-center rounded-full">
              <Users size={18} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold">{groupName}</span>
              <span className="block truncate text-[13px] text-text-2">{latest === undefined ? phoneWords("phone.chats.family.none") : phoneWords("phone.chats.family.line", { from: latest.from, words: latest.words })}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-text-2" aria-hidden />
          </button>
        </li>
        {people.map((person) => {
          const name = bondName(person, view.people.bonds);
          return (
            <li key={person.id}>
              <button type="button" onClick={() => setOpen(person.id)} className="press flex w-full items-center gap-3 py-2.5 text-left" data-chat-row={person.id}>
                <span className="band-2 title flex size-10 shrink-0 items-center justify-center rounded-full text-[16px]">{name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{phoneWords("phone.chats.with", { name })}</span>
                  <span className="block truncate text-[13px] text-text-2">{say(`ui.people.stage.${person.stage}`)}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-text-2" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
