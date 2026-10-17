// Cloudflare Web Analytics on the game's page. The build puts the beacon in
// index.html only when `VITE_ANALYTICS_TOKEN` holds a site token; empty, as in
// dev and the tests, the page has no script of it. It is Cloudflare's own
// count of page views, with no cookie and nothing on the device; the page's
// policy in public/_headers lets in its script and its reports and nothing
// else. Runs in Node, from vite.config.ts.
import type { Plugin } from "vite";

/** Where the beacon comes from, and where it reports. */
export const BEACON_SCRIPT = "https://static.cloudflareinsights.com";
export const BEACON_REPORTS = "https://cloudflareinsights.com";

/** A Web Analytics site token: letters and digits only, so it can sit in the beacon's attribute as it is. */
const TOKEN = /^[A-Za-z0-9]{1,64}$/;

/** The beacon's tag for a token, or nothing while the token is unset or not a token. */
export function beaconTag(token: string | undefined): string {
  if (token === undefined || !TOKEN.test(token)) return "";
  return `<script defer src="${BEACON_SCRIPT}/beacon.min.js" data-cf-beacon='{"token": "${token}", "spa": false}'></script>`;
}

/** The page with the beacon before `</body>`, or the page as it was. */
export function withBeacon(html: string, token: string | undefined): string {
  const tag = beaconTag(token);
  return tag === "" ? html : html.replace("</body>", `  ${tag}\n  </body>`);
}

/** The build's step: reads `VITE_ANALYTICS_TOKEN` from the build's environment. */
export function beaconPlugin(): Plugin {
  let token: string | undefined;
  return {
    name: "japacity-analytics-beacon",
    configResolved(config) {
      const value: unknown = config.env["VITE_ANALYTICS_TOKEN"];
      token = typeof value === "string" ? value : undefined;
    },
    transformIndexHtml(html) {
      return withBeacon(html, token);
    },
  };
}
