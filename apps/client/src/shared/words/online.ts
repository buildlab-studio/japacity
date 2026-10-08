// Words for playing online: the server's own refusals, the clock, the age
// screen, signing in and the account settings. First drafts in the voice of
// docs/rules/text.md, to be rewritten. Kept apart from ui.ts so the
// online screens can be read in one place; ui.ts takes them in whole.
export const onlineText: Record<string, string> = {
  // The server's refusals (R-SERVER-025, R-ACCOUNT-011, R-ACCOUNT-015)
  "reject.rate-limited": "Too much at once. Try again now.",
  "reject.signed-out": "You are signed out. Sign in to carry on.",
  "reject.diverged": "Your life needs checking on our side. Try again in a while.",
  "reject.region-closed": "Japacity is not open where you are yet.",
  "reject.one-character": "This account already has its life.",
  "reject.no-character": "This account has no life yet. Pick one.",
  "ui.online.wait": "Too much at once. Wait {seconds} seconds, then try again.",
  "ui.online.wait.one": "Too much at once. Wait a second, then try again.",

  // The clock (R-CLOCK-007)
  "ui.clock.next": "Next month banked in {wait}",
  "ui.clock.arriving": "A month is on its way.",
  "ui.clock.full": "Your bank is full. Play a month to make room.",
  "ui.clock.hours": "{hours} h {minutes} min",
  "ui.clock.minutes": "{minutes} min",
  "ui.clock.under-minute": "under a minute",

  // The age screen (R-ACCOUNT-012)
  "ui.account.age.title": "When were you born?",
  "ui.account.age.intro": "Japacity asks everyone this before anything else.",
  "ui.account.age.label": "Date of birth",
  "ui.account.age.go": "Continue",
  "ui.account.age.empty": "Put in your date of birth first.",
  "ui.account.age.refused": "You cannot play Japacity.",
  "ui.account.region-closed": "Japacity is not open where you are yet.",

  // Signing in (R-ACCOUNT-001, R-ACCOUNT-002, R-ACCOUNT-013)
  "ui.account.title": "Come in",
  "ui.account.intro": "One account, one life. Sign in with Google, a passkey, or a code by email.",
  "ui.account.google": "Continue with Google",
  "ui.account.passkey": "Use a passkey",
  "ui.account.email.label": "Email",
  "ui.account.email.send": "Send me a code",
  "ui.account.email.empty": "Put in your email first.",
  "ui.account.code.label": "The 6-digit code",
  "ui.account.code.sent": "A code is on its way to {email}. It works for 5 minutes.",
  "ui.account.code.go": "Sign in",
  "ui.account.code.again": "Send a new code",
  "ui.account.code.short": "The code is 6 digits.",
  "ui.account.bot": "New here? This quick check makes sure you are a person.",
  "ui.account.working": "One moment...",
  "ui.account.loading": "Checking where you stand...",
  "ui.account.fail.not-fresh": "Sign in again to show it is you.",
  "ui.account.fail.wrong-code": "That code is not right. Check it and try again.",
  "ui.account.fail.expired": "That code has run out. Ask for a new one.",
  "ui.account.fail.too-many": "Too many tries. Wait a minute, then ask for a new code.",
  "ui.account.fail.cancelled": "Nothing happened. Try again when you are ready.",
  "ui.account.fail.unreachable": "The game could not reach its server. Check your connection and try again.",
  "ui.account.fail.refused": "That did not work. Try another way in.",
  "ui.account.notice.deleted": "Your account is deleted. Everything it held goes within 30 days.",
  "ui.account.notice.signed-out": "You have signed out.",

  // The settings (R-ACCOUNT-003, R-ACCOUNT-016)
  "ui.account.settings": "Account",
  "ui.account.passkey.add": "Add a passkey",
  "ui.account.passkey.added": "Passkey added. Use it next time you sign in.",
  "ui.account.sign-out": "Sign out",
  "ui.account.delete": "Delete my account",
  "ui.account.delete.warn": "This ends your life in Japacity for good. Your character, your saves and your account go, and nobody can bring them back.",
  "ui.account.delete.confirm": "Delete for good",
  "ui.account.delete.keep": "Keep my account",
  "ui.account.delete.fresh": "Before it goes, show it is you: sign in again, or get a code by email.",
  "ui.account.delete.code": "Send a code to {email}",
  "ui.account.delete.google": "Sign in again with Google, then come back here within 10 minutes.",
};
