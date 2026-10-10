// The one screen anyone without the invite sees. Plain HTML, no form, no picture of its own, and
// one script only: Cloudflare Web Analytics' beacon, while the maintainer has set its token (the maintainer,
// 11 Oct 2026). Words are first drafts for the maintainer to retype in his own voice.

const TITLE = "Japacity";
const LINE = "The game opens soon.";
const INVITED = "Got an invite link from a friend? Open it again on this phone.";
const DESCRIPTION = "A browser game about japa: the job, the transcript, the funds, the visa officer, and the life after.";
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
/** A Web Analytics site token: letters and digits only, so it can sit in the beacon's attribute as it is. */
const TOKEN = /^[A-Za-z0-9]{1,64}$/;

/** Where the beacon comes from, and where it reports: the only script and the only connection the screen may make. */
export const BEACON_SCRIPT = "https://static.cloudflareinsights.com";
export const BEACON_REPORTS = "https://cloudflareinsights.com";

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** The X link, or nothing while the handle is unset or not a handle. */
export function xLink(handle: string): string {
  if (!HANDLE.test(handle)) return "";
  return `<a class="x" href="https://x.com/${handle}" rel="me">@${handle} on X</a>`;
}

/** True when the token can be served: set, and nothing but letters and digits. */
export function beaconOn(token: string): boolean {
  return TOKEN.test(token);
}

/** Web Analytics' beacon, the screen's one script, or nothing while the token is unset or not a token. */
export function beacon(token: string): string {
  if (!beaconOn(token)) return "";
  return `<script defer src="${BEACON_SCRIPT}/beacon.min.js" data-cf-beacon='{"token": "${token}", "spa": false}'></script>`;
}

/** The screen. `siteUrl` is the holding page, whose card picture the link preview borrows. */
export function renderScreen(xHandle: string, siteUrl: string, analyticsToken = ""): string {
  const card = `${siteUrl}/card.png`;
  return `<!doctype html>
<html lang="en-NG">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>${TITLE}</title>
<meta name="description" content="${escapeHtml(DESCRIPTION)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${TITLE}">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${escapeHtml(DESCRIPTION)}">
<meta property="og:image" content="${escapeHtml(card)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escapeHtml(card)}">
<style>
:root{--paper:#f7f1e6;--ink:#1d1a16;--muted:#6b645a}
@media (prefers-color-scheme:dark){:root{--paper:#171512;--ink:#f3ece0;--muted:#a79f92}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif;min-height:100svh;display:grid;place-items:center;padding:16px}
main{width:100%;max-width:440px}
h1{font-size:56px;line-height:1;margin:0 0 12px;letter-spacing:-0.02em}
p{margin:0 0 20px}
.invited{font-size:14px;color:var(--muted)}
.x{display:inline-block;margin-top:8px;color:var(--ink);font-weight:700}
</style>
</head>
<body>
<main>
<h1>${TITLE}</h1>
<p>${escapeHtml(LINE)}</p>
<p class="invited">${escapeHtml(INVITED)}</p>
${xLink(xHandle)}
</main>
${beacon(analyticsToken)}
</body>
</html>
`;
}
