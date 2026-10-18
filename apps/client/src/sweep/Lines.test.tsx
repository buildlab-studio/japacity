// How the world talks (world:things-are-tappable-models, world:street-talk-budget; the talk budget, docs/design/13-the-lively-layer.md
// section 5): a person's words in a bubble over their head that follows them and goes on a tap, at most eight words for
// about four seconds, a longer line clipped to two lines that opens whole in a sheet with their name; the street's talk as an ambient bubble
// over the resident nearest, with twenty seconds of quiet after; the bottom corner for the player's own act's answer alone,
// one line at a time; nothing in a card across the middle of the world.
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import parlourFile from "../../public/assets/places/home-family-house/place.json";
import { type PlaceFile, stageOf } from "../shared/scene/placeFile";
import { cameraAt, projected } from "../features/city/scene/scene.testing";
import { aimShot, roomShot, shotOf } from "../features/city/scene/shot";
import { thingSpot, thingsOf } from "../features/city/scene/things";
import { standAt } from "../shared/scene/walk";
import { bubbleRect, bubbleSpot, Corner, CORNER_MAX, isLong, LIFT_MAX, linesNow, murmur, NEAR_SPEAKER, overlap, QUIET_MS, resetLines, speak, SPEECH_MS, SpeechBubble, TAIL, TAIL_MAX, tailPaths, TALK_EVERY_MS, JOIN_MS, tell, TOLD_MS, useStreetTalk, WORDS_MAX } from "../shared/world/Lines";

const MAMA = "You have eaten? Sit small.";
const ORANGES = "Mama presses a bag of oranges on you.";

function told(): string[] {
  return [...document.querySelectorAll("[data-corner]")].map((line) => line.textContent ?? "");
}

function bubble(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-speech]");
}

beforeEach(() => {
  vi.useFakeTimers();
  resetLines();
});
afterEach(() => {
  cleanup();
  resetLines();
  vi.useRealTimers();
});

describe("the bubble over a person", () => {
  test("[world:things-are-tappable-models] given Mama speaking, when the bubble shows, then it carries her name small over her words, marks her as the speaker and is no toast", () => {
    render(<SpeechBubble anchored={false} />);
    act(() => speak("mummy", "Mama", MAMA));
    expect(bubble()?.dataset.speech).toBe("mummy");
    expect(bubble()?.querySelector("[data-speech-name]")?.textContent).toBe("Mama");
    expect(bubble()?.querySelector("[data-speech-words]")?.textContent).toBe(MAMA);
    expect(document.querySelector("[data-toast]")).toBeNull();
  });

  test("[world:things-are-tappable-models] [world:street-talk-budget] given Mama's words up, when they are tapped, then they go at once; left alone, they go after about four seconds", () => {
    render(<SpeechBubble anchored={false} />);
    act(() => speak("mummy", "Mama", MAMA));
    fireEvent.click(bubble()!);
    expect(bubble()).toBeNull();
    act(() => speak("mummy", "Mama", MAMA));
    act(() => {
      vi.advanceTimersByTime(SPEECH_MS - 1);
    });
    expect(bubble()).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(bubble()).toBeNull();
    // The talk budget: about four seconds a bubble.
    expect(SPEECH_MS).toBeGreaterThanOrEqual(3500);
    expect(SPEECH_MS).toBeLessThanOrEqual(4500);
  });

  test("[world:things-are-tappable-models] given someone speaking, when another speaks, then one bubble shows, the new speaker's, and the first one's timer never takes it down", () => {
    render(<SpeechBubble anchored={false} />);
    act(() => speak("agent", "Agent", "Not today."));
    act(() => {
      vi.advanceTimersByTime(SPEECH_MS - 100);
    });
    act(() => speak("officer", "The officer", "Nothing for you today."));
    expect(document.querySelectorAll("[data-speech]")).toHaveLength(1);
    expect(bubble()?.dataset.speech).toBe("officer");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(bubble()?.dataset.speech).toBe("officer");
  });

  test("[world:things-are-tappable-models] given a scene drawn, when the bubble shows, then it waits hidden for the scene to place it over the speaker; while the world is covered it hides", () => {
    const { rerender } = render(<SpeechBubble anchored />);
    act(() => speak("mama", "Mama", "God bless you. Light is back."));
    expect(bubble()?.style.visibility).toBe("hidden");
    rerender(<SpeechBubble anchored hidden />);
    expect(bubble()).toBeNull();
  });

  test("[world:things-are-tappable-models] given Mama in the parlour seen from the room's whole view, when her bubble is placed, then its tail stands over her, inside the screen and under the band; behind the camera it hides", () => {
    const stage = stageOf(parlourFile as unknown as PlaceFile);
    const mama = thingsOf(stage).find((thing) => thing.id === "mama");
    const spot = mama === undefined ? null : thingSpot(stage, mama);
    if (spot === null) throw new Error("The parlour has no Mama.");
    const size = { width: 390, height: 844 };
    const shot = roomShot(shotOf(stage), stage, "interior");
    const camera = cameraAt(aimShot(shot, { zoom: 1, turn: 0 }, standAt(...stage.start), size.width / size.height), size.width / size.height);
    const at = projected(camera, spot[0], 2.6, spot[1]);
    const placed = bubbleSpot({ x: at.x, y: at.y, z: at.inFront ? 0.5 : 2 }, size, { width: 180, height: 60 }, 120);
    expect(placed.shown).toBe(true);
    const over = { x: ((at.x + 1) / 2) * size.width, y: ((1 - at.y) / 2) * size.height };
    expect(placed.x).toBeCloseTo(Math.min(Math.max(over.x, 98), size.width - 98), 5);
    expect(placed.y).toBeGreaterThanOrEqual(120 + 60);
    expect(placed.y).toBeLessThanOrEqual(size.height);
    // Near an edge the bubble is held inside the screen; behind the camera it is not shown.
    expect(bubbleSpot({ x: 0.99, y: 0, z: 0.5 }, size, { width: 180, height: 60 }).x).toBe(size.width - 98);
    expect(bubbleSpot({ x: -0.99, y: 0.99, z: 0.5 }, size, { width: 180, height: 60 }, 120)).toMatchObject({ x: 98, y: 188 });
    expect(bubbleSpot({ x: 0, y: 0, z: 1.2 }, size, { width: 180, height: 60 }).shown).toBe(false);
  });
});

