// What the sound layer asks of the browser, in one place, so tests can stand in for it. Spoken
// lines go through Web Audio, which stays quiet when an iPhone's silent switch is on
// (docs/design/06-audio.md, section 7).

/** A sound that has started. `ended` settles when it finishes or is stopped. */
export interface Playing {
  ended: Promise<void>;
  stop: () => void;
}

export type ClipFormat = "opus" | "mp3";

export interface SoundBackend {
  /** False when the page cannot make sound at all: no Web Audio, or neither format plays. */
  supported: () => boolean;
  /** The formats to try, the one the browser says it plays first. */
  formats: () => ClipFormat[];
  /** The browser or the phone asks pages to save data. */
  saveData: () => boolean;
  /** Called inside a tap: lets sound start. Silent. */
  wake: () => void;
  /** Settles true once sound may play, or false when it is still held back after `waitMs`. */
  ready: (waitMs: number) => Promise<boolean>;
  /** Puts sound to sleep, as phones do when the page is hidden. */
  sleep: () => void;
  /** The clip's bytes, or null when it is missing. Rejects only when the network fails. */
  fetch: (url: string) => Promise<ArrayBuffer | null>;
  /** Plays decoded bytes. Rejects when the browser refuses or cannot decode them. */
  play: (bytes: ArrayBuffer) => Promise<Playing>;
  /** A short voice-like sound in place of words, about `ms` long. Throws when sound cannot play. */
  babble: (ms: number, seed: number) => Playing;
}

interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

interface SavingNavigator {
  connection?: { saveData?: boolean };
}

const OPUS = 'audio/ogg; codecs="opus"';
const MP3 = "audio/mpeg";
const SYLLABLE_MS = 110;
const GAP_MS = 40;
const BABBLE_MAX_MS = 4000;

function contextClass(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext ?? (window as unknown as WebkitWindow).webkitAudioContext;
}

function playable(type: string): boolean {
  if (typeof document === "undefined") return false;
  const answer = document.createElement("audio").canPlayType?.(type) ?? "";
  return answer === "probably" || answer === "maybe";
}

/** The browser's own Web Audio, made on the first tap. */
export function webAudioBackend(): SoundBackend {
  let context: AudioContext | null = null;
  const formats = (): ClipFormat[] => {
    const opus = playable(OPUS);
    const mp3 = playable(MP3);
    return [...(opus ? (["opus"] as const) : []), ...(mp3 ? (["mp3"] as const) : [])];
  };
  const running = () => context?.state === "running";
  return {
    supported: () => contextClass() !== undefined && formats().length > 0,
    formats,
    saveData: () => {
      const saving = typeof navigator !== "undefined" && (navigator as SavingNavigator).connection?.saveData === true;
      const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-data: reduce)").matches === true;
      return saving || reduced;
    },
    wake: () => {
      const Make = contextClass();
      if (Make === undefined) return;
      try {
        context ??= new Make();
        if (context.state !== "running") void context.resume().catch(() => undefined);
        // A silent frame started inside the tap is what older iPhones wait for.
        const silence = context.createBufferSource();
        silence.buffer = context.createBuffer(1, 1, context.sampleRate);
        silence.connect(context.destination);
        silence.start(0);
      } catch {
        // A browser that refuses stays in text.
      }
    },
    ready: (waitMs) => {
      if (running()) return Promise.resolve(true);
      if (context === null) return Promise.resolve(false);
      const watched = context;
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          watched.removeEventListener("statechange", change);
          resolve(running());
        }, waitMs);
        function change() {
          if (!running()) return;
          clearTimeout(timer);
          watched.removeEventListener("statechange", change);
          resolve(true);
        }
        watched.addEventListener("statechange", change);
      });
    },
    sleep: () => {
      if (context !== null && context.state === "running") void context.suspend().catch(() => undefined);
    },
    fetch: async (url) => {
      const response = await fetch(url);
      if (!response.ok) return null;
      return response.arrayBuffer();
    },
    play: async (bytes) => {
      if (context === null || !running()) throw new Error("Sound is held back.");
      const playing = context;
      const buffer = await playing.decodeAudioData(bytes.slice(0));
      const source = playing.createBufferSource();
      source.buffer = buffer;
      source.connect(playing.destination);
      const ended = new Promise<void>((resolve) => {
        source.addEventListener("ended", () => resolve());
      });
      source.start();
      return {
        ended,
        stop: () => {
          try {
            source.stop();
          } catch {
            // Already stopped.
          }
        },
      };
    },
    babble: (ms, seed) => {
      if (context === null || !running()) throw new Error("Sound is held back.");
      return babbleOn(context, Math.min(ms, BABBLE_MAX_MS), seed);
    },
  };
}

/** Syllable pitches in hertz, picked by the line's seed so a line always sounds the same. */
const PITCHES = [150, 170, 135, 185, 160, 145, 175, 155];

function babbleOn(context: AudioContext, ms: number, seed: number): Playing {
  const start = context.currentTime;
  const output = context.createGain();
  output.gain.value = 0.12;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900;
  filter.connect(output);
  output.connect(context.destination);
  const oscillators: OscillatorNode[] = [];
  let at = 0;
  let index = seed;
  while (at + SYLLABLE_MS <= ms) {
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = PITCHES[index % PITCHES.length] ?? 150;
    const envelope = context.createGain();
    const from = start + at * 0.001;
    const to = from + SYLLABLE_MS * 0.001;
    envelope.gain.setValueAtTime(0, from);
    envelope.gain.linearRampToValueAtTime(1, from + 0.015);
    envelope.gain.linearRampToValueAtTime(0, to);
    oscillator.connect(envelope);
    envelope.connect(filter);
    oscillator.start(from);
    oscillator.stop(to);
    oscillators.push(oscillator);
    at += SYLLABLE_MS + GAP_MS;
    index += 3;
  }
  const last = oscillators.at(-1);
  const ended = last === undefined ? Promise.resolve() : new Promise<void>((resolve) => last.addEventListener("ended", () => resolve()));
  return {
    ended,
    stop: () => {
      for (const oscillator of oscillators) {
        try {
          oscillator.stop();
        } catch {
          // Already stopped.
        }
      }
    },
  };
}
