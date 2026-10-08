// The one page. Plain HTML so it works with no script. Before launch it says the game opens
// soon; live, it shows the play link. The waitlist's form is sent only while the waitlist is on.
// Words are first drafts for the maintainer to retype in his own voice.

export type PageState = "fresh" | "joined" | "invalid" | "slow";

export interface PageSettings {
  siteUrl: string;
  /** Empty means no analytics script at all. */
  analyticsToken: string;
  live: boolean;
  playUrl: string;
  /** Without the @. Anything that is not an X handle shows no link. */
  xHandle: string;
  waitlist: boolean;
}

const TITLE = "Japacity";
const LINE = "a game about trying to leave. coming soon.";
const SOON = "a game about trying to leave. it opens soon.";
const OPEN = "a game about trying to leave. it is open.";
const PLAY = "Play now";
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const DESCRIPTION = "A browser game about japa: the job, the transcript, the funds, the visa officer, and the life after.";
const PRIVACY = "One email when it opens, then we delete your address.";

const NOTES: Record<PageState, string> = {
  fresh: "",
  joined: "You are on the list. One email when it opens.",
  invalid: "That does not look like an email address.",
  slow: "Too many tries from here. Give it a minute.",
};

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function xLink(handle: string): string {
  if (!HANDLE.test(handle)) return "";
  return `<a class="x" href="https://x.com/${handle}" rel="me">@${handle} on X</a>`;
}

function waitlistForm(state: PageState): string {
  const note = NOTES[state];
  const form =
    state === "joined"
      ? ""
      : `<form method="post" action="/join">
<label for="email" class="hp">Leave this empty</label>
<input class="hp" type="text" name="website" id="website" tabindex="-1" autocomplete="off">
<input type="email" name="email" id="email" placeholder="your email" required maxlength="254" autocomplete="email" inputmode="email">
<button type="submit">Tell me when it opens</button>
</form>`;
  return `<p>${escapeHtml(LINE)}</p>
${note === "" ? "" : `<p class="note" role="status">${escapeHtml(note)}</p>`}
${form}
<p class="privacy">${escapeHtml(PRIVACY)}</p>`;
}

function body(state: PageState, settings: PageSettings): string {
  if (settings.live) return `<p>${escapeHtml(OPEN)}</p>\n<a class="play" href="${escapeHtml(settings.playUrl)}">${PLAY}</a>`;
  if (settings.waitlist) return waitlistForm(state);
  return `<p>${escapeHtml(SOON)}</p>`;
}

/** Renders the page for the settings the Worker read from its environment. */
export function renderPage(state: PageState, settings: PageSettings): string {
  const { siteUrl, analyticsToken } = settings;
  const analytics =
    analyticsToken === ""
      ? ""
      : `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${escapeHtml(analyticsToken)}", "spa": false}'></script>`;
  const card = `${siteUrl}/card.png`;
  return `<!doctype html>
<html lang="en-NG">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${TITLE}</title>
<meta name="description" content="${escapeHtml(DESCRIPTION)}">
<link rel="canonical" href="${siteUrl}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${TITLE}">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${escapeHtml(DESCRIPTION)}">
<meta property="og:url" content="${siteUrl}/">
<meta property="og:image" content="${card}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${escapeHtml(DESCRIPTION)}">
<meta name="twitter:image" content="${card}">
<style>
:root{--paper:#f7f1e6;--ink:#1d1a16;--muted:#6b645a;--accent:#f2b705;--accent-ink:#1d1a16}
@media (prefers-color-scheme:dark){:root{--paper:#171512;--ink:#f3ece0;--muted:#a79f92}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif;min-height:100svh;display:grid;place-items:center;padding:16px}
main{width:100%;max-width:440px}
h1{font-size:56px;line-height:1;margin:0 0 12px;letter-spacing:-0.02em}
p{margin:0 0 20px}
form{display:grid;gap:10px}
input[type=email]{font:inherit;padding:14px 16px;border:2px solid var(--ink);border-radius:12px;background:transparent;color:var(--ink);width:100%}
button{font:inherit;font-weight:700;padding:14px 16px;border:0;border-radius:12px;background:var(--accent);color:var(--accent-ink);cursor:pointer}
.privacy{font-size:14px;color:var(--muted);margin:12px 0 0}
.note{font-weight:700;margin:0 0 12px}
.hp{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden}
.x{display:inline-block;margin-top:28px;color:var(--muted);font-size:14px}
.play{display:block;text-align:center;font-weight:700;padding:14px 16px;border-radius:12px;background:var(--accent);color:var(--accent-ink);text-decoration:none}
</style>
</head>
<body>
<main>
<h1>${TITLE}</h1>
${body(state, settings)}
${xLink(settings.xHandle)}
</main>
${analytics}
</body>
</html>
`;
}