describe("the bubble's tail and its room", () => {
  test("[world:street-talk-budget] given a person speaking, when the bubble shows, then its tail is drawn in the bubble's own fill with the edge round its sides and the underside under its point, and its words wear one pair of curly quotes that are the bubble's, not the line's", () => {
    render(<SpeechBubble anchored={false} />);
    act(() => speak("mama", "Mama", MAMA));
    const tail = bubble()?.querySelector("[data-speech-tail]");
    expect(tail?.querySelector(".talk-tail-fill")?.getAttribute("d")).toMatch(/^M/);
    expect(tail?.querySelector(".talk-tail-edge")?.getAttribute("d")).toMatch(/^M/);
    expect(tail?.querySelector(".talk-tail-under")?.getAttribute("d")).toMatch(/^M/);
    const words = bubble()?.querySelector("[data-speech-words]");
    expect(words?.classList.contains("talk-said")).toBe(true);
    expect(words?.textContent).toBe(MAMA);
  });

  test("[world:street-talk-budget] given a bubble moved off its speaker, when its tail is drawn, then it leaves the box between its rounded corners, starts inside the box so its fill covers the edge there, and its point ends over the speaker", () => {
    const paths = tailPaths(240, { x: -150, length: 70 });
    const points = (d: string): number[][] => [...d.matchAll(/([\d.-]+) ([\d.-]+)/g)].map((match) => [Number(match[1]), Number(match[2])]);
    const fill = points(paths.fill);
    // The point is 150 pixels left of the box's middle and 70 under its foot: past the box's left end.
    expect(fill[2]).toEqual([-30, 70]);
    // The base stays inside the box, clear of its rounded corner, and starts inside it.
    for (const [x, y] of fill.slice(0, 2)) {
      expect(x).toBeGreaterThanOrEqual(8);
      expect(y).toBeLessThan(0);
    }
    expect(points(paths.edge)[1]).toEqual([-30, 70]);
  });

  test("[world:street-talk-budget] given heads right over the speaker, when the bubble is placed, then it steps aside or rises clear of them, its tail reaching down to the speaker and never longer than a bubble's height; with room it keeps the spot it had, so it does not hop; a dot under it is better than a far spot", () => {
    const size = { width: 412, height: 839 };
    const box = { width: 220, height: 70 };
    const at = { x: 0, y: -0.1, z: 0.5 };
    const over = { x: 206, y: ((1 + 0.1) / 2) * 839 };
    const plain = bubbleSpot(at, size, box, 120);
    // Two heads where the plain bubble stands, one each side of the speaker.
    const clear = [
      { left: 150, right: 170, top: over.y - 60, bottom: over.y - 40 },
      { left: 240, right: 260, top: over.y - 50, bottom: over.y - 30 },
    ];
    expect(clear.some((head) => overlap(bubbleRect(plain, box), head) > 0)).toBe(true);
    const placed = bubbleSpot(at, size, box, 120, { clear });
    expect(clear.every((head) => overlap(bubbleRect(placed, box), head) === 0)).toBe(true);
    expect(placed.x + placed.tail.x).toBeCloseTo(over.x, 5);
    expect(placed.y - TAIL + placed.tail.length).toBeCloseTo(over.y, 5);
    // The last frame's spot, still clear, is kept over a nearer one.
    const kept = bubbleSpot(at, size, box, 120, { clear: [], last: { lift: placed.lift, shift: placed.shift } });
    expect([kept.lift, kept.shift]).toEqual([placed.lift, placed.shift]);
    // A near spot over a thing's dot beats a far one: the bubble stays over its speaker rather than rise off the dot.
    const soft = [{ left: 200, right: 212, top: over.y - 30, bottom: over.y - 18 }];
    const onDot = bubbleSpot(at, size, box, 120, { soft });
    expect([onDot.lift, onDot.shift]).toEqual([0, 0]);
    // Where no near spot is clear of the heads, the bubble stands over the crowd, its tail at the longest and no longer.
    const crowd = [-160, -120, -80, -40, 0, 40, 80, 120, 160].flatMap((dx) => [0, 30, 60].map((up) => ({ left: over.x + dx - 10, right: over.x + dx + 10, top: over.y - 40 - up, bottom: over.y - 28 - up })));
    const high = bubbleSpot(at, size, box, 120, { clear: crowd });
    expect(high.tail.length).toBe(TAIL_MAX);
    expect(high.lift).toBe(LIFT_MAX);
  });
});

