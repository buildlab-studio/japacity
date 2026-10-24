// server:csp-holds-every-page: every browser test watches for the page's content policy refusing something, and fails
// on the first it sees, enforced or only reported. Under the dev server no policy is sent, so nothing is seen; under
// a build served with the shipped headers (E2E_BUILD, playwright.config.ts) every page the suite walks is held to it.
// Each spec takes `test` from here rather than from Playwright, so the watch is on for all of them.
import { type BrowserContext, test as base } from "@playwright/test";

export { expect } from "@playwright/test";

/** The name the page calls to hand a violation to the test. */
const BINDING = "__japacityPolicyViolation";

/** The console's words for a refusal, for what the page's own listener cannot see (a worker's, a frame's own). */
const CONSOLE_WORDS = /Content[ -]Security[ -]Policy|Trusted Type/i;

/** One violation, as the test's failure lists it. */
export interface Violation {
  /** `enforce` or `report`. */
  disposition: string;
  directive: string;
  blocked: string;
  /** The page's path, and the file and line that asked, when the browser says. */
  where: string;
  sample: string;
}

function line(found: Violation): string {
  return `${found.disposition} ${found.directive} blocked ${found.blocked || "(none)"} at ${found.where}${found.sample === "" ? "" : ` sample ${JSON.stringify(found.sample)}`}`;
}

/** Watches a context for refusals from its first page on; the list, a new one or the one given, fills as they come. */
export async function watchPolicy(context: BrowserContext, seen: Violation[] = []): Promise<Violation[]> {
  await context.exposeBinding(BINDING, (_source, found: Violation) => {
    seen.push(found);
  });
  await context.addInitScript((binding: string) => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const call = (window as unknown as Record<string, ((found: unknown) => void) | undefined>)[binding];
      call?.({
        disposition: event.disposition,
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
        where: `${location.pathname} ${event.sourceFile}:${String(event.lineNumber)}`,
        sample: event.sample,
      });
    });
  }, BINDING);
  context.on("console", (message) => {
    const text = message.text();
    if (CONSOLE_WORDS.test(text)) seen.push({ disposition: "console", directive: message.type(), blocked: text, where: message.location().url, sample: "" });
  });
  return seen;
}

/** Fails with every refusal seen, one a line. */
export function noViolations(seen: readonly Violation[]): void {
  if (seen.length > 0) throw new Error(`The page's content policy refused ${String(seen.length)} thing(s):\n${seen.map(line).join("\n")}`);
}

/** Playwright's test with the watch on every test's own context. A context a test makes itself is watched with watchPolicy. */
export const test = base.extend<{ policyWatch: Violation[] }>({
  policyWatch: [
    async ({ context }, use) => {
      // The analytics beacon a production build carries is answered here, so no test reaches Cloudflare with it.
      await context.route(/^https:\/\/(static\.)?cloudflareinsights\.com\//, (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
      const seen = await watchPolicy(context);
      await use(seen);
      noViolations(seen);
    },
    { auto: true },
  ],
});
