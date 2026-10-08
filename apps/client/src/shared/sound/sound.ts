// The game's sound: woken by the first tap, put to sleep when the page is hidden, a mute switch
// remembered on the device, and spoken lines that never hold anything up. Text is the scene;
// sound is added when the browser allows it (docs/design/06-audio.md, section 7).
import { createStore } from "zustand/vanilla";

import { type ClipFormat, type Playing, type SoundBackend, webAudioBackend } from "./sound.backend";

/** The four notices of section 7, one a scene at most. */
export type NoticeCase = "on" | "blocked" | "saver" | "unsupported";

/** What sound does now: plays, or why it does not. */
export type SoundMode = "on" | "muted" | "saver" | "unsupported";

export interface SoundState {
  muted: boolean;
  /** The player turned sound on this session although the browser asks to save data. */
  saverAllowed: boolean;
  notice: { which: NoticeCase; id: number } | null;
  /** The scene on screen, and the one that has had its notice. */
  scene: string | null;
  noticed: string | null;
  /** Rises each time the player taps a notice that turns sound on, so the scene says its line again. */
  retries: number;
}

/** A line the officer speaks: its clip under public/voice without extension, and how long it plays. */
export interface SpokenLine {
  clip: string | null;
  ms: number;
}

/** Why a line stopped holding the answers back. */
export type Finish = "ended" | "timeout" | "skipped" | "silent";

export interface Spoken {
  done: Promise<Finish>;
  skip: () => void;
}

const MUTED_KEY = "japacity.sound.muted";
/** Added to a clip's known length before the answers show anyway, for a clip slow to load. */
export const MARGIN_MS = 1500;
/** How long a line waits after a tap for the browser to let sound start. */
export const READY_MS = 400;
/** How long a notice stays. */
export const NOTICE_MS = 5000;

function rememberedMute(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

function remember(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // A phone that keeps nothing still mutes for this session.
  }
}

export const soundStore = createStore<SoundState>(() => ({ muted: rememberedMute(), saverAllowed: false, notice: null, scene: null, noticed: null, retries: 0 }));

let backend: SoundBackend = webAudioBackend();
let installed: Document | null = null;
let noticeId = 0;
/** Bytes asked for, by url. Only clips a scene names are ever here. */
let fetched = new Map<string, Promise<ArrayBuffer | null>>();
/** Everything the current lines are doing, so a hide, a skip or a mute can stop them. */
let stoppers = new Set<() => void>();

/** For tests: a stand-in browser, and a clean start. */
export function setSoundBackend(next: SoundBackend): void {
  backend = next;
  fetched = new Map();
  stoppers = new Set();
  soundStore.setState({ muted: rememberedMute(), saverAllowed: false, notice: null, scene: null, noticed: null, retries: 0 });
}

export function soundMode(): SoundMode {
  if (!backend.supported()) return "unsupported";
  const { muted, saverAllowed } = soundStore.getState();
  if (muted) return "muted";
  if (backend.saveData() && !saverAllowed) return "saver";
  return "on";
}

/** Called inside a tap. Silent. */
export function wakeSound(): void {
  if (backend.supported()) backend.wake();
}

function stopAll(): void {
  for (const stop of [...stoppers]) stop();
  stoppers.clear();
}

/**
 * Section 7, limits 1 and 7: the first tap anywhere wakes sound, and the first tap after the
 * page comes back wakes it again. Hiding the page stops what is playing and puts sound to sleep.
 */
export function installSoundWake(target: Document): void {
  if (installed === target) return;
  installed = target;
  const wake = () => wakeSound();
  for (const type of ["pointerdown", "keydown", "touchend"]) target.addEventListener(type, wake, { capture: true, passive: true });
  target.addEventListener("visibilitychange", () => {
    if (target.visibilityState !== "hidden") return;
    stopAll();
    backend.sleep();
  });
}

export function beginScene(scene: string): void {
  if (soundStore.getState().scene !== scene) soundStore.setState({ scene, noticed: null });
}

export function endScene(scene: string): void {
  if (soundStore.getState().scene === scene) soundStore.setState({ scene: null });
}

/** At most once a scene, never stacked. */
export function showNotice(which: NoticeCase): void {
  const { scene, noticed, notice } = soundStore.getState();
  const key = scene ?? "game";
  if (noticed === key || notice !== null) return;
  noticeId += 1;
  soundStore.setState({ notice: { which, id: noticeId }, noticed: key });
}

export function clearNotice(id: number): void {
  if (soundStore.getState().notice?.id === id) soundStore.setState({ notice: null });
}

