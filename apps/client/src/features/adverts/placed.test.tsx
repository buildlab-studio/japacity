import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, test } from "vitest";

import { api } from "../../shared/net/http";
import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { BASE, fakeServer, type FakeServer } from "../../shared/testing/server";
import { say } from "../../shared/words/text";
import type { ServedAdvert } from "./adverts";
import { AdvertsProvider, PhoneTile, PlaceAdverts, slotsAt } from "./placed";

const SERVED: ServedAdvert = {
  campaign: "campaign-1",
  creative: "creative-1",
  version: 1,
  image: "/api/adverts/image/creative-1/1",
  width: 1024,
  height: 512,
  advertiser: "Mama Put Kitchen",
  text: "Jollof on the island.",
  link: null,
};

const shown = (): PlayerView => ({ ...engineView(), adverts: true });

function server(slots: Record<string, ServedAdvert>, country = "NG"): FakeServer {
  const fake = fakeServer();
  fake.answer("GET /api/account", { body: { ok: true, account: { id: "account-1", country, age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1" } } });
  fake.answer("GET /api/adverts", { body: { ok: true, region: country, hour: 1, until: Date.now() + 3_600_000, slots } });
  return fake;
}

async function place(fake: FakeServer | null, ui: ReactElement, view = shown()) {
  return renderWithView(<AdvertsProvider value={fake === null ? null : { api: api({ baseUrl: BASE, fetch: fake.fetch }), baseUrl: BASE }}>{ui}</AdvertsProvider>, view);
}

describe("where the slots stand", () => {
  test("[R-ADVERT-001] [R-ADVERT-002] given content's slots, then each city place holds its billboards, posters and shopfronts, and the phone holds only its one tile", () => {
    for (const slot of Object.values(content.advert)) {
      const at = slot.surface === "phone-tile" ? "phone" : slot.place;
      expect(slotsAt(at).map((each) => each.id)).toContain(slot.id);
    }
    expect(slotsAt("phone").map((slot) => slot.surface)).toEqual(["phone-tile"]);
    expect(slotsAt("phone").length).toBeLessThanOrEqual(content.tuning.advert.maxPhoneTiles);
    expect(slotsAt("place.ojuelegba")).toEqual([]);
  });

  test("[R-ADVERT-008] given a place with a billboard and the hour's campaign for it, when the place is on screen, then the slots are fetched for the account's region and only the filled one shows", async () => {
    const [billboard] = slotsAt("place.jibowu");
    if (billboard === undefined) throw new Error("Jibowu holds a billboard.");
    const fake = server({ [billboard.id]: SERVED });
    await place(fake, <PlaceAdverts place="place.jibowu" />);
    expect(await screen.findByRole("button", { name: `${say("advert.label")}: ${SERVED.advertiser}` })).toBeDefined();
    expect(fake.sent.find((request) => request.path === "/api/adverts")?.search).toBe("?region=NG");
    expect(document.querySelectorAll("[data-advert-empty]")).toHaveLength(0);
  });

  test("[R-ADVERT-002] given the phone tile filled, then the phone shows it and no other slot", async () => {
    const fake = server({ "advert.phone-tile": { ...SERVED, width: 256, height: 256 }, "advert.park-billboard": SERVED });
    await place(fake, <PhoneTile />);
    await waitFor(() => expect(document.querySelectorAll("[data-advert-slot]")).toHaveLength(1));
    expect(document.querySelector("[data-advert-slot='advert.phone-tile']")).not.toBeNull();
  });

  test("[R-SERVER-031] given the adverts switch off, when the server answers 503, then no advert shows and nothing is said to the player", async () => {
    const fake = server({});
    fake.answer("GET /api/adverts", { status: 503, body: { ok: false, code: "switched-off", detail: "Adverts are off.", retryAfter: 30 }, headers: { "Retry-After": "30" } });
    await place(fake, <PhoneTile />);
    await waitFor(() => expect(fake.sent.some((request) => request.path === "/api/adverts")).toBe(true));
    expect(document.querySelectorAll("[data-advert-slot]")).toHaveLength(0);
    expect(document.body.textContent).toBe("");
  });

  test("[R-ADVERT-003] given the view saying no advert may show, or no server, then nothing is fetched and no slot renders", async () => {
    const fake = server({ "advert.phone-tile": SERVED });
    await place(fake, <PhoneTile />, { ...shown(), adverts: false });
    await place(null, <PhoneTile />);
    expect(fake.sent).toEqual([]);
    expect(document.querySelectorAll("[data-advert-slot]")).toHaveLength(0);
  });
});
