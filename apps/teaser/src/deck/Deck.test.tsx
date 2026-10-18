import { Player } from "@remotion/player";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Internals } from "remotion";
import { afterEach, describe, expect, test } from "vitest";

import { CLIPS } from "../clips";
import { VIDEO } from "../parts/tokens";
import { DECK_CLIPS, DECK_FRAMES, Deck } from "./Deck";

// React's act() needs this flag in a test page.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mounted: { unmount: () => void; host: HTMLElement } | null = null;

afterEach(() => {
  act(() => mounted?.unmount());
  mounted?.host.remove();
  mounted = null;
});

/** The deck cut drawn at one frame, as Remotion's player draws it; the page is returned to be read. */
function mountAt(frame: number): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <Internals.SequenceManagerProvider>
        <Player component={Deck} compositionWidth={VIDEO.width} compositionHeight={VIDEO.height} durationInFrames={DECK_FRAMES} fps={VIDEO.fps} initialFrame={frame} acknowledgeRemotionLicense />
      </Internals.SequenceManagerProvider>,
    );
  });
  mounted = { unmount: () => root.unmount(), host };
  return host;
}

describe("the teaser's deck cut", () => {
  test("given the deck cut, when its length is read, then it lasts ten seconds at thirty frames a second", () => {
    expect(DECK_FRAMES).toBe(10 * VIDEO.fps);
  });

  test("given the clips it lists, when it is mounted in the middle of each one's span, then the window draws that clip from the clips folder", () => {
    const missing: string[] = [];
    for (const span of DECK_CLIPS) {
      const page = mountAt(Math.floor((span.from + span.to) / 2));
      const file = CLIPS.find((one) => one.name === span.name)?.file ?? `${span.name} (not listed)`;
      const sources = [...page.querySelectorAll("video")].map((video) => video.getAttribute("src") ?? "");
      if (!sources.some((source) => source.includes(`clips/${file}`))) missing.push(span.name);
      act(() => mounted?.unmount());
      mounted?.host.remove();
      mounted = null;
    }
    expect(missing).toEqual([]);
  });
});
