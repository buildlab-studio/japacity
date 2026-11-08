# Accounts

Playing needs no sign-in method at all. Online, a new player answers one question about their age, walks through the front door and starts as a guest: the life lives in that browser on that phone. Saving it, so it can be opened anywhere, is asked for later, at moments that matter, with Google or a code sent by email; a passkey can be added once the life is saved.

::: info Locally there are no accounts
The build that runs on a developer's machine, the guest start and the play driver use the local authority: the life is kept in the browser and nothing on this page applies. See [The client](../built/client.md).
:::

<div style="display:flex;gap:12px;flex-wrap:wrap">
<img src="/pictures/accounts-start.webp" alt="The start screen: one line about the game, Play, Sign in with its line Carry on a saved life, and the links to the terms of play and the privacy notice" width="260">
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
  S -->|"Sign in"| W["Sign back in: Google, a code by email, a passkey"]
  A -->|"Already have a life here? Sign in."| W
  W -->|"A life is saved"| L["The life opens"]
  W -->|"No life with that"| S
```

In a browser a saved life was open in, the start screen turns its two doors round: "Sign in" first, "Start a new life" under it; both ways, Sign in carries the small line "Carry on a saved life". The age screen asks for a date of birth with nothing filled in and no hint of the age needed, with one quiet line under it for a returning player who tapped Play by habit. The account keeps only that the screen was passed, never the date. The username is typed on the page into an empty box, which says whether it is free as it is typed: 3 to 20 letters, numbers or underscores, unique, never a name for the game's own people. Other players see it; it is never the character's name and never a way in. One change is free, then there is a wait between changes; the box that changes it in Settings checks the same way as it is typed.

## What a guest can do

A guest plays the whole single life: the city, the month, the news, the rates. A few things need a saved life, because they touch other people or real value:

- buying lottery tickets,
- appearing on a board or a public card,
- inviting or being invited as a partner or sibling,
- sending or reading messages,
- having the life restored on another device.

Each of them, tried as a guest, brings the ask to save the life, never a dead end. The server enforces every one.

## Saving the life

The ask comes once the first month's results are read, before the visa decision, and whenever a guest tries one of the things above. Never at the door, never before the life's first win. A small "Not saved" chip under the money stands over the world for as long as the life is a guest's, and a tap on it opens the same sheet; it goes the moment the life is saved. A quiet line on the settings and on the month's results says the same thing, plainly: this life lives only on this phone until you save it.

Once the life is saved, the sheet says so and offers a passkey as the next step, so the next sign-in is a face, a fingerprint or the screen lock; "Not now" skips it.

<div style="display:flex;gap:12px;flex-wrap:wrap">
<img src="/pictures/accounts-keep-this-life.webp" alt="Save this life: save it with Google, or with your email, or Not now" width="260">
<img src="/pictures/accounts-sign-back-in.webp" alt="Sign back in: Continue with Google, an email code, Use a passkey" width="260">
</div>

| Way in | How |
|---|---|
| Google | First, wherever Google sign-in opens |
| A code by email | Six digits, good for five minutes and three tries; a new code replaces the old |
| A passkey | Offered right after the life is saved, and added from the settings any time after; bound to the game's own address |

::: tip Inside a chat app's browser
Some apps' built-in browsers block Google sign-in. There the game does not show Google. The ways back in offer the email code and a way to open the game in the phone's own browser; a guest life there is saved with the email code alone, since it lives in that app's browser, and once saved it opens in any browser.
:::

::: details Exceptions
- **A sign-in already used.** Saving a guest life with a Google account or email that already has a life joins nothing and overwrites nothing: the game says so and the guest life stays as it is. It also offers "Sign in to my saved life" instead, which ends the guest one; a guest's account sheet offers "Sign in" the same way.
- **A sign-in with no life.** The code goes to every address alike, so the ways back in never tell anyone whether an address plays here. The right code for an address no life is saved with leads into starting one, already saved with that email: the age question, then the username on its own step, whose Continue makes the account; the door follows, and the account opens on it from any phone signed in with that email. A code that ran out before Continue is told there with a new one sent, the username kept. "Continue with Google" with no life behind it leads into the same steps, under the same line, with "Use another way" to go back: Continue makes the account saved with Google, so the next "Continue with Google" opens it, and a Google sign-in that ran out before Continue is offered again on the step, the username kept. A passkey with no life behind it, or a Google account whose address Google has not verified, says so and sends you back to Play.
- **Google did not finish.** A no at Google's own screen comes back as "Nothing happened. Try again when you are ready."; a trip that lost its way as "Google sign-in did not finish. Try again, or use a code by email.", at the top of the sheet it came back to.
- **Full.** While sign-ups are switched off, a full screen says to try again shortly, and checks again on its own once the wait is over.
- **Too many new lives.** Guest lives from one device or one connection in a day are limited.
- **One character.** An account holds one life at a time. Settings' "Start a new life" ends it for good first.
- **Deleting the account.** From the settings, with a sign-in from the last ten minutes or a fresh code. Every session ends at once and everything the account held goes within 30 days.
:::

<img src="/pictures/accounts-full.webp" alt="The full screen: Japacity is full right now. Try again shortly, with Check again waiting" width="260">

## Invite links

A friend's invite opens on a page of its own: the friend's card first, with a report control, then the age screen and the username, or the ways back in for a player who already saved a life. A card's link works once, for 14 days. Only a saved life may be invited, so a new guest saves the life before taking the card. No advert shows on this page. See [People](./people.md).

<img src="/pictures/accounts-invite-card.webp" alt="A friend sent you a card: the friend's card, Report, and the age screen under it" width="260">

## Rules it rests on

- [Accounts](../../rules/account.md): account:sign-in-without-secret, account:email-code-is-short-lived, account:passkey-needs-signed-in-session, account:no-text-message-codes, account:stand-ins-test-sign-in and account:session-is-secure-cookie (signing in), account:same-contact-for-everyone, account:sign-up-open-everywhere, account:age-screen-refuses-minors and account:bot-check-on-guest-creation (one game for every country, the age screen, the bot check), account:one-character-per-account, account:player-deletes-account, account:deleted-data-removed-within-month and account:deletion-keeps-anonymous-totals (one character, deletion), account:guest-and-secured-states, account:social-needs-secured-account, account:guest-secures-the-life, account:username-and-unconfirmed-email, account:guest-floods-are-capped, account:idle-guests-cleaned-by-hand, account:guest-reminded-to-secure, account:play-starts-without-email, account:start-screen-over-live-city and account:start-a-new-life (guests, saving a life, the username, the start screen, a new life).
- [Pairs](../../rules/pair.md): pair:invite-card-contents, pair:invite-link-single-use (the invite page).
- [The server](../../rules/server.md): server:signups-off-shows-full (the full screen).
- [Guides, sources and credits](../../rules/guide.md): guide:nothing-asked-before-early-win (never before the early win).
