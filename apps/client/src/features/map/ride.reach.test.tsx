// The ride's card, reached and read (world:costly-acts-confirmed, world:reach-and-read): Turn back stands apart from Skip in the warning
// colour and asks once more, naming the fare it throws away, with keeping on the main button; the bar says how far the ride has come
// to a screen reader; and under Reduce Motion it steps once a second instead of gliding.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { stubReducedMotion } from "../../shared/testing/motion";
import { mapWords } from "./map.words";
import { Ride, RIDE_MS } from "./Ride";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function run(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("turning back from a ride (world:costly-acts-confirmed)", () => {
  test("[world:costly-acts-confirmed] given a ride with a fare, when Turn back is tapped, then it asks once more naming the fare, keeping on is the main button, and only the second tap turns back", async () => {
    vi.useFakeTimers();
    const onTurnBack = vi.fn();
    const onDone = vi.fn();
    render(<Ride way="danfo" place="Bode Thomas Street" from="Ojuelegba" drawing={false} onDone={onDone} onTurnBack={onTurnBack} lost="₦300" />);
    await run(500);
    fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.turn-back") }));
    expect(onTurnBack).not.toHaveBeenCalled();
    const ask = document.querySelector("[data-ride-turn-back-ask]") as HTMLElement;
    expect(ask.textContent).toContain(mapWords("map.ride.turn-back.ask", { fare: "₦300" }));
    const keep = screen.getByRole("button", { name: mapWords("map.ride.turn-back.keep") });
    expect(keep.className).toContain("press-button");
    const confirm = screen.getByRole("button", { name: mapWords("map.ride.turn-back") });
    expect(confirm.className).toContain("warn-button");
    expect(confirm.className).not.toContain("press-button");

    fireEvent.click(keep);
    expect(document.querySelector("[data-ride-turn-back-ask]")).toBeNull();
    expect(onTurnBack).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.turn-back") }));
    fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.turn-back") }));
    expect(onTurnBack).toHaveBeenCalledTimes(1);
    await run(RIDE_MS);
    expect(onDone).not.toHaveBeenCalled();
  });

  test("[world:costly-acts-confirmed] given a ride, then Turn back stands apart from Skip in the warning colour, never in Skip's dress beside it", () => {
    render(<Ride way="danfo" place="Bode Thomas Street" from="Ojuelegba" drawing={false} onDone={() => undefined} onTurnBack={() => undefined} lost="₦300" />);
    const skip = document.querySelector("[data-ride-skip]") as HTMLElement;
    const back = document.querySelector("[data-ride-turn-back]") as HTMLElement;
    expect(back.parentElement).not.toBe(skip.parentElement);
    expect(back.className).toContain("warn-chip");
    expect(back.classList.contains("chip")).toBe(false);
  });

  test("[world:costly-acts-confirmed] given a walk, which costs no fare, when Turn back is tapped, then it turns back at once: nothing is lost to name", async () => {
    vi.useFakeTimers();
    const onTurnBack = vi.fn();
    render(<Ride way="walk" place="Tejuosho Market" from="Ojuelegba" drawing={false} onDone={() => undefined} onTurnBack={onTurnBack} />);
    await run(300);
    fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.turn-back") }));
    expect(onTurnBack).toHaveBeenCalledTimes(1);
  });
});

describe("the ride's bar (world:reach-and-read)", () => {
  const bar = () => screen.getByRole("progressbar");
  const fill = () => document.querySelector("[data-ride-progress]") as HTMLElement;

  test("[world:reach-and-read] given a ride under way, then its bar tells a screen reader how far the ride has come", async () => {
    vi.useFakeTimers();
    render(<Ride way="danfo" place="Bode Thomas Street" drawing={false} onDone={() => undefined} />);
    expect(bar().getAttribute("aria-valuenow")).toBe("0");
    await run(RIDE_MS / 2);
    const now = Number(bar().getAttribute("aria-valuenow"));
    expect(now).toBeGreaterThanOrEqual(40);
    expect(now).toBeLessThanOrEqual(60);
  });

  test("[world:reach-and-read] given Reduce Motion, then the bar steps once a second rather than gliding, and still fills as the ride goes", async () => {
    stubReducedMotion(true);
    vi.useFakeTimers();
    render(<Ride way="danfo" place="Bode Thomas Street" drawing={false} onDone={() => undefined} />);
    await run(1_100);
    const first = fill().style.transform;
    await run(400);
    expect(fill().style.transform).toBe(first);
    await run(700);
    expect(fill().style.transform).not.toBe(first);
    expect(fill().style.transform).toBe(`scaleX(${String(2_000 / RIDE_MS)})`);
  });
});
