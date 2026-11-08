// The plan follows the grant (chapter:chapters-follow-lean-route): once the skilled worker's visa is
// granted, Japa's "Your plan" names it and the Papers app counts toward it, though the route has no file of its own,
// and nothing on either screen falls back to a raw words key.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { recordedGame, recordedSave } from "../../../shared/testing/fixtures";
import { hasWords, nameOf } from "../../../shared/words/text";
import { reloadSeen } from "../seen";
import { openJapa } from "../phone.testing";

const SKILLED = "route.uk-skilled";
/** A words key left on screen: a dotted id with no words behind it. */
const RAW_KEY = /\b(?:route|chapter|phone|ui|document|status)\.[a-z0-9-]+\.[a-z0-9.-]+/;

beforeEach(() => {
  localStorage.clear();
  reloadSeen();
});

/** The graduate's abroad life granted the skilled worker's visa, at home in the month it flies, before the flight. */
function grantedSkilled(): PlayerView {
  const commands = recordedSave("graduate-abroad").commands;
  const flight = commands.findIndex((entry) => entry.command.type === "route/depart");
  const view = recordedGame("graduate-abroad", commands.length - flight).view();
  if (view.place.where !== "home" || view.routes.find((route) => route.id === SKILLED)?.state !== "granted") throw new Error("The graduate is not granted the skilled visa at home.");
  return view;
}

describe("the plan once a route with no file is granted", () => {
  test("[chapter:chapters-follow-lean-route] given the skilled worker's visa granted to a life that leaned to the master's, when Japa opens, then Your plan names the skilled route with no file line, and no raw words key shows", async () => {
    const view = grantedSkilled();
    expect(view.plan.route).toBe(SKILLED);
    expect(hasWords(`${SKILLED}.file`)).toBe(false);
    expect(content.route[SKILLED]).toBeDefined();
    await openJapa(view);
    const head = document.querySelector("[data-japa-plan]");
    expect(head?.getAttribute("data-japa-plan")).toBe(SKILLED);
    expect(head?.textContent).toContain(nameOf(SKILLED));
    expect(document.querySelector("[data-japa-file]")).toBeNull();
    expect(document.querySelector('[data-phone-app="japa"]')?.textContent).not.toMatch(RAW_KEY);
  });

  test("[chapter:chapters-follow-lean-route] given the same life, when the Papers app opens, then a paper counts toward the skilled route first and no raw words key shows", async () => {
    await openJapa(grantedSkilled());
    fireEvent.click(document.querySelector<HTMLElement>("[data-open-papers]")!);
    const papers = document.querySelector("[data-papers]");
    expect(papers).not.toBeNull();
    expect(papers?.textContent).not.toMatch(RAW_KEY);
    // text:show-then-tell: each way it counts toward is a plane chip, the skilled route's first.
    const ways = [...document.querySelectorAll('[data-paper="document.passport"] [data-counts]')].map((chip) => chip.getAttribute("data-counts"));
    expect(ways[0]).toBe(SKILLED);
    expect(ways).toContain("route.uk-masters");
  });
});
