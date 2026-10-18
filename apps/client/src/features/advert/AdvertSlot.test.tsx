import type { ServedAdvert } from "@japacity/api";
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { ADVERT_COUNTERS, advertsShown, forgetImpressions } from "./advert";
import type { CountAdvert } from "./advert";
import { AdvertSlot } from "./AdvertSlot";

const SLOTS = Object.keys(content.advert) as Id<"advert">[];

const SERVED: ServedAdvert = {
  campaign: "campaign-1",
  creative: "creative-1",
  version: 1,
  image: "/api/adverts/image/creative-1/1",
  width: 1024,
  height: 512,
  advertiser: "Mama Put Kitchen",
  text: "Jollof on the island.",
  link: "https://example.com/menu",
};

/** A stand-in IntersectionObserver the test drives by hand. */
let observed: ((ratio: number) => void) | null = null;

class TestObserver {
  constructor(private readonly callback: (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void) {}
  observe() {
    observed = (ratio) => this.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]);
  }
  disconnect() {
    observed = null;
  }
}

beforeEach(() => {
  forgetImpressions();
  vi.stubGlobal("IntersectionObserver", TestObserver);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  observed = null;
});

function shownView(): PlayerView {
  return { ...engineView(), adverts: true };
}

describe("an advert slot", () => {
  test("[advert:no-adverts-on-protected-screens] given a view whose adverts are off, as in a noAdverts chapter, on the road or in a set piece, when every slot is drawn, then none renders", async () => {
    const quiet: PlayerView[] = [
      { ...shownView(), adverts: false },
      { ...shownView(), place: { ...shownView().place, where: "road" } },
      { ...richView(), adverts: true },
    ];
    for (const view of quiet) {
      expect(advertsShown(view)).toBe(false);
      await renderSlots(view);
      expect(document.querySelectorAll("[data-advert-slot]")).toHaveLength(0);
      cleanup();
    }
  });

  test("[advert:no-adverts-on-protected-screens] given the current chapter marked noAdverts in content, when a view still says adverts may show, then every slot hides", async () => {
    const view = shownView();
    const id = view.chapter.current;
    const entry = id === null ? undefined : content.chapter[id];
    if (id === null || entry === undefined) throw new Error("A new life has a current chapter.");
    await renderSlots(view);
    expect(document.querySelectorAll("[data-advert-slot]")).toHaveLength(SLOTS.length);
    cleanup();
    content.chapter[id] = { ...entry, noAdverts: true };
    try {
      await renderSlots(view);
      expect(document.querySelectorAll("[data-advert-slot]")).toHaveLength(0);
    } finally {
      content.chapter[id] = entry;
    }
  });

  test("[advert:one-labelled-still-image] given an advert for the slot, when it is drawn, then the image shows at its size with the game's own Advert label; with none, the slot's empty board shows", async () => {
    await renderWithView(
      <>
        <AdvertSlot slot="advert.road-billboard" served={SERVED} baseUrl="https://game.test" />
        <AdvertSlot slot="advert.phone-tile" served={null} />
      </>,
      shownView(),
    );
    const filled = document.querySelector("[data-advert-slot='advert.road-billboard']") as HTMLElement;
    const image = within(filled).getByRole("img");
    expect(image.getAttribute("src")).toBe("https://game.test/api/adverts/image/creative-1/1");
    expect(image.getAttribute("width")).toBe("1024");
    expect(within(filled).getByText(say("advert.label"))).toBeDefined();
    const empty = document.querySelector("[data-advert-slot='advert.phone-tile']") as HTMLElement;
    expect(empty.hasAttribute("data-advert-empty")).toBe(true);
    expect(empty.getAttribute("aria-label")).toBe(say("advert.empty"));
  });

  test("[advert:tap-opens-advert-card] [advert:adverts-change-no-simulation] given an advert, when it is tapped and its link followed, then the game's card shows first, the leaving notice next, and nothing opens or is sent to the game by itself", async () => {
    const opened = vi.fn();
    vi.stubGlobal("open", opened);
    const { authority } = await renderWithView(<AdvertSlot slot="advert.road-billboard" served={SERVED} />, shownView());
    fireEvent.click(screen.getByRole("button", { name: `${say("advert.label")}: ${SERVED.advertiser}` }));
    expect(screen.getByText(SERVED.advertiser)).toBeDefined();
    expect(screen.getByText(SERVED.text)).toBeDefined();
    expect(screen.getByText(say("advert.card.note"))).toBeDefined();
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("advert.card.visit") }));
    expect(screen.getByText(say("advert.card.leaving.title"))).toBeDefined();
    const link = screen.getByRole("link", { name: say("advert.card.leaving.go") });
    expect(link.getAttribute("href")).toBe(SERVED.link);
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(opened).not.toHaveBeenCalled();
    expect(authority.sent).toEqual([]);
  });

  test("[advert:impression-counted-when-seen] given an advert on screen, when it stays at least half visible for the impression time, then one impression counts, once per slot in the session; less than half, or less time, counts nothing", async () => {
    const count = vi.fn<CountAdvert>();
    const { impressionMs } = content.tuning.advert;
    await renderWithView(<AdvertSlot slot="advert.road-billboard" served={SERVED} onCount={count} />, shownView());
    act(() => observed?.(0.4));
    act(() => {
      vi.advanceTimersByTime(impressionMs * 2);
    });
    act(() => observed?.(0.5));
    act(() => {
      vi.advanceTimersByTime(impressionMs - 1);
    });
    expect(count).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(count.mock.calls).toEqual([[ADVERT_COUNTERS.impression, "advert.road-billboard"]]);
    fireEvent.click(screen.getByRole("button", { name: `${say("advert.label")}: ${SERVED.advertiser}` }));
    expect(count.mock.calls.at(-1)).toEqual([ADVERT_COUNTERS.tap, "advert.road-billboard"]);
  });

  test("[advert:impression-counted-when-seen] given a slot already counted this session, when it is shown again, then no second impression counts", async () => {
    const count = vi.fn<CountAdvert>();
    const { impressionMs } = content.tuning.advert;
    for (let round = 0; round < 2; round += 1) {
      await renderSlots(shownView(), count, ["advert.food-spot"]);
      act(() => observed?.(1));
      act(() => {
        vi.advanceTimersByTime(impressionMs);
      });
      cleanup();
    }
    expect(count.mock.calls).toEqual([[ADVERT_COUNTERS.impression, "advert.food-spot"]]);
  });
});

async function renderSlots(view: PlayerView, count?: CountAdvert, slots: Id<"advert">[] = SLOTS) {
  await renderWithView(
    <>
      {slots.map((slot) => (
        <AdvertSlot key={slot} slot={slot} served={SERVED} {...(count === undefined ? {} : { onCount: count })} />
      ))}
    </>,
    view,
  );
}
