// The official accounts page, `/official` (share:official-accounts-page, share:official-page-warns-plainly and share:everything-links-to-official): the accounts the game holds and what it never does, in the
// words content gives, and nothing else. It is a static file so it loads with
// no game, no sign-in and no script; this builds it, and a test holds the file
// to it.
import { officialAccounts, type OfficialAccount } from "@japacity/content";

import { escapeHtml } from "../../shared/words/html";
import { say } from "../../shared/words/text";

const NEVER = ["money", "turns", "prize", "advert", "agents"] as const;

/** Where an account's address goes when it is followed. */
function hrefOf(account: OfficialAccount & { address: string }): string {
  return account.platform === "email" ? `mailto:${account.address}` : `https://${account.address}`;
}

/** The accounts the game has claimed: only these are listed. */
export function listedAccounts(): (OfficialAccount & { address: string })[] {
  return officialAccounts.filter((account): account is OfficialAccount & { address: string } => account.address !== null);
}

function link(account: OfficialAccount & { address: string }): string {
  return `<a href="${escapeHtml(hrefOf(account))}">${escapeHtml(account.address)}</a>`;
}

export function officialPage(): string {
  const email = listedAccounts().find((account) => account.platform === "email");
  const report = say("share.official.report", { email: "\u0000" });
  const [before = "", after = ""] = escapeHtml(report).split("\u0000");
  const rows = listedAccounts().map(
    (account) => `      <li><span class="platform">${escapeHtml(say(`share.official.platform.${account.platform}`))}</span> ${link(account)}</li>`,
  );
  const never = NEVER.map((item) => `      <li>${escapeHtml(say(`share.official.never.${item}`))}</li>`);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(say("share.official.title"))}</title>
    <style>
      :root { --sheet: #f1f3f9; --text: #131a33; --text-2: #56607e; --sheet-line: rgba(28, 42, 94, 0.12); color-scheme: light; }
      @media (prefers-color-scheme: dark) { :root { --sheet: #18234f; --text: #f3efe6; --text-2: #b6bedf; --sheet-line: rgba(243, 239, 230, 0.13); color-scheme: dark; } }
      body { margin: 0; background: var(--sheet); color: var(--text); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      main { max-width: 36rem; margin: 0 auto; padding: 2rem 1rem; }
      h1 { font-size: 2rem; margin: 0 0 0.5rem; }
      h2 { font-size: 1.25rem; margin: 2rem 0 0.5rem; }
      ul { padding: 0; list-style: none; }
      li { padding: 0.5rem 0; border-bottom: 1px solid var(--sheet-line); }
      .platform { display: block; color: var(--text-2); font-size: 0.875rem; }
      a { color: inherit; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(say("share.official.title"))}</h1>
      <p>${escapeHtml(say("share.official.intro"))}</p>
      <ul data-accounts>
${rows.join("\n")}
      </ul>
      <h2>${escapeHtml(say("share.official.never.heading"))}</h2>
      <ul data-never>
${never.join("\n")}
      </ul>
      <p data-report>${before}${email === undefined ? "" : link(email)}${after}</p>
    </main>
  </body>
</html>
`;
}
