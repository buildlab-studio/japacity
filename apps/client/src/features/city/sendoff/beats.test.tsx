// The send-off's beats as pictures (docs/rules/chapter.md R-CHAPTER-012 (j) and (k)): people at one scale, the lane at
// the foot clear of every person, bubbles and chips clear of faces, the band's place never cut, each ride inside its
// own staple with the friend's ping to fit it, and the person at the stop matching the label in every city. The beats
// are drawn here with their words handed in, as the scene hands them.
import { content, text } from "@japacity/content";
import { cleanup, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ROSTER } from "../roster";
import { sendOffWords } from "../sendOff.words";
import { COUNTER, Counter, Departures, type Dress, GATE, Gate, HALL, LANE_TOP, LandingBeat, Ride, RIDE } from "./beats";
import { castFor, firstPings, landingOf, STOP_PEOPLE, stopLookFor } from "./plan";

// Every published tile is there, by its own path, so each sticker draws and its place can be read.
vi.mock("../../../shared/three/manifest", async (original) => ({
  ...(await original<typeof import("../../../shared/three/manifest")>()),
  loadManifest: () => Promise.resolve({ files: new Proxy({}, { get: (_, key) => String(key) }) }),
}));

const dress: Dress = { name: "Adaeze", first: "Ada", age: "25 yrs 6 mo", look: "chr_ada", figure: <img alt="" data-figure />, cast: castFor("chr_ada"), money: "₦12,000,741" };
const none = () => undefined;

afterEach(() => {
  cleanup();
});

/** A person's picture is twice as tall as it is wide: its foot on the stage. */
const footOf = (box: { top: number; width: number }) => box.top + box.width * 2;

/** The character's box on the stage after her own move: her place plus the translate she is given. */
function yourBox(): { left: number; top: number } {
  const you = document.querySelector<HTMLElement>("[data-so-you]");
  if (you === null) throw new Error("No character drawn.");
  const [, dx = "0", dy = "0"] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(you.style.transform) ?? [];
  return { left: Number.parseFloat(you.style.left) + Number(dx), top: Number.parseFloat(you.style.top) + Number(dy) };
}

