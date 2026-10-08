// A stand-in browser for the sound layer's tests: what was fetched, played and babbled, and the
// browser's refusals on demand.
import type { ClipFormat, Playing, SoundBackend } from "./sound.backend";

export interface FakeSoundOptions {
  supported?: boolean;
  formats?: ClipFormat[];
  saveData?: boolean;
  /** The browser keeps sound held back whatever is tapped. */
  blocked?: boolean;
  /** Woken already, as after a tap earlier in the session. */
  awake?: boolean;
  /** Clips with no file: their fetch finds nothing. */
  missing?: readonly string[];
  /** Clips whose fetch never settles. */
  hanging?: readonly string[];
  /** Every play is refused. */
  refuses?: boolean;
}

export interface FakeSound {
  backend: SoundBackend;
  fetched: string[];
  played: string[];
  babbled: number[];
  wakes: number;
  sleeps: number;
  /** Ends the clip playing now, as the browser does when it finishes. */
  endPlaying: () => void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function fakeSound(options: FakeSoundOptions = {}): FakeSound {
  let awake = options.awake === true && options.blocked !== true;
  const enders: (() => void)[] = [];
  const playing = (): Playing => {
    let finish: () => void = () => undefined;
    const ended = new Promise<void>((resolve) => {
      finish = resolve;
    });
    enders.push(finish);
    return { ended, stop: finish };
  };
  const fake: FakeSound = {
    fetched: [],
    played: [],
    babbled: [],
    wakes: 0,
    sleeps: 0,
    endPlaying: () => {
      for (const end of enders.splice(0)) end();
    },
    backend: {
      supported: () => options.supported ?? true,
      formats: () => options.formats ?? ["opus", "mp3"],
      saveData: () => options.saveData ?? false,
      wake: () => {
        fake.wakes += 1;
        if (options.blocked !== true) awake = true;
      },
      ready: () => Promise.resolve(awake),
      sleep: () => {
        fake.sleeps += 1;
        awake = false;
      },
      fetch: (url) => {
        fake.fetched.push(url);
        if (options.hanging?.some((clip) => url.includes(`/${clip}.`)) === true) return new Promise(() => undefined);
        if (options.missing?.some((clip) => url.includes(`/${clip}.`)) === true) return Promise.resolve(null);
        return Promise.resolve(encoder.encode(url).buffer);
      },
      play: (bytes) => {
        if (options.refuses === true || !awake) return Promise.reject(new Error("NotAllowedError"));
        fake.played.push(decoder.decode(bytes));
        return Promise.resolve(playing());
      },
      babble: (ms) => {
        if (options.refuses === true || !awake) throw new Error("NotAllowedError");
        fake.babbled.push(ms);
        return playing();
      },
    },
  };
  return fake;
}
