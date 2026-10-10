// R-ACCOUNT-023: the in-app browsers where Google refuses its sign-in
// (WhatsApp, X, Instagram, TikTok, and Facebook's, which shares Instagram's).
// There the ways in offer the emailed code and a way out to the phone's own
// browser instead of a Google button that cannot work.

/** Each app's mark in the user agent its in-app browser sends. */
const IN_APP: readonly RegExp[] = [/\bWhatsApp\b/i, /\bInstagram\b/i, /\bFBAN\b|\bFBAV\b|\bFB_IAB\b/, /\bTwitter\b/i, /\bmusical_ly|\bBytedanceWebview\b|\bTikTok\b/i];

export function inAppBrowser(userAgent: string): boolean {
  return IN_APP.some((mark) => mark.test(userAgent));
}

/**
 * On Android an `intent:` link opens the page in the phone's own browser. On
 * an iPhone no link can, so the screen offers to copy the address instead (null).
 */
export function browserLink(href: string, userAgent: string): string | null {
  if (!/\bAndroid\b/i.test(userAgent)) return null;
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(":", "")};end`;
}