describe("the send-off's beats, laid out", () => {
  test("[R-CHAPTER-012] given the hall, then the queue's three stand at one size with the character the queue's last, the clerks behind the counters smaller by distance, and each tap moves her up one place to the counter", () => {
    const sizes = new Set(HALL.places.map((place) => place.width));
    expect(sizes.size).toBe(1);
    for (const clerk of HALL.clerks) {
      expect(clerk.width).toBeLessThan(HALL.places[0].width);
      // Behind the desk: the clerk's foot is hidden under its top.
      expect(footOf(clerk)).toBeGreaterThan(HALL.deskTop);
    }
    // The family stands nearest, so a little larger than the queue, never smaller.
    for (const one of Object.values(HALL.family)) expect(one.width).toBeGreaterThanOrEqual(HALL.places[0].width);
    const at = (step: number) => {
      const view = render(<Departures dress={dress} step={step} said={{ name: "Mama", words: "Call when you land.", who: "mum" }} onStep={none} onLeave={none} waiting={false} />);
      const box = yourBox();
      view.unmount();
      return box;
    };
    expect(at(0)).toEqual({ left: HALL.places[2].left, top: HALL.places[2].top });
    expect(at(1)).toEqual({ left: HALL.places[1].left, top: HALL.places[1].top });
    expect(at(2)).toEqual({ left: HALL.places[0].left, top: HALL.places[0].top });
    expect(at(3)).toEqual({ left: HALL.places[0].left, top: HALL.places[0].top });
  });

  test("[R-CHAPTER-012] given the hall, the counter and the gate, then every person stands clear of the lane at the foot, and Step forward, Take the stub, Board the plane and Not yet stand in it", () => {
    const people = [...HALL.places, ...Object.values(HALL.family), COUNTER.you, ...Object.values(GATE.family), GATE.you];
    for (const person of people) expect(footOf(person)).toBeLessThanOrEqual(LANE_TOP);
    const css = readFileSync(join(import.meta.dirname, "sendoff.css"), "utf8");
    const bottom = (rule: string) => Number(new RegExp(`\\.${rule} \\{[^}]*bottom: (\\d+)px`).exec(css)?.[1] ?? "NaN");
    // The button's top: its foot's distance from the stage's foot plus its own height (padding, border and a line).
    expect(844 - bottom("so-btn") - 62).toBeGreaterThanOrEqual(LANE_TOP);
    expect(844 - bottom("so-leave") - 42).toBeGreaterThanOrEqual(LANE_TOP);
    for (const [name, beat] of [
      ["departures", <Departures key="d" dress={dress} step={0} said={{ name: "Mama", words: "Call when you land.", who: "mum" }} onStep={none} onLeave={none} waiting={false} />],
      ["counter", <Counter key="c" dress={dress} flight="Flight" to="London" seat="window" seatWords="By the window" onSeat={none} onTake={none} onLeave={none} />],
      ["gate", <Gate key="g" dress={dress} city="London" papa={{ name: "Papa", words: "Greet them for us. Go well." }} board="Board the plane" blocked={null} busy={false} rejection={null} onBoard={none} onLeave={none} />],
    ] as const) {
      const view = render(beat);
      expect([name, document.querySelector<HTMLElement>(".so-lane")?.style.top]).toEqual([name, `${String(LANE_TOP)}px`]);
      view.unmount();
    }
  });

  test("[R-CHAPTER-012] given the counter, then the officer behind it is smaller than the character and his head no higher than hers, and the Window and Aisle chips stand above his head", async () => {
    expect(COUNTER.clerk.width).toBeLessThan(COUNTER.you.width);
    expect(COUNTER.clerk.top).toBeGreaterThanOrEqual(COUNTER.you.top);
    expect(COUNTER.seats.top + COUNTER.seats.height).toBeLessThan(COUNTER.clerk.top);
    render(<Counter dress={dress} flight="Flight" to="London" seat="window" seatWords="By the window" onSeat={none} onTake={none} onLeave={none} />);
    const clerk = document.querySelector<HTMLElement>("[data-so-clerk]");
    expect(clerk?.style.top).toBe(`${String(COUNTER.clerk.top)}px`);
    await waitFor(() => expect(clerk?.querySelector<HTMLElement>("[data-so-tile]")?.style.width).toBe(`${String(COUNTER.clerk.width)}px`));
    expect(document.querySelector<HTMLElement>("[data-so-seats]")?.style.top).toBe(`${String(COUNTER.seats.top)}px`);
  });

  test("[R-CHAPTER-012] given the gate, then Papa's bubble hangs above the family's raised hands, its tail over Papa, and clear of the middle figure's head", () => {
    const foot = 844 - GATE.papa.bottom;
    // The tail reaches nine pixels under the bubble; the raised hands are the top of the cheer picture.
    expect(foot + 9).toBeLessThan(GATE.family.dad.top);
    render(<Gate dress={dress} city="London" papa={{ name: "Papa", words: "Greet them for us. Go well." }} board="Board the plane" blocked={null} busy={false} rejection={null} onBoard={none} onLeave={none} />);
    const bubble = document.querySelector<HTMLElement>("[data-so-said='dad']");
    const tail = Number.parseFloat(bubble?.style.getPropertyValue("--so-tail") ?? "NaN");
    const tip = GATE.papa.left + tail + 8;
    expect(tip).toBeGreaterThanOrEqual(GATE.family.dad.left);
    expect(tip).toBeLessThanOrEqual(GATE.family.dad.left + GATE.family.dad.width);
    expect(tail + 16).toBeLessThanOrEqual(GATE.papa.width);
  });

  test("[R-CHAPTER-012] given the band on any beat, then its place line is never cut: the place wraps to a second line and no ellipsis is drawn", () => {
    const css = readFileSync(join(import.meta.dirname, "sendoff.css"), "utf8");
    const rule = /\.so-band \.who > span \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).not.toBe("");
    expect(rule).not.toMatch(/text-overflow|white-space:\s*nowrap|overflow:\s*hidden/);
    expect(css).not.toMatch(/\.so-band[^{]*\{[^}]*text-overflow/);
  });

  test.each(["country.uk", "country.canada", "country.uae", "country.italy"] as const)("[R-CHAPTER-012] given the first ride in %s, then the inside is the staple's own, the friend's ping fits it, the pings and the card saved stand clear of the character, and every ping is whole", (country) => {
    const landing = landingOf(country)!;
    const pings = firstPings("scenario.ada", landing.staple).map((ping) => ({ from: ping.from, words: sendOffWords(ping.key) }));
    render(<Ride dress={dress} landing={landing} place="Rye Lane, London" marker="Rye Lane" pings={pings} saved="Send-off card saved" onRing={none} />);
    const inside: Record<string, string> = { "double-decker": ".so-pole", pickup: ".so-wheel", taxi: ".so-headrest", "domitiana-bus": ".so-rail" };
    expect(document.querySelector("[data-so-beat='ride']")?.getAttribute("data-staple")).toBe(landing.staple);
    expect(document.querySelector(inside[landing.staple]!)).not.toBeNull();
    for (const [staple, selector] of Object.entries(inside)) if (staple !== landing.staple && selector !== ".so-pole") expect(document.querySelector(selector)).toBeNull();
    const ending: Record<string, string> = { "double-decker": "Even the bus stop.", pickup: "Even the truck.", taxi: "Even the taxi.", "domitiana-bus": "Even the bus stop." };
    expect(document.querySelector("[data-so-ping='2']")?.textContent).toContain(ending[landing.staple]);
    expect(text["chats.friend.landed.text"]).toContain("Even the bus stop.");
    // The pings to her left, the card saved in the toast lane over the window, "So this is it." over her head.
    expect(RIDE.pings.left + RIDE.pings.width).toBeLessThan(RIDE.you.left);
    expect(RIDE.toastTop + 34).toBeLessThanOrEqual(RIDE.window.top);
    expect(844 - RIDE.said.bottom).toBeLessThan(RIDE.you.top);
    expect(document.querySelector("[data-so-saved]")?.classList.contains("so-toast")).toBe(true);
    const css = readFileSync(join(import.meta.dirname, "sendoff.css"), "utf8");
    expect(/\.so-ping \.words \{([^}]*)\}/.exec(css)?.[1]).not.toMatch(/line-clamp|overflow:\s*hidden/);
  });

  test.each(Object.keys(STOP_PEOPLE))("[R-CHAPTER-012] given the landing in %s, then the person at the stop is that city's own look, of the sex the label names, never the character's own", async (country) => {
    const landing = landingOf(country as `country.${string}`)!;
    const people = STOP_PEOPLE[country]!;
    const label = sendOffWords(`sendoff.landing.by.${country}`);
    const named = /^(Aunty|Sister|Woman)\b/.test(label) ? "f" : /^(Man|Brother|Uncle)\b/.test(label) ? "m" : null;
    if (named !== null) expect([label, people.sex]).toEqual([label, named]);
    for (const look of people.looks) {
      expect([look, ROSTER.find((person) => person.file === `shared/chr/${look}.glb`)?.sex]).toEqual([look, people.sex]);
      expect(content.place[landing.hub]).toBeDefined();
    }
    // Each city its own, never one person for all.
    const firsts = Object.values(STOP_PEOPLE).map((each) => each.looks[0]);
    expect(new Set(firsts).size).toBe(firsts.length);
    expect(stopLookFor(landing.country, people.looks[0])).toBe(people.looks[1]);
    render(<LandingBeat dress={dress} landing={landing} place="Peckham, London" weather="4 degrees" marker="Peckham Rye" heard={{ name: label, words: "You just land?", look: stopLookFor(landing.country, dress.look) }} go="Get on the bus" blind="12 · PECKHAM" onGo={none} />);
    expect(document.querySelector("[data-so-stop-person]")?.getAttribute("data-so-stop-person")).toBe(people.looks[0]);
    await waitFor(() => expect(document.querySelector(`[data-so-stop-person] [data-so-tile='${people.looks[0]}-figure']`)).not.toBeNull());
  });
});