export function setMuted(muted: boolean): void {
  remember(muted);
  soundStore.setState({ muted });
  if (muted) stopAll();
}

/** The tap on a notice. It is a tap, so it also wakes sound, which is what the browser waited for. */
export function tapNotice(which: NoticeCase): void {
  const id = soundStore.getState().notice?.id;
  if (id !== undefined) clearNotice(id);
  switch (which) {
    case "on":
      setMuted(true);
      return;
    case "blocked":
      wakeSound();
      soundStore.setState((state) => ({ retries: state.retries + 1 }));
      return;
    case "saver":
      wakeSound();
      soundStore.setState((state) => ({ saverAllowed: true, retries: state.retries + 1 }));
      return;
    case "unsupported":
      return;
    default: {
      const never: never = which;
      throw new Error(`Unknown notice ${String(never)}.`);
    }
  }
}

function urlOf(clip: string, format: ClipFormat): string {
  return `${import.meta.env.BASE_URL}voice/${clip}.${format}`;
}

function bytesOf(url: string): Promise<ArrayBuffer | null> {
  let asked = fetched.get(url);
  if (asked === undefined) {
    asked = backend.fetch(url).catch(() => null);
    fetched.set(url, asked);
  }
  return asked;
}

/**
 * Section 7, limit 5: fetches ahead only the clips named, and only while sound is on. Muted or
 * saving data, nothing is fetched.
 */
export function preload(clips: readonly string[]): void {
  if (soundMode() !== "on") return;
  const format = backend.formats()[0];
  if (format === undefined) return;
  for (const clip of clips) void bytesOf(urlOf(clip, format));
}

/** A small number from the clip's path, so its voice-like sound is always the same. */
function seedOf(clip: string | null): number {
  let seed = 0;
  for (const char of clip ?? "") seed = (seed + char.charCodeAt(0)) % 997;
  return seed;
}

/** The clip in the first format that plays, else the voice-like sound. */
async function start(line: SpokenLine, cancelled: () => boolean): Promise<Playing | null> {
  if (line.clip !== null) {
    for (const format of backend.formats()) {
      const bytes = await bytesOf(urlOf(line.clip, format));
      if (cancelled()) return null;
      if (bytes === null) continue;
      try {
        return await backend.play(bytes);
      } catch {
        if (cancelled()) return null;
      }
    }
  }
  return backend.babble(line.ms, seedOf(line.clip));
}

const SILENT: Spoken = { done: Promise.resolve("silent"), skip: () => undefined };

/**
 * Section 7, limits 2 and 3: speaks one line. `done` settles when the clip ends, or when its
 * known length and a margin have passed, or on a skip, whichever is first, and at once when
 * sound is off. Every failure is caught; the line carries on in text.
 */
export function speak(line: SpokenLine): Spoken {
  const mode = soundMode();
  if (mode === "unsupported") showNotice("unsupported");
  if (mode === "saver") showNotice("saver");
  if (mode !== "on") return SILENT;
  let finished = false;
  let playing: Playing | null = null;
  let settle: (finish: Finish) => void = () => undefined;
  const done = new Promise<Finish>((resolve) => {
    settle = resolve;
  });
  const timer = setTimeout(() => finish("timeout"), line.ms + MARGIN_MS);
  function finish(how: Finish): void {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    stoppers.delete(stop);
    playing?.stop();
    settle(how);
  }
  function stop(): void {
    finish("skipped");
  }
  stoppers.add(stop);
  void (async () => {
    try {
      if (!(await backend.ready(READY_MS))) {
        if (!finished) showNotice("blocked");
        finish("silent");
        return;
      }
      if (finished) return;
      const started = await start(line, () => finished);
      if (started === null) return;
      if (finished) {
        started.stop();
        return;
      }
      playing = started;
      showNotice("on");
      await started.ended;
      finish("ended");
    } catch {
      finish("silent");
    }
  })();
  return { done, skip: stop };
}

/** Speaks lines one after another. A skip ends them all. */
export function speakAll(lines: readonly SpokenLine[]): Spoken {
  let skipped = false;
  let current: Spoken = SILENT;
  const done = (async (): Promise<Finish> => {
    let last: Finish = "silent";
    for (const line of lines) {
      if (skipped) return "skipped";
      current = speak(line);
      last = await current.done;
      if (last === "skipped" || last === "silent") return last;
    }
    return last;
  })();
  return {
    done,
    skip: () => {
      skipped = true;
      current.skip();
    },
  };
}

/** Stops whatever is being said. */
export function hush(): void {
  stopAll();
}
