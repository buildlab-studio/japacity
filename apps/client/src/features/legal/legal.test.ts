import { join } from "node:path";

import { OPERATOR, text, type Operator } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { LEGAL_LINKS, PRIVACY_PATH, TERMS_PATH } from "../../shared/ui/LegalLinks";
import { say } from "../../shared/words/text";
import { fillOperator, LEGAL_TEMPLATES, legalPages } from "./pages";

const CLIENT = join(process.cwd(), "apps/client");

function served(operator: Operator = OPERATOR): Map<string, string> {
  return new Map(legalPages(CLIENT, operator).map((page) => [page.path, page.html]));
}

function parsed(path: string, operator: Operator = OPERATOR): Document {
  const html = served(operator).get(path);
  if (html === undefined) throw new Error(`No page is served at ${path}.`);
  return new DOMParser().parseFromString(html, "text/html");
}

/** A page's words with its spacing made plain, as a reader sees them. */
function words(element: Element | null): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

const terms = () => parsed(TERMS_PATH);
const privacy = () => parsed(PRIVACY_PATH);

describe("the two legal pages", () => {
  test("[R-REGION-010] given each link in the game, when its path is looked up among the pages served, then a page is there with its own title and a phone's viewport", () => {
    expect(LEGAL_LINKS.map((link) => link.href)).toEqual(LEGAL_TEMPLATES.map((page) => page.path));
    for (const link of LEGAL_LINKS) {
      const page = parsed(link.href);
      expect(page.title).toBe(say(link.words));
      expect(page.querySelector('meta[name="viewport"]')).not.toBeNull();
      expect(page.querySelectorAll("script, img, iframe, form")).toHaveLength(0);
    }
  });

  test("[R-SHARE-014] given the two pages, when they are read, then each links to the other, back to the game and to the official accounts page", () => {
    const hrefs = (page: Document) => [...page.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(hrefs(terms())).toEqual(expect.arrayContaining([PRIVACY_PATH, "/", "/official"]));
    expect(hrefs(privacy())).toEqual(expect.arrayContaining([TERMS_PATH, "/", "/official"]));
  });

  test("given the two pages, when they are served, then each names who runs the game from content's one constant, and every address on them is the operator's on japacity.app or the game's own", () => {
    expect(OPERATOR.email).toMatch(/@japacity\.app$/);
    for (const html of served().values()) {
      expect(html).not.toContain("{{");
      const page = new DOMParser().parseFromString(html, "text/html");
      expect(words(page.querySelector("[data-operator]"))).toContain(`run by ${OPERATOR.name}, ${OPERATOR.place}`);
      const hrefs = [...page.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "");
      const mail = hrefs.filter((href) => href.startsWith("mailto:"));
      expect(mail.length).toBeGreaterThan(0);
      expect(new Set(mail)).toEqual(new Set([`mailto:${OPERATOR.email}`]));
      expect(hrefs.filter((href) => !href.startsWith("mailto:") && !href.startsWith("/"))).toEqual([]);
    }
  });

  test("given another operator, when the pages are built with it, then both name it and its address, and the first operator is gone from them", () => {
    const other: Operator = { name: "Ada Tester", place: "Ikeja, Lagos, Nigeria", email: "help@japacity.app" };
    for (const html of served(other).values()) {
      expect(html).toContain(`run by ${other.name}, ${other.place}`);
      expect(html).toContain(`mailto:${other.email}`);
      expect(html).not.toContain(OPERATOR.name);
      expect(html).not.toContain(OPERATOR.place);
      expect(html).not.toContain(OPERATOR.email);
    }
  });

  test("given a template that asks for a field the operator does not have, when it is filled, then the build stops", () => {
    expect(() => fillOperator("<p>{{operator.street}}</p>")).toThrow(/operator\.street/);
    expect(fillOperator("<p>{{operator.name}}</p>", { name: "A & B", place: "", email: "" })).toBe("<p>A &amp; B</p>");
  });
});

describe("the terms of play", () => {
  test("[R-REGION-003] given the terms, when they are read, then they say the game is for 18 or over, as the age screen asks", () => {
    expect(words(terms().querySelector("[data-age]"))).toContain("You must be 18 or over to play.");
    expect(words(terms().querySelector("[data-age]"))).toContain("turns away anyone under 18");
  });

  test("[R-MODERATION-003] given the terms, when they are read, then they say a player can block or report another wherever they meet", () => {
    expect(words(terms().querySelector("[data-block-report]"))).toContain("Wherever you meet another player, you can block them or report them.");
  });

  test("[R-MODERATION-014] given the terms, when they are read, then they say what breaks them may be removed and an account may be closed for it", () => {
    const removal = words(terms().querySelector("[data-removal]"));
    expect(removal).toContain("remove what breaks these terms");
    expect(removal).toContain("close your account");
  });

  test("[R-MODERATION-016] given the terms, when they are read, then they give the complaints route: a letter to the operator's address, answered within 14 days", () => {
    const complaints = terms().querySelector("[data-complaints]");
    expect(complaints?.querySelector("a")?.getAttribute("href")).toBe(`mailto:${OPERATOR.email}`);
    expect(words(complaints)).toContain("We reply within 14 days.");
    expect(words(terms().querySelector("[data-removal]"))).toContain("how to appeal");
  });

  test("[R-CITY-041] given the terms, when they are read, then they carry the notice on real names in the about page's own words", () => {
    expect(words(terms().querySelector("[data-names]"))).toContain(text["guide.page.about.names"]);
  });

  test("given the terms, when they are read, then the law of Nigeria governs them and the courts of Lagos State settle disputes", () => {
    expect(words(terms().querySelector("[data-law]"))).toBe("These terms are governed by the law of Nigeria. The courts of Lagos State settle any dispute about them.");
  });
});

describe("the privacy notice", () => {
  test("given the notice, when it is read, then it follows the Nigeria Data Protection Act 2023 and names the operator as the data controller", () => {
    expect(words(privacy().querySelector("[data-law]"))).toContain("This notice follows the Nigeria Data Protection Act 2023.");
    expect(words(privacy().querySelector("[data-operator]"))).toContain("We are the data controller");
  });

  test("given the notice, when it is read, then it lists what is kept, each with why and for how long: the account, the save, the pair records, the moderation log and the usage counts", () => {
    const kept = [...privacy().querySelectorAll("[data-kept-item]")].map((item) => item.getAttribute("data-kept-item"));
    expect(kept).toEqual(expect.arrayContaining(["account", "save", "pair", "moderation", "analytics"]));
    for (const item of privacy().querySelectorAll("[data-kept-item]")) expect(words(item)).toMatch(/[Kk]ept|30 days/);
  });

  test("[R-MODERATION-015] given the notice, when it is read, then it names the log of decisions among what is kept, and for how long", () => {
    const log = words(privacy().querySelector('[data-kept-item="moderation"]'));
    expect(log).toContain("in a log that is never changed");
    expect(log).toContain("Kept for 3 years");
  });

  test("given the notice, when it is read, then it names who else handles the information: Cloudflare with its Turnstile check, Neon and Google sign-in", () => {
    const providers = words(privacy().querySelector("[data-providers]"));
    for (const name of ["Cloudflare", "Turnstile", "Neon", "Google"]) expect(providers).toContain(name);
  });

  test("given the notice, when it is read, then it gives the player's rights of access, correction, deletion and complaint, and the operator's address for them", () => {
    const rights = words(privacy().querySelector("[data-rights]"));
    for (const right of ["a copy of the information", "correct it", "delete it", "complain"]) expect(rights).toContain(right);
    expect(rights).toContain("Nigeria Data Protection Commission");
    expect(privacy().querySelector("[data-contact] a")?.getAttribute("href")).toBe(`mailto:${OPERATOR.email}`);
  });
});
