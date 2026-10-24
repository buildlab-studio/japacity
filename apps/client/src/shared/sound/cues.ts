// The interface's small sounds (world:interface-sounds-made-live). Muted, no audio context is created.
// The spoken lines and their wake-up in sound.ts are untouched; the cues keep their own small context,
// made inside the first tap that plays one.
import { soundStore } from "./sound";

export type Cue = "tap" | "open" | "close" | "done" | "coin" | "whoosh" | "month" | "ding" | "thud" | "no" | "pop";

/** One tone: a wave from `from` hertz gliding to `to`, starting `at` seconds in, lasting `long` seconds, at `gain`. */
interface Tone {
  wave: OscillatorType | "noise";
  from: number;
  to: number;
  at: number;
  long: number;
  gain: number;
}

/** Each cue's tones, quiet and short: the longest ends inside half a second. */
export const CUES: Record<Cue, readonly Tone[]> = {
  tap: [{ wave: "sine", from: 880, to: 660, at: 0, long: 0.05, gain: 0.08 }],
  open: [{ wave: "triangle", from: 440, to: 720, at: 0, long: 0.12, gain: 0.07 }],
  close: [{ wave: "triangle", from: 640, to: 400, at: 0, long: 0.11, gain: 0.06 }],
  done: [
    { wave: "sine", from: 660, to: 660, at: 0, long: 0.09, gain: 0.08 },
    { wave: "sine", from: 990, to: 990, at: 0.08, long: 0.14, gain: 0.08 },
  ],
  coin: [
    { wave: "square", from: 1320, to: 1320, at: 0, long: 0.06, gain: 0.04 },
    { wave: "square", from: 1760, to: 1760, at: 0.06, long: 0.16, gain: 0.04 },
  ],
  whoosh: [{ wave: "noise", from: 300, to: 2400, at: 0, long: 0.42, gain: 0.12 }],
  month: [
    { wave: "triangle", from: 523, to: 523, at: 0, long: 0.12, gain: 0.07 },
    { wave: "triangle", from: 659, to: 659, at: 0.1, long: 0.12, gain: 0.07 },
    { wave: "triangle", from: 784, to: 784, at: 0.2, long: 0.22, gain: 0.08 },
  ],
  // The answers of the game's look (docs/design/09-the-games-look.md, section 7), each over inside 300 ms: a bright ding
  // for a thing done, a low thud for a stamp landing with weight, a low double note falling for a refusal.
  ding: [
    { wave: "sine", from: 1318, to: 1318, at: 0, long: 0.2, gain: 0.07 },
    { wave: "sine", from: 2636, to: 2636, at: 0, long: 0.12, gain: 0.02 },
  ],
  thud: [
    { wave: "sine", from: 150, to: 55, at: 0, long: 0.16, gain: 0.18 },
    { wave: "noise", from: 300, to: 120, at: 0, long: 0.07, gain: 0.08 },
  ],
  no: [
    { wave: "triangle", from: 247, to: 247, at: 0, long: 0.1, gain: 0.08 },
    { wave: "triangle", from: 196, to: 196, at: 0.13, long: 0.14, gain: 0.08 },
  ],
  // Buy mode's lift: a short bright pop as a thing you own comes up off the floor.
  pop: [{ wave: "sine", from: 520, to: 1040, at: 0, long: 0.08, gain: 0.08 }],
};

interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

/** The browser's audio context, or null where there is none. */
function browserContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Make = window.AudioContext ?? (window as unknown as WebkitWindow).webkitAudioContext;
  if (Make === undefined) return null;
  try {
    return new Make();
  } catch {
    return null;
  }
}

let make: () => AudioContext | null = browserContext;
let context: AudioContext | null = null;

/** For tests: a stand-in for the audio context, and a clean start. */
export function setCueContext(next: () => AudioContext | null): void {
  make = next;
  context = null;
}

function noiseBuffer(on: AudioContext, seconds: number): AudioBuffer {
  const buffer = on.createBuffer(1, Math.max(1, Math.round(on.sampleRate * seconds)), on.sampleRate);
  const data = buffer.getChannelData(0);
  // A fixed pattern, not a random one: the same whoosh every ride.
  let seed = 7;
  for (let index = 0; index < data.length; index += 1) {
    seed = (seed * 16807) % 2147483647;
    data[index] = (seed / 2147483647) * 2 - 1;
  }
  return buffer;
}

function play(on: AudioContext, tone: Tone): void {
  const start = on.currentTime + tone.at;
  const end = start + tone.long;
  const envelope = on.createGain();
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(tone.gain, start + Math.min(0.012, tone.long / 4));
  envelope.gain.linearRampToValueAtTime(0, end);
  envelope.connect(on.destination);
  if (tone.wave === "noise") {
    const source = on.createBufferSource();
    source.buffer = noiseBuffer(on, tone.long);
    const filter = on.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(tone.from, start);
    filter.frequency.exponentialRampToValueAtTime(tone.to, end);
    source.connect(filter);
    filter.connect(envelope);
    source.start(start);
    source.stop(end);
    return;
  }
  const oscillator = on.createOscillator();
  oscillator.type = tone.wave;
  oscillator.frequency.setValueAtTime(tone.from, start);
  if (tone.to !== tone.from) oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
  oscillator.connect(envelope);
  oscillator.start(start);
  oscillator.stop(end);
}

/** Plays a cue. Muted, it returns before anything is made. Every failure is swallowed: a cue is never worth an error. */
export function cue(name: Cue): void {
  if (soundStore.getState().muted) return;
  try {
    context ??= make();
    if (context === null) return;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    for (const tone of CUES[name]) play(context, tone);
  } catch {
    // A browser that refuses stays quiet.
  }
}