describe("the talk budget's words", () => {
  test("[world:street-talk-budget] given a line of at most eight words, when a person says it, then it floats whole; a longer line shows … and a tap opens it in a sheet with their name", () => {
    render(<SpeechBubble anchored={false} />);
    expect(WORDS_MAX).toBe(8);
    const long = "The universities are coming to the hub this week, they say.";
    expect(isLong(MAMA)).toBe(false);
    expect(isLong(long)).toBe(true);
    act(() => speak("mummy", "Mama", long));
    // The words show, clipped to two lines by the bubble's class; the whole line opens on the tap.
    expect(bubble()?.querySelector("[data-speech-words]")?.textContent).toBe(long);
    expect(bubble()?.querySelector("[data-speech-words]")?.className).toContain("talk-clip");
    expect(bubble()?.hasAttribute("data-speech-long")).toBe(true);
    fireEvent.click(bubble()!);
    expect(bubble()).toBeNull();
    const sheet = document.querySelector("[data-talk-open]");
    expect(sheet?.textContent).toContain(long);
    expect(document.querySelector("[data-lively-sheet]")?.textContent).toContain("Mama");
  });

  test("[world:street-talk-budget] given the street's talk, when a line comes, then it floats over the resident nearest the player, and the next waits at least twenty seconds of quiet; never over someone speaking", () => {
    render(<SpeechBubble anchored={false} />);
    const start = Date.now();
    act(() => {
      expect(murmur("Pure water! Pure water!", start)).toBe(true);
    });
    expect(bubble()?.dataset.speech).toBe(NEAR_SPEAKER);
    act(() => {
      vi.advanceTimersByTime(SPEECH_MS);
    });
    expect(bubble()).toBeNull();
    expect(QUIET_MS).toBeGreaterThanOrEqual(20000);
    expect(murmur("Ojuelegba! Enter with your change!", start + SPEECH_MS + QUIET_MS - 1)).toBe(false);
    expect(murmur("Ojuelegba! Enter with your change!", start + SPEECH_MS + QUIET_MS)).toBe(true);
    act(() => resetLines());
    act(() => speak("mummy", "Mama", MAMA));
    expect(murmur("Pure water!")).toBe(false);
    expect(bubble()?.dataset.speech).toBe("mummy");
  });
});

