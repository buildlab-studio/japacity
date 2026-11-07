import type { ServedAdvert } from "@japacity/api";
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { type ReactElement, useState } from "react";
import { describe, expect, test } from "vitest";

import { api } from "../../shared/net/http";
import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { BASE, fakeServer, type FakeServer } from "../../shared/testing/server";
import { say } from "../../shared/words/text";
import { AdvertsProvider, type AdvertsServer, PhoneTile, PlaceAdverts, slotsAt } from "./placed";

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

/** The account's answer alone, so a test queues the hour's answers itself. */
function accountServer(country = "NG"): FakeServer {
  const fake = fakeServer();
  fake.answer("GET /api/account", { body: { ok: true, account: { id: "account-1", country, age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1" } } });
  return fake;
}

function server(slots: Record<string, ServedAdvert>, country = "NG"): FakeServer {
  const fake = accountServer(country);
  fake.answer("GET /api/adverts", { body: { ok: true, region: country, hour: 1, until: Date.now() + 3_600_000, slots } });
  return fake;
}

async function place(fake: FakeServer | null, ui: ReactElement, view = shown()) {
  return renderWithView(<AdvertsProvider value={fake === null ? null : { api: api({ baseUrl: BASE, fetch: fake.fetch }), baseUrl: BASE }}>{ui}</AdvertsProvider>, view);
}

describe("where the slots stand", () => {
  test("[advert:adverts-only-in-slots] [advert:slots-capped-per-place] given content's slots, then each city place holds its billboards, posters and shopfronts, and the phone holds only its one tile", () => {
    for (const slot of Object.values(content.advert)) {
      const at = slot.surface === "phone-tile" ? "phone" : slot.place;
      expect(slotsAt(at).map((each) => each.id)).toContain(slot.id);
    }
    expect(slotsAt("phone").map((slot) => slot.surface)).toEqual(["phone-tile"]);
    expect(slotsAt("phone").length).toBeLessThanOrEqual(content.tuning.advert.maxPhoneTiles);
    expect(slotsAt("place.ojuelegba")).toEqual([]);
  });

  test("[advert:campaign-chosen-without-player-data] given a place with a billboard and the hour's campaign for it, when the place is on screen, then the slots are fetched for the account's region and only the filled one shows", async () => {
    const [billboard] = slotsAt("place.jibowu");
    if (billboard === undefined) throw new Error("Jibowu holds a billboard.");
    const fake = server({ [billboard.id]: SERVED });
    await place(fake, <PlaceAdverts place="place.jibowu" />);
    expect(await screen.findByRole("button", { name: `${say("advert.label")}: ${SERVED.advertiser}` })).toBeDefined();
    expect(fake.sent.find((request) => request.path === "/api/adverts")?.search).toBe("?region=NG");
    expect(document.querySelectorAll("[data-advert-empty]")).toHaveLength(0);
  });

  test("[advert:slots-capped-per-place] given the phone tile filled, then the phone shows it and no other slot", async () => {
    const fake = server({ "advert.phone-tile": { ...SERVED, width: 256, height: 256 }, "advert.park-billboard": SERVED });
    await place(fake, <PhoneTile />);
    await waitFor(() => expect(document.querySelectorAll("[data-advert-slot]")).toHaveLength(1));
    expect(document.querySelector("[data-advert-slot='advert.phone-tile']")).not.toBeNull();
  });

  test("[server:four-off-switches] given the adverts switch off, when the server answers 503, then no advert shows and nothing is said to the player", async () => {
    const fake = server({});
    fake.answer("GET /api/adverts", { status: 503, body: { ok: false, code: "switched-off", detail: "Adverts are off.", retryAfter: 30 }, headers: { "Retry-After": "30" } });
    await place(fake, <PhoneTile />);
    await waitFor(() => expect(fake.sent.some((request) => request.path === "/api/adverts")).toBe(true));
    expect(document.querySelectorAll("[data-advert-slot]")).toHaveLength(0);
    expect(document.body.textContent).toBe("");
  });

  test("[advert:no-adverts-on-protected-screens] given the view saying no advert may show, or no server, then nothing is fetched and no slot renders", async () => {
    const fake = server({ "advert.phone-tile": SERVED });
    await place(fake, <PhoneTile />, { ...shown(), adverts: false });
    await place(null, <PhoneTile />);
    expect(fake.sent).toEqual([]);
    expect(document.querySelectorAll("[data-advert-slot]")).toHaveLength(0);
  });
});

/** The phone's home and one app in turn: the tile stands on the home screen and goes while an app is open, as the phone does. */
function PhoneHome({ server, place }: { server: AdvertsServer; place?: string }) {
  const [home, setHome] = useState(true);
  return (
    <AdvertsProvider value={server}>
      <button type="button" data-turn onClick={() => setHome((at) => !at)} />
      {home ? place === undefined ? <PhoneTile /> : <PlaceAdverts place={place} /> : null}
    </AdvertsProvider>
  );
}

const asked = (fake: FakeServer, path: string): number => fake.sent.filter((request) => request.path === path).length;
const TILE = "[data-advert-slot='advert.phone-tile']";
const LIMITED = { status: 429, body: { ok: false, code: "rate-limited", detail: "Too many requests.", retryAfter: 30 }, headers: { "Retry-After": "30" } };

describe("the hour's slots, read once", () => {
  test("[server:per-account-rate-limits] [server:public-replies-cached] given the phone tile filled, when it stands on the home screen, then the hour's slots and the account are read once, never again while it stands", async () => {
    const fake = server({ "advert.phone-tile": { ...SERVED, width: 256, height: 256 } });
    await place(fake, <PhoneTile />);
    await waitFor(() => expect(document.querySelector(TILE)).not.toBeNull());
    await act(() => new Promise((done) => setTimeout(done, 200)));
    expect(asked(fake, "/api/adverts")).toBe(1);
    expect(asked(fake, "/api/account")).toBe(1);
  });

  test("[server:per-account-rate-limits] [server:public-replies-cached] given the phone tile read, when the phone goes from its home to an app and back, again and again, then the tile stands each time at once and nothing is read again before the hour ends", async () => {
    const fake = server({ "advert.phone-tile": { ...SERVED, width: 256, height: 256 } });
    await renderWithView(<PhoneHome server={{ api: api({ baseUrl: BASE, fetch: fake.fetch }), baseUrl: BASE }} />, shown());
    await waitFor(() => expect(document.querySelector(TILE)).not.toBeNull());
    for (let turn = 0; turn < 10; turn += 1) {
      fireEvent.click(document.querySelector<HTMLElement>("[data-turn]")!);
      expect(document.querySelector(TILE)).toBeNull();
      fireEvent.click(document.querySelector<HTMLElement>("[data-turn]")!);
      expect(document.querySelector(TILE)).not.toBeNull();
    }
    expect(asked(fake, "/api/adverts")).toBe(1);
    expect(asked(fake, "/api/account")).toBe(1);
  });

  test("[server:per-account-rate-limits] [server:public-replies-cached] given a place's billboard read, when the player walks out and back in, then the board stands at once and the slots are not read again", async () => {
    const [billboard] = slotsAt("place.jibowu");
    if (billboard === undefined) throw new Error("Jibowu holds a billboard.");
    const fake = server({ [billboard.id]: SERVED });
    await renderWithView(<PhoneHome server={{ api: api({ baseUrl: BASE, fetch: fake.fetch }), baseUrl: BASE }} place="place.jibowu" />, shown());
    await waitFor(() => expect(document.querySelector(`[data-advert-slot='${billboard.id}']`)).not.toBeNull());
    fireEvent.click(document.querySelector<HTMLElement>("[data-turn]")!);
    fireEvent.click(document.querySelector<HTMLElement>("[data-turn]")!);
    expect(document.querySelector(`[data-advert-slot='${billboard.id}']`)).not.toBeNull();
    expect(asked(fake, "/api/adverts")).toBe(1);
  });

  test("[server:per-account-rate-limits] given the tile read and its hour ended, when the next read is refused as over the limit, then the last good tile stands and nothing is said to the player; the account refused leaves the tile as it was", async () => {
    const fake = accountServer();
    fake.answer("GET /api/adverts", { body: { ok: true, region: "NG", hour: 1, until: Date.now() + 100, slots: { "advert.phone-tile": { ...SERVED, width: 256, height: 256 } } } }, LIMITED);
    await renderWithView(<PhoneHome server={{ api: api({ baseUrl: BASE, fetch: fake.fetch }), baseUrl: BASE }} />, shown());
    await waitFor(() => expect(document.querySelector(TILE)).not.toBeNull());
    await waitFor(() => expect(asked(fake, "/api/adverts")).toBe(2));
    await act(() => new Promise((done) => setTimeout(done, 50)));
    expect(document.querySelector(TILE)).not.toBeNull();
    fake.answer("GET /api/account", LIMITED);
    fireEvent.click(document.querySelector<HTMLElement>("[data-turn]")!);
    fireEvent.click(document.querySelector<HTMLElement>("[data-turn]")!);
    await act(() => new Promise((done) => setTimeout(done, 50)));
    expect(document.querySelector(TILE)).not.toBeNull();
    expect(asked(fake, "/api/adverts")).toBe(2);
    expect(document.body.textContent).not.toMatch(/error|wrong|try again|too many/i);
  });

  test("[server:four-off-switches] given the tile read, when the adverts switch is turned off at the hour's end, then the tile goes", async () => {
    const fake = accountServer();
    fake.answer("GET /api/adverts", { body: { ok: true, region: "NG", hour: 1, until: Date.now() + 100, slots: { "advert.phone-tile": { ...SERVED, width: 256, height: 256 } } } }, { status: 503, body: { ok: false, code: "switched-off", detail: "Adverts are off.", retryAfter: 30 }, headers: { "Retry-After": "30" } });
    await renderWithView(<PhoneHome server={{ api: api({ baseUrl: BASE, fetch: fake.fetch }), baseUrl: BASE }} />, shown());
    await waitFor(() => expect(document.querySelector(TILE)).not.toBeNull());
    await waitFor(() => expect(document.querySelector(TILE)).toBeNull());
    expect(asked(fake, "/api/adverts")).toBe(2);
  });
});
