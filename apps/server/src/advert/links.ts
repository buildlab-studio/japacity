// advert:reported-advert-pulled-at-once: a link is rechecked before its campaign starts and whenever its
// advert is reported. A link that fails pulls the campaign from rotation.
import type { ServerDeps } from "../dependencies";
import { approvedCreatives } from "./serve";

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function sameSite(host: string, other: string): boolean {
  return host === other || host.endsWith(`.${other}`) || other.endsWith(`.${host}`);
}

/** Whether the link still answers, on its own domain, after any redirects. */
async function linkHolds(fetcher: Fetcher, link: string): Promise<boolean> {
  try {
    const reply = await fetcher(link, { method: "GET", redirect: "follow" });
    const landed = new URL(reply.url === "" ? link : reply.url);
    return reply.ok && landed.protocol === "https:" && sameSite(landed.hostname, new URL(link).hostname);
  } catch {
    return false;
  }
}

/** The approved links of a campaign that no longer hold. */
export async function failingLinks(deps: Pick<ServerDeps, "stores">, fetcher: Fetcher, campaign: string): Promise<string[]> {
  const failing: string[] = [];
  for (const creative of approvedCreatives(await deps.stores.adverts.creatives(campaign))) {
    if (creative.link !== null && !(await linkHolds(fetcher, creative.link))) failing.push(creative.link);
  }
  return failing;
}
