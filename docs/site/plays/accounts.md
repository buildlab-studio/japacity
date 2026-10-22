# Accounts

Playing needs no sign-in method at all. Online, a new player answers one question about their age, walks through the front door and starts as a guest: the life lives in that browser on that phone. Keeping it, so it can be opened anywhere, is asked for later, at moments that matter, with Google or a code sent by email; a passkey can be added once the life is kept.

::: info Locally there are no accounts
The build that runs on a developer's machine, the guest start and the play driver use the local authority: the life is kept in the browser and nothing on this page applies. See [The client](../built/client.md).
:::

<div style="display:flex;gap:12px;flex-wrap:wrap">
<img src="/pictures/accounts-start.webp" alt="The start screen: one line about the game, Play, I already have a life here, and the links to the terms of play and the privacy notice" width="260">
<img src="/pictures/accounts-age.webp" alt="The age screen: When were you born, with day, month and year empty" width="260">
<img src="/pictures/accounts-username.webp" alt="The door's page with the username filled in from the name and the line that the life lives only on this phone" width="260">
</div>

## Starting as a guest

```mermaid
flowchart TD
  S["The start screen"] -->|"Play"| A["The age screen: day, month, year"]
  A -->|"Under 18"| X["Refused, and the browser is remembered"]
  A -->|"18 or over"| D["The front door's three screens"]
  D --> P["The page: the player types a username, checked as they type"]
  P -->|"Begin"| B["The bot check runs unseen"]
  B --> G["A guest life: plays at once"]
  S -->|"I already have a life here"| W["Sign back in: Google, a code by email, a passkey"]
  A -->|"Already have a life here? Sign in."| W
  W -->|"A life is kept"| L["The life opens"]
  W -->|"No life with that"| S
```

In a browser a kept life was open in, the start screen turns its two doors round: "Sign in to my life" first, "Start a new life" under it. The age screen asks for a date of birth with nothing filled in and no hint of the age needed, with one quiet line under it for a returning player who tapped Play by habit. The account keeps only that the screen was passed, never the date. The username is filled in from the character's name on the page and can be changed there: 3 to 20 letters, numbers or underscores, unique, never a name kept for the game's own people. Other players see it; it is never the character's name and never a way in. One change is free, then there is a wait between changes.

## What a guest can do

A guest plays the whole single life: the city, the month, the news, the rates. A few things need a kept life, because they touch other people or real value:

- buying lottery tickets,
- appearing on a board or a public card,
- inviting or being invited as a partner or sibling,
- sending or reading messages,
- having the life restored on another device.

Each of them, tried as a guest, brings the ask to keep the life, never a dead end. The server enforces every one.

## Keeping the life

The ask comes after the first chapter, before the visa decision, and whenever a guest tries one of the things above. Never at the door, never before the first chapter's win. A quiet line on the settings and on the month's results says the same thing, plainly: this life lives only on this phone until you keep it.

<div style="display:flex;gap:12px;flex-wrap:wrap">
<img src="/pictures/accounts-keep-this-life.webp" alt="Keep this life: after the first chapter, Keep it with Google, or with your email, or Not now" width="260">
<img src="/pictures/accounts-sign-back-in.webp" alt="Sign back in: Continue with Google, an email code, Use a passkey" width="260">
</div>

| Way in | How |
|---|---|
| Google | First, wherever Google sign-in opens |
| A code by email | Six digits, good for five minutes and three tries; a new code replaces the old |
| A passkey | Added from the settings once the life is kept; bound to the game's own address |

::: tip Inside a chat app's browser
Some apps' built-in browsers block Google sign-in. There the game does not show Google. The ways back in offer the email code and a way to open the game in the phone's own browser; a guest life there is kept with the email code alone, since it lives in that app's browser, and once kept it opens in any browser.
:::

::: details Exceptions
- **A sign-in already used.** Keeping a guest life with a Google account or email that already has a life joins nothing and overwrites nothing: the game says so and the guest life stays as it is. It also offers to open the kept life instead, which ends the guest one; a guest's account sheet offers the same.
- **A sign-in with no life.** Signing back in never makes an account: a way in with no life behind it says so and sends you back to Play.
- **Full.** While sign-ups are switched off, a full screen says to try again shortly, and checks again on its own once the wait is over.
- **Too many new lives.** Guest lives from one device or one connection in a day are limited.
- **One character.** An account holds one life at a time. Settings' "Start a new life" ends it for good first.
- **Deleting the account.** From the settings, with a sign-in from the last ten minutes or a fresh code. Every session ends at once and everything the account held goes within 30 days.
:::

<img src="/pictures/accounts-full.webp" alt="The full screen: Japacity is full right now. Try again shortly, with Check again waiting" width="260">

## Invite links

A friend's invite opens on a page of its own: the friend's card first, with a report control, then the age screen and the username, or the ways back in for a player who already kept a life. A card's link works once, for 14 days. Only a kept life may be invited, so a new guest keeps the life before taking the card. No advert shows on this page. See [People](./people.md).

<img src="/pictures/accounts-invite-card.webp" alt="A friend sent you a card: the friend's card, Report, and the age screen under it" width="260">

## Rules it rests on

- [Accounts](../../rules/account.md): account:sign-in-without-secret, account:email-code-is-short-lived, account:passkey-needs-signed-in-session, account:no-text-message-codes, account:stand-ins-test-sign-in and account:session-is-secure-cookie (signing in), account:same-contact-for-everyone, account:sign-up-open-everywhere, account:age-screen-refuses-minors and account:bot-check-on-guest-creation (one game for every country, the age screen, the bot check), account:one-character-per-account, account:player-deletes-account, account:deleted-data-removed-within-month and account:deletion-keeps-anonymous-totals (one character, deletion), account:guest-and-secured-states, account:social-needs-secured-account, account:guest-secures-the-life, account:username-and-unconfirmed-email, account:guest-floods-are-capped, account:idle-guests-cleaned-by-hand, account:guest-reminded-to-secure, account:play-starts-without-email, account:start-screen-over-live-city and account:start-a-new-life (guests, keeping a life, the username, the start screen, a new life).
- [Pairs](../../rules/pair.md): pair:invite-card-contents, pair:invite-link-single-use (the invite page).
- [The server](../../rules/server.md): server:signups-off-shows-full (the full screen).
- [Guides, sources and credits](../../rules/guide.md): guide:nothing-asked-before-early-win (never before the early win).
