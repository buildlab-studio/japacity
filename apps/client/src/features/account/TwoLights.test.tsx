// The lines with a wink and the two lights over the start screen (docs/rules/account.md R-ACCOUNT-031).
import type { LightsReply } from "@japacity/api";
import { content } from "@japacity/content";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { cityPeople, HOME_FLOOR_BP, sharesOf, useLights } from "./lights";
import { TwoLights } from "./TwoLights";
import { forgetWinks, WINK_LINES, winkAlone, winkFor } from "../../shared/frontdoor/wink";
import { StartScreen } from "./StartScreen";

afterEach(() => {
  forgetWinks();
  delete window.__wink;
  vi.unstubAllGlobals();
});

const rows = (keys: readonly [string, string]) => keys.map((key) => say(key));

describe("the lines with a wink", () => {
  test("[R-ACCOUNT-031] [R-TEXT-006] given the start screen's lines, then there are three, two rows each, in the content's words verbatim: the owner's pick, the stayer's answer, and the saying", () => {
    expect(WINK_LINES.start).toBe(3);
    expect([1, 2, 3].map((n) => [say(`ui.wink.start.${String(n)}.a`), say(`ui.wink.start.${String(n)}.b`)])).toEqual([
      ["Last one out,", "off the light."],
      ["Not going?", "Keep the light on."],
      ["Japa is not by force.", "How ready are you?"],
    ]);
  });

  test("[R-ACCOUNT-031] [R-TEXT-006] given the start screen and the offline door, then the start screen draws one of the three under its lights, the door carries the one that needs no lights, and both say the three steps as a label strip that nothing could press", () => {
    expect(rows(winkAlone("start"))).toEqual(["Japa is not by force.", "How ready are you?"]);
    window.__wink = { start: 1 };
    render(<StartScreen onPlay={() => undefined} onReturning={() => undefined} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Last one out,off the light.");
    const steps = screen.getByRole("list", { name: say("ui.account.start.steps") });
    expect(steps.className).toContain("label");
    expect(steps.querySelectorAll("button, [role='button'], .press, .bg-sheet-muted")).toHaveLength(0);
    expect(steps.querySelectorAll("[data-start-step]")).toHaveLength(3);
  });

  test("[R-ACCOUNT-031] given a visit, then one line is drawn once on the device and kept for the whole visit, and a new visit draws again, so each line can come", () => {
    const draws: number[] = [];
    const draw = (picked: number) => (below: number) => (draws.push(below), picked);
    expect(rows(winkFor("start", draw(0)))).toEqual(["Last one out,", "off the light."]);
    expect(rows(winkFor("start", draw(2)))).toEqual(["Last one out,", "off the light."]);
    expect(draws).toEqual([3]);
    const seen = [0, 1, 2].map((picked) => {
      forgetWinks();
      return rows(winkFor("start", draw(picked)))[0];
    });
    expect(seen).toEqual(["Last one out,", "Not going?", "Japa is not by force."]);
  });

  test("[R-ACCOUNT-031] given the dev build's hook for the pictures, then it fixes the line, and a number out of range is ignored for the device's draw", () => {
    window.__wink = { start: 2 };
    expect(rows(winkFor("start", () => 0))).toEqual(["Not going?", "Keep the light on."]);
    forgetWinks();
    window.__wink = { start: 7 };
    expect(rows(winkFor("start", () => 2))).toEqual(["Japa is not by force.", "How ready are you?"]);
  });
});

/** Draws the lights with what `read` answers, as the start screen hangs them. */
function Hung({ read }: { read: (() => Promise<LightsReply | null>) | null }) {
  return <TwoLights shown={useLights(read)} />;
}

const lights = () => document.querySelector<HTMLElement>("[data-two-lights]");

describe("the two lights", () => {
  test("[R-ACCOUNT-031] given the server's counts, then HOME and ABROAD show them with Everyone playing, now under them, each glow sized by its share, and the picture says the same to a screen reader", async () => {
    let answer: (reply: LightsReply) => void = () => undefined;
    render(<Hung read={() => new Promise((resolve) => (answer = resolve))} />);
    // Still asking: the lights hang with their words and no figures, so nothing flashes from one figure to another.
    expect(lights()?.dataset.twoLights).toBe("asking");
    expect(lights()?.textContent).toBe("HOMEABROAD");
    expect(lights()?.getAttribute("aria-label")).toBe(say("ui.lights.unsaid"));
    await act(async () => {
      answer({ ok: true, home: 8410, abroad: 3190, back: 40 });
      await Promise.resolve();
    });
    expect(lights()?.dataset.twoLights).toBe("server");
    expect(lights()?.textContent).toBe("HOMEABROAD8,4103,190Everyone playing, now");
    expect(screen.getByRole("img", { name: "8,410 lives at home, 3,190 abroad" })).toBe(lights());
    const shares = [...document.querySelectorAll<HTMLElement>("[data-glow-share]")].map((glow) => Number(glow.dataset.glowShare));
    expect(shares).toEqual([7250, 2750]);
  });

  test("[R-ACCOUNT-031] given no answer from the server, then the city's own people stand in, the crowds content gives every place at home and abroad, with no caption saying they are players", async () => {
    render(<Hung read={() => Promise.reject(new Error("network"))} />);
    await waitFor(() => expect(lights()?.dataset.twoLights).toBe("city"));
    const city = cityPeople();
    const home = Object.values(content.place).filter((place) => place.where === "home");
    expect(city.home).toBe(home.reduce((sum, place) => sum + place.crowd.target, 0));
    expect(city.home).toBeGreaterThan(0);
    expect(city.abroad).toBeGreaterThan(0);
    expect(lights()?.textContent).toBe(`HOMEABROAD${city.home.toLocaleString("en-NG")}${city.abroad.toLocaleString("en-NG")}`);
    expect(lights()?.textContent).not.toContain(say("ui.lights.everyone"));
  });

  test("[R-ACCOUNT-031] given a build with no server, then the city's own people show at once and nothing is asked", () => {
    const fetching = vi.fn();
    vi.stubGlobal("fetch", fetching);
    render(<Hung read={null} />);
    expect(lights()?.dataset.twoLights).toBe("city");
    expect(fetching).not.toHaveBeenCalled();
  });

  test("[R-ACCOUNT-031] given every life abroad, or none anywhere, then home never goes dark: its glow keeps its floor, and with no lives the two glow alike", () => {
    expect(sharesOf({ from: "server", home: 0, abroad: 5000 })).toEqual({ homeBp: HOME_FLOOR_BP, abroadBp: 10_000 - HOME_FLOOR_BP });
    expect(sharesOf({ from: "server", home: 0, abroad: 0 })).toEqual({ homeBp: 5000, abroadBp: 5000 });
    expect(sharesOf({ from: "asking" })).toEqual({ homeBp: 5000, abroadBp: 5000 });
    expect(sharesOf({ from: "server", home: 900, abroad: 100 })).toEqual({ homeBp: 9000, abroadBp: 1000 });
    expect(HOME_FLOOR_BP).toBeGreaterThan(0);
  });

  test("[R-ACCOUNT-031] given the lights, then they are a picture and never a task: nothing in them can be tapped, focused or switched, and they let every touch through", () => {
    render(<TwoLights shown={{ from: "server", home: 100, abroad: 50 }} />);
    const picture = lights()!;
    expect(picture.className).toContain("pointer-events-none");
    expect(picture.querySelectorAll("button, a, input, select, [tabindex], [role='button'], [role='switch']")).toHaveLength(0);
  });

  test("[R-ACCOUNT-031] [R-WORLD-023] given reduced motion, then no spark is drawn and nothing is set moving; otherwise three sparks run out and one comes back", () => {
    const animate = vi.fn(() => ({ cancel: () => undefined, startTime: null }));
    Element.prototype.animate = animate as unknown as Element["animate"];
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), addEventListener: () => undefined, removeEventListener: () => undefined }));
    const still = render(<TwoLights shown={{ from: "server", home: 100, abroad: 50 }} />);
    expect(document.querySelectorAll("[data-light-spark]")).toHaveLength(0);
    expect(animate).not.toHaveBeenCalled();
    still.unmount();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }));
    render(<TwoLights shown={{ from: "server", home: 100, abroad: 50 }} />);
    expect([...document.querySelectorAll<HTMLElement>("[data-light-spark]")].map((spark) => spark.dataset.lightSpark)).toEqual(["out", "out", "out", "back"]);
    // Four sparks, two glows breathing and two flickering: transform and opacity only.
    expect(animate).toHaveBeenCalledTimes(8);
    for (const [frames] of animate.mock.calls as unknown as [Keyframe[]][]) for (const frame of frames) expect(Object.keys(frame).filter((key) => key !== "offset").every((key) => key === "transform" || key === "opacity")).toBe(true);
    Reflect.deleteProperty(Element.prototype, "animate");
  });
});
