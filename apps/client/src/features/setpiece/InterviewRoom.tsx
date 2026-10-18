// The visa interview, spoken (docs/design/05-audio.md, section 7). The tap that enters the room is also the tap the browser needs before it plays sound. The
// officer's lines are heard and shown at once; the answers come when the line ends, when its
// length and a margin have passed, or on a tap, whichever is first, so the scene never waits on
// sound. The player's character never speaks: a voice would never match the one they made.
import { OFFICER_REACTIONS, setpieceVoice } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { DoorOpen, MessageCircleQuestion, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import { useGame, useView } from "../../authority/GameProvider";
import { MuteSwitch } from "../../shared/sound/MuteSwitch";
import { beginScene, clearNotice, endScene, hush, NOTICE_MS, type NoticeCase, preload, soundMode, soundStore, speakAll, type SpokenLine, tapNotice, wakeSound } from "../../shared/sound/sound";
import { soundWords } from "../../shared/sound/sound.words";
import { useSound } from "../../shared/sound/useSound";
import { Button } from "../../shared/ui/Button";
import { Card, Tag } from "../../shared/ui/Panel";
import { nameOf, say, words } from "../../shared/words/text";
import { answered, CLOSE, closeRoom, enterRoom, GREET, openRoom, roomStore, VOICED } from "./room.store";
import { roomWords } from "./room.words";

type Setpiece = NonNullable<PlayerView["setpiece"]>;

/** About how long a line with no clip takes to say, for its voice-like sound and its wait. */
const MS_A_WORD = 380;

/** The line's clip and length; a line with no clip gets the voice-like sound. */
export function lineOf(key: string): SpokenLine {
  const voice = setpieceVoice[key];
  if (voice !== undefined) return { clip: voice.clip, ms: voice.ms };
  return { clip: null, ms: words(key).split(" ").length * MS_A_WORD };
}

function sceneOf(opened: number): string {
  return `${VOICED}#${String(opened)}`;
}

/** Speaks `keys` when `on` changes, and says when the answers may show. */
function useSpoken(keys: readonly string[], on: string): { unlocked: boolean; skip: () => void } {
  const retries = useSound((state) => state.retries);
  const [unlocked, setUnlocked] = useState(() => soundMode() !== "on");
  const skipper = useRef<() => void>(() => undefined);
  const said = useRef<string | null>(null);
  const joined = keys.join("|");
  useEffect(() => {
    // A retry after a notice's tap says only the question again.
    const lines = said.current === on ? joined.split("|").slice(-1) : joined.split("|");
    said.current = on;
    setUnlocked(soundMode() !== "on");
    const spoken = speakAll(lines.map(lineOf));
    let live = true;
    skipper.current = () => {
      spoken.skip();
      setUnlocked(true);
    };
    void spoken.done.then(() => {
      if (live) setUnlocked(true);
    });
    return () => {
      live = false;
      spoken.skip();
    };
  }, [on, joined, retries]);
  return { unlocked, skip: () => skipper.current() };
}

function Officer({ lines, onTap }: { lines: { key: string; main: boolean }[]; onTap: () => void }) {
  return (
    <figure className="flex flex-col gap-1" data-officer onClick={onTap}>
      <figcaption className="text-xs font-semibold tracking-wide text-text-2 uppercase">{roomWords("room.officer")}</figcaption>
      {lines.map((line) => (
        <p key={line.key} data-line={line.key} className={line.main ? "text-xl font-semibold" : "text-text-2 italic"}>
          {words(line.key)}
        </p>
      ))}
    </figure>
  );
}

type Notice = { which: NoticeCase; id: number };

/**
 * The game's sound notice, taken into the room's header the moment it is raised, so nothing of the
 * sheet sits over the band's money and End month. It keeps the
 * notice's rules: once a scene, gone by itself after a few seconds, never needing to be closed.
 */
function useNoticeHere(): [Notice | null, () => void] {
  const [held, setHeld] = useState<Notice | null>(null);
  useEffect(() => {
    const take = (notice: Notice | null): void => {
      if (notice === null) return;
      clearNotice(notice.id);
      setHeld(notice);
    };
    take(soundStore.getState().notice);
    return soundStore.subscribe((state) => take(state.notice));
  }, []);
  useEffect(() => {
    if (held === null) return;
    const timer = setTimeout(() => setHeld(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [held]);
  return [held, () => setHeld(null)];
}

const NOTICE_ICONS: Record<NoticeCase, typeof Volume2 | null> = { on: Volume2, blocked: VolumeX, saver: VolumeX, unsupported: null };

/** The notice in the header: read out politely, never taking the focus; a tap does what the corner's tap does. */
function HeaderNotice() {
  const [notice, done] = useNoticeHere();
  const Icon = notice === null ? null : NOTICE_ICONS[notice.which];
  const box = "flex items-center gap-2 self-start rounded-[4px] border border-sheet-line bg-sheet-2 px-3 py-1.5 text-sm";
  const content =
    notice === null ? null : (
      <>
        {Icon === null ? null : <Icon size={16} aria-hidden className="shrink-0" />}
        <span>{soundWords(`sound.notice.${notice.which}`)}</span>
        {notice.which === "on" ? <VolumeX size={16} aria-label={soundWords("sound.notice.on.action")} className="shrink-0 opacity-70" /> : null}
      </>
    );
  return (
    <div role="status" aria-live="polite" data-sound-notice={notice?.which ?? "none"} data-notice-here className="flex">
      {notice === null ? null : notice.which === "unsupported" ? (
        <p className={box}>{content}</p>
      ) : (
        <button
          type="button"
          className={`${box} min-h-9 hover:bg-sheet-muted focus-visible:outline-2 focus-visible:outline-ink`}
          onClick={() => {
            done();
            tapNotice(notice.which);
          }}
        >
          {content}
        </button>
      )}
    </div>
  );
}

function Header({ entry, open }: { entry: Setpiece["entry"]; open: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <MessageCircleQuestion size={22} className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-lg font-semibold">{nameOf(entry)}</h2>
        {open ? <p className="text-sm text-text-2">{say("ui.setpiece.blocks")}</p> : null}
        <HeaderNotice />
      </div>
      <MuteSwitch />
    </div>
  );
}

function Lobby() {
  const busy = useGame((state) => state.busy);
  return (
    <div className="flex flex-col gap-3" data-room="lobby">
      <p>{roomWords("room.ready")}</p>
      <Button
        variant="primary"
        className="self-start"
        disabled={busy}
        onClick={() => {
          wakeSound();
          enterRoom();
        }}
      >
        <DoorOpen size={18} aria-hidden />
        {roomWords("room.enter")}
      </Button>
    </div>
  );
}

function Question({ setpiece, question }: { setpiece: Setpiece; question: NonNullable<Setpiece["question"]> }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const { ended } = useView();
  const prelude = useStore(roomStore, (state) => state.prelude);
  const questionKey = `${VOICED}.q.${question.id}`;
  const keys = prelude === null ? [questionKey] : [prelude, questionKey];
  const { unlocked, skip } = useSpoken(keys, `${String(setpiece.asked)}:${question.id}`);
  return (
    <>
      <p className="flex items-center gap-2 text-sm font-medium text-text-2">
        {say("ui.setpiece.question", { n: setpiece.asked + 1, total: setpiece.total })}
        {question.followUp ? <Tag>{roomWords("room.follow-up")}</Tag> : null}
      </p>
      <Officer lines={keys.map((key) => ({ key, main: key === questionKey }))} onTap={skip} />
      {unlocked ? (
        <ul className="flex flex-col gap-2" data-answers="open">
          {question.answers.map((answer) => {
            const weak = question.weak.includes(answer);
            return (
              <li key={answer}>
                <Button
                  className="w-full justify-start text-left"
                  disabled={busy || ended || !question.allowed.includes(answer)}
                  onClick={() => {
                    hush();
                    answered();
                    void send({ type: "setpiece/answer", question: question.id, answer });
                  }}
                >
                  <span className="flex-1 py-2">{words(`${setpiece.entry}.a.${question.id}.${answer}`)}</span>
                  {weak ? <Tag tone="bad">{say("ui.setpiece.weak")}</Tag> : null}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <Button variant="quiet" className="self-start" data-answers="held" onClick={skip}>
          {roomWords("room.skip")}
        </Button>
      )}
    </>
  );
}

/** The credibility interview while it is open: the lobby, then one question at a time. */
export function InterviewRoom({ setpiece }: { setpiece: Setpiece }) {
  const entered = useStore(roomStore, (state) => state.entered);
  const opened = useStore(roomStore, (state) => state.opened);
  const inRoom = useStore(roomStore, (state) => state.inRoom);
  // The room is entered only before the first answer; a reload mid-interview resumes at the question.
  const lobby = setpiece.asked === 0 && !entered;
  const first = setpiece.question?.id ?? null;
  useEffect(() => {
    openRoom();
  }, []);
  useEffect(() => {
    if (!inRoom) return;
    const scene = sceneOf(opened);
    beginScene(scene);
    return () => endScene(scene);
  }, [inRoom, opened]);
  // Phones limit loading (docs/design/05-audio.md, section 7): fetched ahead from the moment the application is sent, only while sound is on.
  useEffect(() => {
    const keys = [GREET, ...(first === null ? [] : [`${VOICED}.q.${first}`]), ...OFFICER_REACTIONS, CLOSE];
    preload(keys.flatMap((key) => (setpieceVoice[key] === undefined ? [] : [setpieceVoice[key].clip])));
  }, [first]);
  return (
    <section aria-label={nameOf(setpiece.entry)} data-scene={VOICED}>
      <Card tone="attention" className="flex flex-col gap-4" data-room={lobby ? "lobby" : "room"}>
        <Header entry={setpiece.entry} open />
        {lobby ? <Lobby /> : setpiece.question === null ? null : <Question key={`${String(setpiece.asked)}:${setpiece.question.id}`} setpiece={setpiece} question={setpiece.question} />}
      </Card>
    </section>
  );
}

/** The flat closing line, once the last answer is in. The decision still comes in its month. */
export function ClosingLine({ reaction }: { reaction: string }) {
  const opened = useStore(roomStore, (state) => state.opened);
  const keys = [reaction, CLOSE];
  useEffect(() => {
    const scene = sceneOf(opened);
    beginScene(scene);
    return () => endScene(scene);
  }, [opened]);
  useSpoken(keys, "closing");
  return (
    <section aria-label={nameOf(VOICED)} data-scene={VOICED}>
      <Card className="flex flex-col gap-4" data-room="closing">
        <Header entry={VOICED} open={false} />
        <Officer lines={keys.map((key) => ({ key, main: key === CLOSE }))} onTap={hush} />
        <Button
          className="self-start"
          onClick={() => {
            hush();
            closeRoom();
          }}
        >
          {roomWords("room.leave")}
        </Button>
      </Card>
    </section>
  );
}
