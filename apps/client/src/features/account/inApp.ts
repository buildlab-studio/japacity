// account:guest-secures-the-life: the in-app browsers where Google refuses its sign-in: WhatsApp, X, Instagram,
// TikTok, Facebook's (which shares Instagram's), Snapchat, LinkedIn, Line and WeChat by their marks, any Android
// WebView by its `; wv)`, and on an iPhone any browser that lacks Safari's own mark and is not Chrome, Firefox or Edge
// (an app's own web view), unless the game was opened from the home screen. There the ways back in offer the emailed
// code and a way out to the phone's own browser, and the keep sheet the emailed code alone, instead of a Google button
// that cannot work.

/** Each app's mark in the user agent its in-app browser sends. */
const IN_APP: readonly RegExp[] = [
  /\bWhatsApp\b/i,
  /\bInstagram\b/i,
  /\bFBAN\b|\bFBAV\b|\bFB_IAB\b/,
  /\bTwitter\b/i,
  /\bmusical_ly|\bBytedanceWebview\b|\bTikTok\b/i,
  /\bSnapchat\b/i,
  /\bLinkedInApp\b/i,
  /\bLine\//,
  /\bMicroMessenger\b/i,
  /; wv\)/,
];

/** An iPhone's or iPad's browser by its user agent, and the browsers there that are the phone's own and not an app's web view. */
const IOS = /\b(?:iPhone|iPad|iPod)\b/;
const IOS_BROWSERS = /\bSafari\/|\bCriOS\/|\bFxiOS\/|\bEdgiOS\//;

/** The game opened from the home screen, whose user agent on an iPhone carries no Safari mark. */
function homeScreen(): boolean {
  if (typeof navigator !== "undefined" && (navigator as { standalone?: boolean }).standalone === true) return true;
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
}

export function inAppBrowser(userAgent: string, fromHomeScreen: () => boolean = homeScreen): boolean {
  if (IN_APP.some((mark) => mark.test(userAgent))) return true;
  return IOS.test(userAgent) && !IOS_BROWSERS.test(userAgent) && !fromHomeScreen();
}

/**
 * On Android an `intent:` link opens the page in Chrome, and where Chrome is not there the phone opens the plain address
 * (`S.browser_fallback_url`). On an iPhone no link can, so the screen says how to open it by hand instead (null).
 */
export function browserLink(href: string, userAgent: string): string | null {
  if (!/\bAndroid\b/i.test(userAgent)) return null;
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
}
