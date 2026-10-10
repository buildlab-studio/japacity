// How the world talks (docs/rules/world.md R-WORLD-005, R-WORLD-026; the design): a person's
// words in a bubble over their head that follows them and goes on a tap; what happens and the street's talk in the
// bottom corner, three lines at most, the older fading, each gone after a few seconds; the street waits while someone
// speaks or the corner is busy; nothing in a card across the middle of the world.
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import parlourFile from "../../../public/assets/places/family-house-parlour/place.json";
import { type PlaceFile, stageOf } from "../../features/city/placeFile";
import { cameraAt, projected } from "../../features/city/scene.testing";
import { aimShot, roomShot, shotOf } from "../../features/city/shot";
import { thingSpot, thingsOf } from "../../features/city/things";
import { standAt } from "../../features/city/walk";
import { bubbleSpot, Corner, CORNER_MAX, hear, HEARD_MS, linesNow, resetLines, speak, SPEECH_MS, SpeechBubble, TALK_EVERY_MS, tell, TOLD_MS, useStreetTalk } from "./Lines";

const MAMA = "You have eaten? Sit small.";
const ORANGES = "Mama presses a bag of oranges on you.";

function told(): string[] {
  return [...document.querySelectorAll("[data-corner] p")].map((line) => line.textContent ?? "");
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
  test("[R-WORLD-005] given Mama speaking, when the bubble shows, then it carries her name small over her words, marks her as the speaker and is no toast", () => {
    render(<SpeechBubble anchored={false} />);
    act(() => speak("mummy", "Mama", MAMA));
    expect(bubble()?.dataset.speech).toBe("mummy");
    expect(bubble()?.querySelector("[data-speech-name]")?.textContent).toBe("Mama");
    expect(bubble()?.querySelector("[data-speech-words]")?.textContent).toBe(MAMA);
    expect(document.querySelector("[data-toast]")).toBeNull();
  });

  test("[R-WORLD-005] given Mama's words up, when they are tapped, then they go at once; left alone, they go after about five seconds", () => {
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
    expect(SPEECH_MS).toBeGreaterThanOrEqual(4000);
    expect(SPEECH_MS).toBeLessThanOrEqual(6000);
  });

  test("[R-WORLD-005] given someone speaking, when another speaks, then one bubble shows, the new speaker's, and the first one's timer never takes it down", () => {
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

  test("[R-WORLD-005] given a scene drawn, when the bubble shows, then it waits hidden for the scene to place it over the speaker; while the world is covered it hides", () => {
    const { rerender } = render(<SpeechBubble anchored />);
    act(() => speak("mama", "Mama", "God bless you. Light is back."));
    expect(bubble()?.style.visibility).toBe("hidden");
    rerender(<SpeechBubble anchored hidden />);
    expect(bubble()).toBeNull();
  });

  test("[R-WORLD-005] given Mama in the parlour seen from the room's whole view, when her bubble is placed, then its tail stands over her, inside the screen and under the band; behind the camera it hides", () => {
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

describe("the bottom corner", () => {
  test("[R-WORLD-026] given four lines told and heard, when the corner shows, then it holds the newest three, the newest at the bottom, the older fading", () => {
    render(<Corner />);
    act(() => {
      hear("A hawker: Pure water!");
      tell(ORANGES);
      tell("In the box: the passport.");
      tell("Turned back at the next stop");
    });
    expect(told()).toEqual([ORANGES, "In the box: the passport.", "Turned back at the next stop"]);
    expect(CORNER_MAX).toBe(3);
    const shades = [...document.querySelectorAll<HTMLElement>("[data-corner] p")].map((line) => Number(line.style.opacity));
    expect(shades[0]).toBeLessThan(shades[1] ?? 0);
    expect(shades[1]).toBeLessThan(shades[2] ?? 0);
    expect(shades[2]).toBe(1);
    expect(document.querySelectorAll("[data-told]")).toHaveLength(3);
  });

  test("[R-WORLD-026] given a told line and a heard line, when time passes, then the told one goes after about seven seconds and the heard one after about eight", () => {
    render(<Corner />);
    act(() => {
      tell(ORANGES);
      hear("Next door: Who took my bucket?");
    });
    expect(document.querySelector("[data-heard]")?.hasAttribute("data-chatter")).toBe(true);
    act(() => {
      vi.advanceTimersByTime(TOLD_MS);
    });
    expect(told()).toEqual(["Next door: Who took my bucket?"]);
    act(() => {
      vi.advanceTimersByTime(HEARD_MS - TOLD_MS);
    });
    expect(document.querySelector("[data-corner]")).toBeNull();
  });

  test("[R-WORLD-026] given the phone over the world, when the corner shows over it, then it holds only what was told, so an app's line is read and the street's talk waits", () => {
    render(<Corner told />);
    act(() => {
      hear("A conductor: Ojuelegba!");
      tell("Money changed");
    });
    expect(told()).toEqual(["Money changed"]);
  });

  test("[R-WORLD-026] given the world covered, when lines are told, then the corner hides and keeps them for when the world shows", () => {
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
  return <Corner hidden={!free} />;
}

describe("the street's talk", () => {
  test("[R-WORLD-026] given the world free, when it opens and nine seconds pass, then a line is heard at once and another after, and none while the world is covered", () => {
    const { rerender } = render(<Street free />);
    expect(linesNow().lines.filter((line) => line.kind === "heard")).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(TALK_EVERY_MS);
    });
    expect(linesNow().lines.filter((line) => line.kind === "heard").length).toBeGreaterThanOrEqual(1);
    rerender(<Street free={false} />);
    act(() => {
      vi.advanceTimersByTime(HEARD_MS);
    });
    act(() => {
      vi.advanceTimersByTime(TALK_EVERY_MS * 2);
    });
    expect(linesNow().lines).toHaveLength(0);
  });

  test("[R-WORLD-026] given someone speaking, when the street's turn comes, then it waits; and it waits while the corner holds two lines", () => {
    act(() => speak("mama", "Mama", MAMA));
    render(<Street free />);
    expect(linesNow().lines).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(SPEECH_MS);
    });
    act(() => {
      vi.advanceTimersByTime(TALK_EVERY_MS - SPEECH_MS);
    });
    expect(linesNow().lines.filter((line) => line.kind === "heard")).toHaveLength(1);
    resetLines();
    // Two lines that stay past the street's next turn.
    act(() => {
      tell(ORANGES, TALK_EVERY_MS * 2);
      tell("In the box: the passport.", TALK_EVERY_MS * 2);
    });
    act(() => {
      vi.advanceTimersByTime(TALK_EVERY_MS);
    });
    expect(linesNow().lines.filter((line) => line.kind === "heard")).toHaveLength(0);
  });
});
