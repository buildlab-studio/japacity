// The scene behind the panels (city.md R-CITY-029). The canvas is replaced by one that keeps its frame loop and renders only
// the scene's idle timer, so the test reads how often the scene asks for a frame without WebGL.
import { content } from "@japacity/content";
import { act, cleanup, render } from "@testing-library/react";
import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import CityScene from "./CityScene";
import { modeSettings } from "../../shared/scene/mode";
import { OPEN_STAGE, type PlaceFile } from "../../shared/scene/placeFile";
import type { SceneProps } from "./scene.types";

const invalidate = vi.fn();

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ frameloop, children }: { frameloop: string; children: ReactNode }) => (
    <div data-frameloop={frameloop}>{Children.toArray(children).filter((child) => isValidElement(child) && typeof child.type === "function" && child.type.name === "Idle")}</div>
  ),
  useThree: (pick: (state: { invalidate: () => void }) => unknown) => pick({ invalidate }),
  useFrame: () => undefined,
}));

const ROOM: PlaceFile = { place: "place.their-room", scope: "interior", hub: false, instances: [], people: { low: 0, high: 0, sample: [] }, stage: OPEN_STAGE };

function scene(looking: boolean): SceneProps {
  return {
    place: ROOM.place,
    file: ROOM,
    people: [],
    own: "shared/chr/chr_kunle.glb",
    settings: modeSettings("low", { finePointer: false, width: 390, pixelRatio: 2 }, content.tuning.city),
    looking,
    text: () => undefined,
    onProgress: () => undefined,
    onFailed: () => undefined,
    onPick: () => undefined,
    onFrame: () => undefined,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  invalidate.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the scene behind the panels", () => {
  test("[R-CITY-029] given the panels or the map stand in front of the city, when time passes, then the scene draws on demand and asks for one frame a second", () => {
    const { container } = render(<CityScene {...scene(false)} />);
    expect(container.querySelector("[data-frameloop]")?.getAttribute("data-frameloop")).toBe("demand");
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(invalidate).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(invalidate).toHaveBeenCalledTimes(5);
  });

  test("[R-CITY-029] given the city in front, when time passes, then it draws every frame and the idle timer asks for none", () => {
    const { container, rerender } = render(<CityScene {...scene(false)} />);
    rerender(<CityScene {...scene(true)} />);
    expect(container.querySelector("[data-frameloop]")?.getAttribute("data-frameloop")).toBe("always");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
