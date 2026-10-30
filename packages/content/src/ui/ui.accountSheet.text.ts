// The account sheet's own words, in the voice of docs/rules/text.md: the username's change, the life's name, the usage counts,
// the bank-full notice's switch, the passkeys, signing out and deleting the account, a guest's among them. Read only once the account's row in
// Settings is tapped, or once the card that offers a passkey after a way in is due, so they ride a chunk of their own, fetched
// then (engine:first-download-has-budget); the row's own words stay in ui.online.text.ts.
export const uiAccountSheetText: Record<string, string> = {
  // The username and its change (account:username-and-unconfirmed-email), and the life's name beside it
  "ui.account.name.wait": "You changed it not long ago. You can change it again from {date}.",
  "ui.account.name.change": "Change it",
  "ui.account.name.step": "Change your username",
  "ui.account.name.change.go": "Save the new name",
  "ui.account.name.changed": "Saved. Others now see {name}.",
  "ui.account.name.free": "Your first change is free. After that, changes come a while apart.",
  "ui.account.person.label": "Character name",

  // The usage counts setting (analytics:player-can-stop-usage-counts)
  "ui.account.usage": "Send usage counts",
  "ui.account.usage.what": "What is this?",
  "ui.account.usage.help": "Counts of which screens open and how fast the game loads, never what you type or who you are. Off stops them.",
  "ui.account.usage.failed": "That did not save. Try again in a moment.",

  // The bank-full notice's switch (clock:full-bank-push-notification)
  "ui.notify.setting": "Tell me when my months are full",
  "ui.notify.blocked": "This browser blocks notices from Japacity. Allow them in its settings, then turn this on.",
  "ui.notify.unsupported": "This browser cannot show notices. On an iPhone, adding Japacity to the home screen may be needed first.",

  // The passkeys listed, added where they work and removed (account:passkey-needs-signed-in-session, account:passkeys-listed-and-removed,
  // account:passkey-offered-where-it-works)
  "ui.account.passkey.add": "Add a passkey",
  "ui.account.passkey.added": "Passkey added. Use it next time you sign in.",
  "ui.account.passkeys": "{count} passkeys",
  "ui.account.passkeys.one": "1 passkey",
  "ui.account.passkeys.zero": "Passkey: none yet",
  "ui.account.passkey.why": "Sign in with your face, fingerprint or screen lock instead of a code.",
  "ui.account.passkey.later": "Not now",
  // The card that offers a passkey right after a way in, over the world (account:passkey-offered-where-it-works): fetched with
  // these words, with Add a passkey, Not now and the passkey added above
  "ui.account.passkey.card.title": "Sign in faster next time",
  "ui.account.passkey.card.line": "Use your face, fingerprint or screen lock instead of a code.",
  "ui.account.passkey.fresh": "To add a passkey, first confirm it is you.",
  "ui.account.passkey.fresh.passkey": "Use my passkey",
  "ui.account.passkey.fresh.code": "Send a code to {email}",
  "ui.account.passkey.fresh.code.go": "Confirm with this code",
  "ui.account.passkey.fresh.done": "Confirmed. Tap Add a passkey to finish.",
  "ui.account.passkey.provider": "Passkey",
  "ui.account.passkey.added-on": "Added {date}",
  "ui.account.passkey.remove": "Remove",
  "ui.account.passkey.remove.named": "Remove {name}, added {date}",
  "ui.account.passkey.remove.ask": "Remove {name}? Any phone signed in with it is signed out.",
  "ui.account.passkey.last.google": "This is your last passkey. You can still sign in with Google.",
  "ui.account.passkey.last.email": "This is your last passkey. You can still sign in with a code sent to {email}.",
  "ui.account.passkey.last.go": "Remove it",
  "ui.account.passkey.last.keep": "Keep it",
  "ui.account.passkey.removed": "Removed. Other phones are signed out.",
  // An admin's removal from a session that has not shown a passkey (account:passkey-needs-signed-in-session)
  "ui.account.fail.passkey-first-remove": "Sign in with your passkey first, then remove it.",

  // A guest's deletion, its one costly row, with Delete my account and Delete for good below (account:player-deletes-account, account:sign-out-ends-the-session)
  "ui.account.delete.guest": "This life lives only on this phone, so deleting it ends it here and nothing of it is saved.",
  "ui.account.delete.save": "Save this life first",

  // Signing out here or everywhere (account:sign-out-ends-the-session)
  "ui.account.sign-out": "Sign out",
  "ui.account.sign-out.all": "Sign out on every phone",
  "ui.account.sign-out.all.warn": "This signs you out everywhere, this phone too.",
  "ui.account.sign-out.all.go": "Sign out everywhere",
  "ui.account.sign-out.all.keep": "Stay signed in",

  // Deleting the account (account:player-deletes-account)
  "ui.account.delete": "Delete my account",
  "ui.account.delete.warn": "This ends your life in Japacity for good. Your character, your saves and your account go, and nobody can bring them back.",
  "ui.account.delete.confirm": "Delete for good",
  "ui.account.delete.keep": "Keep my account",
  "ui.account.delete.fresh": "Before it goes, show it is you.",
  "ui.account.delete.passkey": "Delete with a passkey",
  "ui.account.delete.code": "Send a code to {email}",
  "ui.account.delete.code.go": "Delete with this code",
  "ui.account.delete.google": "Sign in again with Google, then come back here within 10 minutes.",
  // The other ways to show it is you, as quiet links under the one shown first
  "ui.account.delete.use.passkey": "Use a passkey instead",
  "ui.account.delete.use.code": "Use a code instead",
  "ui.account.delete.use.google": "Use Google instead",
};
