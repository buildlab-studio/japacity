import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fakeSound, type FakeSoundOptions } from "./sound.testing";
import {
  beginScene,
  clearNotice,
  installSoundWake,
  MARGIN_MS,
  preload,
  READY_MS,
  setMuted,
  setSoundBackend,
  soundMode,
  soundStore,
  speak,
  speakAll,
  tapNotice,
  type Finish,
} from "./sound";
import { webAudioBackend } from "./sound.backend";

const GREET = { clip: "officer/greet", ms: 3000 };
const QUESTION = { clip: "officer/q-after", ms: 1700 };

function given(options: FakeSoundOptions = {}) {
  const fake = fakeSound(options);
  setSoundBackend(fake.backend);
  beginScene("scene-1");
  return fake;
}

/** Settles promises and timers up to `ms` from now. */
async function after(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

function watch(done: Promise<Finish>): { finish: Finish | null } {
  const seen: { finish: Finish | null } = { finish: null };
  void done.then((finish) => {
    seen.finish = finish;
  });
  return seen;
}

function notice() {
  return soundStore.getState().notice?.which ?? null;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("waking sound", () => {
  test("given a page just opened, when the first tap lands anywhere, then sound is woken silently, and after the page is hidden the next tap wakes it again", () => {
    const fake = given();
    installSoundWake(document);
    expect(fake.wakes).toBe(0);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(fake.wakes).toBe(1);
    expect(fake.played).toEqual([]);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(fake.sleeps).toBe(1);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    expect(fake.wakes).toBe(2);
  });
});

describe("speaking a line", () => {
  test("given sound on and woken, when a line is spoken, then its Opus clip plays, the notice says sound is on, and the line is done when the clip ends", async () => {
    const fake = given({ awake: true });
    const seen = watch(speak(GREET).done);
    await after(0);
    expect(fake.played).toEqual(["/voice/officer/greet.opus"]);
    expect(notice()).toBe("on");
    expect(seen.finish).toBeNull();
    fake.endPlaying();
    await after(0);
    expect(seen.finish).toBe("ended");
  });

  test("given a browser that plays only MP3, when a line is spoken, then the MP3 is fetched and played and the Opus never is", async () => {
    const fake = given({ awake: true, formats: ["mp3"] });
    speak(GREET);
    await after(0);
    expect(fake.fetched).toEqual(["/voice/officer/greet.mp3"]);
    expect(fake.played).toEqual(["/voice/officer/greet.mp3"]);
  });

  test("given the browser holding sound back, when a line is spoken, then nothing plays, the notice offers to turn it on, and the line is done within the wait for the tap", async () => {
    const fake = given({ blocked: true });
    const seen = watch(speak(GREET).done);
    await after(READY_MS);
    expect(seen.finish).toBe("silent");
    expect(fake.played).toEqual([]);
    expect(notice()).toBe("blocked");
  });

  test("given the blocked notice, when it is tapped, then the tap wakes sound and the scene is asked to say its line again", () => {
    const fake = given({ blocked: true });
    tapNotice("blocked");
    expect(fake.wakes).toBe(1);
    expect(soundStore.getState().retries).toBe(1);
    expect(notice()).toBeNull();
  });

  test("given every play refused, when a line is spoken, then the failure is caught, no error shows and the line is done", async () => {
    const fake = given({ awake: true, refuses: true });
    const seen = watch(speak(GREET).done);
    await after(0);
    expect(seen.finish).toBe("silent");
    expect(fake.played).toEqual([]);
  });

  test("given a clip with no file, when its line is spoken, then the voice-like sound plays in its place for the line's length", async () => {
    const fake = given({ awake: true, missing: ["officer/greet"] });
    const seen = watch(speak(GREET).done);
    await after(0);
    expect(fake.fetched).toEqual(["/voice/officer/greet.opus", "/voice/officer/greet.mp3"]);
    expect(fake.babbled).toEqual([GREET.ms]);
    fake.endPlaying();
    await after(0);
    expect(seen.finish).toBe("ended");
  });

  test("given a clip that never finishes loading, when its line is spoken, then the line is done at its known length plus the margin, one millisecond and not before, and nothing plays", async () => {
    const fake = given({ awake: true, hanging: ["officer/greet"] });
    const seen = watch(speak(GREET).done);
    await after(GREET.ms + MARGIN_MS - 1);
    expect(seen.finish).toBeNull();
    await after(1);
    expect(seen.finish).toBe("timeout");
    expect(fake.played).toEqual([]);
  });

  test("given a line playing, when the page is hidden, then it stops, sound sleeps and the line is done, so the text and answers are there on return", async () => {
    const fake = given({ awake: true });
    installSoundWake(document);
    const seen = watch(speak(GREET).done);
    await after(0);
    expect(fake.played).toHaveLength(1);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await after(0);
    expect(seen.finish).toBe("skipped");
    expect(fake.sleeps).toBe(1);
    vi.restoreAllMocks();
  });

  test("given two lines, when the first is skipped, then the second is never spoken", async () => {
    const fake = given({ awake: true });
    const spoken = speakAll([GREET, QUESTION]);
    const seen = watch(spoken.done);
    await after(0);
    spoken.skip();
    await after(0);
    expect(seen.finish).toBe("skipped");
    expect(fake.played).toEqual(["/voice/officer/greet.opus"]);
  });

  test("given two lines, when each ends, then they play one after the other", async () => {
    const fake = given({ awake: true });
    const seen = watch(speakAll([GREET, QUESTION]).done);
    await after(0);
    fake.endPlaying();
    await after(0);
    expect(fake.played).toEqual(["/voice/officer/greet.opus", "/voice/officer/q-after.opus"]);
    fake.endPlaying();
    await after(0);
    expect(seen.finish).toBe("ended");
  });
});

describe("what is fetched", () => {
  test("given sound on, when a scene's clips are fetched ahead, then only those are fetched, once each, in the format the browser plays", async () => {
    const fake = given();
    preload(["officer/greet", "officer/q-after", "officer/greet"]);
    await after(0);
    expect(fake.fetched).toEqual(["/voice/officer/greet.opus", "/voice/officer/q-after.opus"]);
  });

  test("given muted, when clips are fetched ahead and a line is spoken, then nothing is fetched, nothing plays and no notice shows; unmuted, fetching starts from then", async () => {
    const fake = given({ awake: true });
    setMuted(true);
    preload(["officer/greet"]);
    const seen = watch(speak(GREET).done);
    await after(0);
    expect(seen.finish).toBe("silent");
    expect(fake.fetched).toEqual([]);
    expect(notice()).toBeNull();
    expect(localStorage.getItem("japacity.sound.muted")).toBe("1");
    setMuted(false);
    preload(["officer/greet"]);
    expect(fake.fetched).toEqual(["/voice/officer/greet.opus"]);
  });

  test("given the mute remembered on the device, when the game opens again, then it is still muted; and sound is on by default", () => {
    setSoundBackend(fakeSound().backend);
    expect(soundMode()).toBe("on");
    localStorage.setItem("japacity.sound.muted", "1");
    setSoundBackend(fakeSound().backend);
    expect(soundMode()).toBe("muted");
  });

  test("given data-saver on, when clips are fetched ahead and a line is spoken, then nothing is fetched, the notice says sound is off to save data, and its tap fetches and asks for the line again", async () => {
    const fake = given({ saveData: true, awake: true });
    preload(["officer/greet"]);
    const seen = watch(speak(GREET).done);
    await after(0);
    expect(seen.finish).toBe("silent");
    expect(fake.fetched).toEqual([]);
    expect(notice()).toBe("saver");
    tapNotice("saver");
    expect(soundStore.getState().retries).toBe(1);
    preload(["officer/greet"]);
    expect(fake.fetched).toEqual(["/voice/officer/greet.opus"]);
  });

  test("given a browser that cannot play the clips, when a line is spoken, then the notice says the scene plays in text and tapping it does nothing", async () => {
    const fake = given({ supported: false });
    const seen = watch(speak(GREET).done);
    await after(0);
    expect(seen.finish).toBe("silent");
    expect(notice()).toBe("unsupported");
    tapNotice("unsupported");
    expect(fake.wakes).toBe(0);
    expect(soundStore.getState().muted).toBe(false);
  });

  test("given the sound-on notice, when it is tapped, then sound is muted and stays muted", () => {
    given({ awake: true });
    tapNotice("on");
    expect(soundStore.getState().muted).toBe(true);
    expect(localStorage.getItem("japacity.sound.muted")).toBe("1");
  });
});

describe("the notice", () => {
  test("given a notice already shown in a scene, when another case comes up in it, then nothing more shows; a new scene may show one again", async () => {
    given({ blocked: true });
    speak(GREET);
    await after(READY_MS);
    const first = soundStore.getState().notice!;
    expect(first.which).toBe("blocked");
    clearNotice(first.id);
    speak(QUESTION);
    await after(READY_MS);
    expect(notice()).toBeNull();
    beginScene("scene-2");
    speak(QUESTION);
    await after(READY_MS);
    expect(notice()).toBe("blocked");
  });
});

describe("the browser's formats", () => {
  test("given a browser that plays Opus, then Opus is asked for first and MP3 after it; given one that plays only MP3, then MP3 alone", () => {
    const spy = vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation((type) => (type.includes("opus") ? "probably" : "maybe"));
    expect(webAudioBackend().formats()).toEqual(["opus", "mp3"]);
    spy.mockImplementation((type) => (type.includes("opus") ? "" : "probably"));
    expect(webAudioBackend().formats()).toEqual(["mp3"]);
    spy.mockImplementation(() => "");
    expect(webAudioBackend().formats()).toEqual([]);
    spy.mockRestore();
  });
});
