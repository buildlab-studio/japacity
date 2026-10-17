// Every share card drawn in a real browser, on the canvas and encoder the game
// uses (docs/rules/share.md R-SHARE-009): each kind and each chapter's art is
// encoded at the first quality tried, under the limit with room to spare, with
// the marks of R-SHARE-006 drawn on. The send-off's ticket stub too, for every
// country a way out flies to and every japa type.
import { expect, test } from "@playwright/test";

// The kinds, the chapters with art of their own and the tuning are the content's own data.
import { content } from "../../../packages/content/src/index";
import { japaTypes, shareChapters, shareKinds } from "../../../packages/content/src/share/share.data";

/** A limit a card stays under at the first quality, so a busier face or a browser's encoder still fits. */
const ROOM_PERCENT = 90;

/** The three things done most with the longest names, so the words block is as tall as it gets. */
const MOST = Object.keys(content.activity)
  .sort((left, right) => right.length - left.length)
  .slice(0, 3);

interface Drawn {
  card: string;
  bytes: number;
  quality: number;
}

test("[R-SHARE-009] [R-SHARE-006] every card kind, every chapter's art and every ticket stub is encoded with the marks at the first quality, well under the card limit", async ({ page }) => {
  test.setTimeout(120_000);
  // Any address serves the game's modules; the cards are drawn by them, not by a page.
  await page.goto("/");
  const cards = [...shareKinds.map((kind) => ({ kind, chapter: null })), ...shareChapters.map((chapter) => ({ kind: "chapter" as const, chapter }))];
  // The longest place names and both ends of the time played, each with every type in turn.
  const ways = Object.values(content.route).filter((route) => route.country !== null).map((route) => route.id);
  const stubs = ways.flatMap((route, at) => japaTypes.map((type, index) => ({ route, type, months: (at + index) % 2 === 0 ? 24 : 119 })));
  const drawn = await page.evaluate(
    async ({ cards, most, stubs }) => {
      // The dev server serves the game's own modules by path; the browser loads them as the game does.
      const load = (path: string): Promise<unknown> => import(/* @vite-ignore */ path);
      const face = (await load("/src/shared/card/face.ts")) as typeof import("../src/shared/card/face");
      const render = (await load("/src/shared/card/render.ts")) as typeof import("../src/shared/card/render");
      const encode = (await load("/src/shared/card/encode.ts")) as typeof import("../src/shared/card/encode");
      const stub = (await load("/src/shared/card/stub.ts")) as typeof import("../src/shared/card/stub");
      const out: Drawn[] = [];
      for (const { kind, chapter } of cards) {
        const card = { kind, chapter, route: "route.uk-masters", percent: 100, months: 120, standing: 100, topActivities: most, name: null, shareable: kind !== "lost" } as Parameters<typeof face.cardFace>[0];
        const made = await render.renderCard(face.cardFace(card, "scenario.ada"));
        out.push({ card: chapter ?? kind, bytes: made.ok ? made.blob.size : made.bytes, quality: made.ok ? made.quality : 0 });
      }
      for (const { route, type, months } of stubs) {
        const card = { kind: "send-off", chapter: "chapter.send-off", route, percent: 100, months, standing: 100, topActivities: most, name: null } as Parameters<typeof face.cardFace>[0];
        const made = await render.renderStub(stub.stubFace(card, "scenario.aniekan", type)!);
        out.push({ card: `stub ${route} ${type}`, bytes: made.ok ? made.blob.size : made.bytes, quality: made.ok ? made.quality : 0 });
      }
      return { out, first: encode.QUALITIES[0] };
    },
    { cards, most: MOST, stubs },
  );
  const limit = Math.floor((content.tuning.share.maxBytes * ROOM_PERCENT) / 100);
  expect(drawn.out).toHaveLength(cards.length + stubs.length);
  expect(drawn.out.filter((card) => card.quality !== drawn.first || card.bytes >= limit)).toEqual([]);
});