describe("the bottom corner", () => {
  test("[world:street-talk-budget] given lines told, when the corner shows, then it holds one at a time, the first told first, the player's own act's answer, and never the street's talk", () => {
    render(<Corner />);
    act(() => {
      murmur("A hawker: Pure water!");
      tell(ORANGES);
      tell("In the box: the passport.");
    });
    expect(CORNER_MAX).toBe(1);
    expect(told()).toEqual([ORANGES]);
    expect(document.querySelector("[data-heard], [data-chatter]")).toBeNull();
  });

  test("[world:street-talk-budget] given two lines told together, when time passes, then the first stands about seven seconds, then the second takes its turn for its own time, then the corner is empty", () => {
    render(<Corner />);
    act(() => {
      tell(ORANGES);
      tell("Turned back at the next stop");
    });
    expect(told()).toEqual([ORANGES]);
    act(() => {
      vi.advanceTimersByTime(TOLD_MS);
    });
    expect(told()).toEqual(["Turned back at the next stop"]);
    act(() => {
      vi.advanceTimersByTime(TOLD_MS);
    });
    expect(document.querySelector("[data-corner]")).toBeNull();
  });

  test("[world:street-talk-budget] given a line showing, when a new tap is answered a while later, then its line takes the corner at once and the old one is gone", () => {
    render(<Corner />);
    act(() => tell(ORANGES));
    act(() => {
      vi.advanceTimersByTime(JOIN_MS + 1);
    });
    act(() => tell("Money moved"));
    expect(told()).toEqual(["Money moved"]);
    act(() => {
      vi.advanceTimersByTime(TOLD_MS);
    });
    expect(document.querySelector("[data-corner]")).toBeNull();
  });

  test("[world:street-talk-budget] given the phone over the world, when the corner shows over it, then it holds what was told, so an app's line is read", () => {
    render(<Corner told />);
    act(() => {
      tell("Money changed");
    });
    expect(told()).toEqual(["Money changed"]);
  });

  test("[world:street-talk-budget] given the world covered, when lines are told, then the corner hides and keeps them for when the world shows", () => {
    const { rerender } = render(<Corner hidden />);
    act(() => tell(ORANGES));
    expect(document.querySelector("[data-corner]")).toBeNull();
    rerender(<Corner />);
    expect(told()).toEqual([ORANGES]);
  });
});

function Street({ free }: { free: boolean }) {
  let n = 0;
  useStreetTalk(() => {
    n += 1;
    return `Talk ${String(n)}`;
  }, free);
  return <SpeechBubble anchored={false} hidden={!free} />;
}

describe("the street's talk", () => {
  test("[world:street-talk-budget] given the world free, when it opens, then a line floats at once over the resident nearest, the next only after the quiet, and none while the world is covered", () => {
    const { rerender } = render(<Street free />);
    expect(linesNow().speech?.text).toBe("Talk 1");
    expect(linesNow().lines).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(TALK_EVERY_MS);
    });
    expect(linesNow().speech).toBeNull();
    // The first turn after the bubble and its quiet have passed.
    const nextTurn = Math.ceil((SPEECH_MS + QUIET_MS) / TALK_EVERY_MS) * TALK_EVERY_MS;
    act(() => {
      vi.advanceTimersByTime(nextTurn - TALK_EVERY_MS - 1);
    });
    expect(linesNow().speech).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(linesNow().speech?.text).toBe("Talk 2");
    rerender(<Street free={false} />);
    act(() => {
      vi.advanceTimersByTime((SPEECH_MS + QUIET_MS) * 2);
    });
    expect(linesNow().speech).toBeNull();
  });

  test("[world:street-talk-budget] given someone speaking, when the street's turn comes, then it waits", () => {
    act(() => speak("mama", "Mama", MAMA, TALK_EVERY_MS * 2));
    render(<Street free />);
    expect(linesNow().speech?.who).toBe("mama");
    act(() => {
      vi.advanceTimersByTime(TALK_EVERY_MS);
    });
    expect(linesNow().speech?.who).toBe("mama");
  });
});

function Named({ heard }: { heard: { text: string; name?: string; who?: string } }) {
  useStreetTalk(() => heard, true, "Someone in the house");
  return <SpeechBubble anchored={false} />;
}

describe("a line overheard with its speaker", () => {
  test("[world:street-talk-budget] given a line content names a speaker for, when it floats, then the bubble says their name, over them where they stand; a line with no speaker keeps the house's voice over the resident nearest", () => {
    const { unmount } = render(<Named heard={{ text: "Your uncle called. When are you going?", name: "Mama", who: "mama" }} />);
    expect(linesNow().speech).toMatchObject({ who: "mama", name: "Mama", text: "Your uncle called. When are you going?" });
    expect(document.querySelector("[data-speech='mama']")?.textContent).toContain("Mama");
    unmount();
    resetLines();
    render(<Named heard={{ text: "Whose turn to sweep the compound this week?" }} />);
    expect(linesNow().speech).toMatchObject({ who: NEAR_SPEAKER, name: "Someone in the house" });
  });
});

