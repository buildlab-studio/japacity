// An act's own line stays to be read (docs/rules/world.md R-WORLD-005, R-WORLD-010): the agent's "Not today" stood a second and gave way to the street's talk, once while the character
// was still walking. The line now stands until tapped or for at least six seconds, and starts at the thing.
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import agentFile from "../../../public/assets/places/agent-office/place.json";
import { type PlaceFile, stageOf } from "./placeFile";
import { SAID_MS, SaidLine, useSaid } from "./Said";
import { sceneWords } from "./scene.words";
import { thingsOf, walkBeforeAct } from "./things";

const AGENT_SAYS = sceneWords("city.act.ask-desk.done");

function Harness({ first }: { first: string }) {
  const { said, show, clear } = useSaid();
  return (
    <>
      <button type="button" onClick={() => show(first)} data-tap-act>
        act
      </button>
      <SaidLine said={said} onTap={clear} />
    </>
  );
}

function line(): string | null {
  return document.querySelector("[data-said]")?.textContent ?? null;
}

describe("an act's line over the place", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("[R-WORLD-005] given the agent's words said at his desk, when five seconds pass, then they still stand, and they go at six", () => {
    expect(SAID_MS).toBeGreaterThanOrEqual(6000);
    render(<Harness first={AGENT_SAYS} />);
    fireEvent.click(document.querySelector("[data-tap-act]")!);
    expect(line()).toBe(AGENT_SAYS);
    act(() => {
      vi.advanceTimersByTime(5900);
    });
    expect(line()).toBe(AGENT_SAYS);
    act(() => {
      vi.advanceTimersByTime(SAID_MS - 5900);
    });
    expect(line()).toBeNull();
  });

  test("[R-WORLD-005] given the agent's words up, when they are tapped, then they go at once", () => {
    render(<Harness first={AGENT_SAYS} />);
    fireEvent.click(document.querySelector("[data-tap-act]")!);
    fireEvent.click(document.querySelector("[data-said]")!);
    expect(line()).toBeNull();
  });
});

describe("the act starts at the thing", () => {
  test("[R-WORLD-010] given the agent's acts opened while the character stands at the office door, when Ask is tapped, then the character walks to the desk first", () => {
    const stage = stageOf(agentFile as unknown as PlaceFile);
    const agent = thingsOf(stage).find((thing) => thing.id === "agent");
    if (agent === undefined) throw new Error("No agent in the office.");
    const [x, z] = stage.start;
    const to = walkBeforeAct(stage, agent, { x, z });
    if (to === null) throw new Error("No walk from the door to the desk.");
    // Standing there already, no walk starts and the act follows at once.
    expect(walkBeforeAct(stage, agent, { x: to[0], z: to[1] })).toBeNull();
  });
});
