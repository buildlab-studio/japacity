import { afterEach, describe, expect, test, vi } from "vitest";

import { CUES, type Cue, cue, setCueContext } from "./cues";
import { setMuted } from "./sound";

/** A stand-in audio context that counts what is started on it. */
function fakeContext(): { context: AudioContext; started: string[] } {
  const started: string[] = [];
  const param = () => ({ value: 0, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined });
  const node = (kind: string) => ({
    connect: () => undefined,
    start: () => started.push(kind),
    stop: () => undefined,
    type: "",
    buffer: null,
    gain: param(),
    frequency: param(),
    Q: param(),
  });
  const context = {
    currentTime: 0,
    sampleRate: 8000,
    state: "running",
    destination: {},
    resume: () => Promise.resolve(),
    createGain: () => node("gain"),
    createOscillator: () => node("oscillator"),
    createBufferSource: () => node("noise"),
    createBiquadFilter: () => node("filter"),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { context: context as unknown as AudioContext, started };
}

const ALL = Object.keys(CUES) as Cue[];

afterEach(() => {
  setMuted(false);
});

describe("the interface's cues", () => {
  test("[R-WORLD-022] given sound is muted, when every cue is played, then no audio context is ever created", () => {
    const make = vi.fn(() => fakeContext().context);
    setCueContext(make);
    setMuted(true);
    for (const name of ALL) cue(name);
    expect(make).not.toHaveBeenCalled();
  });

  test("[R-WORLD-022] given sound is on, when the cues play, then one context is made on the first and each cue starts its tones on it", () => {
    const fake = fakeContext();
    const make = vi.fn(() => fake.context);
    setCueContext(make);
    for (const name of ALL) cue(name);
    expect(make).toHaveBeenCalledTimes(1);
    expect(fake.started).toHaveLength(ALL.reduce((sum, name) => sum + CUES[name].length, 0));
  });

  test("[R-WORLD-022] given the cues the design names, then tap, open, close, done, coin, whoosh, month, ding, thud, no and buy mode's pop exist and each ends inside half a second", () => {
    expect(ALL.sort()).toEqual(["close", "coin", "ding", "done", "month", "no", "open", "pop", "tap", "thud", "whoosh"]);
    for (const name of ALL) {
      const end = Math.max(...CUES[name].map((tone) => tone.at + tone.long));
      expect({ name, end: end < 0.5 }).toEqual({ name, end: true });
    }
  });

  test("[R-WORLD-022] given the lively layer's cues (design page 13, section 7), then a thing done dings bright, a stamp thuds low, and a refusal is a low double note, each over inside 300 ms", () => {
    const end = (name: Cue) => Math.max(...CUES[name].map((tone) => tone.at + tone.long));
    for (const name of ["ding", "thud", "no", "pop"] as const) expect({ name, short: end(name) < 0.3 }).toEqual({ name, short: true });
    expect(Math.min(...CUES.ding.map((tone) => tone.from))).toBeGreaterThanOrEqual(1000);
    expect(Math.max(...CUES.thud.map((tone) => tone.from))).toBeLessThan(400);
    const no = CUES.no;
    expect(no).toHaveLength(2);
    expect(no.every((tone) => tone.from < 330)).toBe(true);
    expect(no[1]!.at).toBeGreaterThanOrEqual(no[0]!.at + no[0]!.long);
    expect(no[1]!.from).toBeLessThan(no[0]!.from);
  });

  test("[R-WORLD-022] given no audio context can be made, when a cue plays, then nothing is thrown", () => {
    setCueContext(() => null);
    expect(() => cue("coin")).not.toThrow();
  });
});
