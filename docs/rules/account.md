# Accounts: sign-in, the age screen, who may sign up and deletion

> Rests on `../design/01-concept.md` section 16, `../design/04-where-things-live.md` sections 2 and 5, and on the Better Auth and Cloudflare pages under Sources.
> Kinds: none in the simulation. Accounts live in `apps/server` and its database tables; the simulation never sees an account, an email or a country.

An account is a way back to one character. It keeps as little personal data as sign-in needs, is made only by an adult, can be made from any country, and gives every player the same contact with others. Nothing here costs a player money and nothing here asks for a password.

## Rules: signing in

**account:sign-in-without-secret** An account is secured by Google, by a passkey, or by a code sent to an email address. An account may link more than one of these.

- **No password, no username login.** The auth library's password sign-in is left off, so its routes refuse every request. A username is a display name only (account:username-and-unconfirmed-email).
- **Starting.** A player starts as a guest with no way in at all (account:guest-and-secured-states) and secures the account later, or secures it from the start with an email proved on the ways back in.
- **The send treats every address alike.** With or without an account, the reply is "We sent a code to {email}." and the code step. The mail goes to every address except a banned one, which is mailed nothing and told the same (moderation:ban-survives-as-hash). The reply takes one path for both: the user is looked up and the code stored either way, and the mail is sent off the reply's path, so an address with no account is not answered faster.
- **Only the right code tells them apart.** Only the inbox's owner holds it. Where an account uses the address, the right code signs in. Where none does, the server checks and spends the code in one step (never through the library's own sign-in), keeps a proof of the address and answers `new-life`. A wrong, run-out or used-up code is refused the same way for both kinds of address.
- **A new life from a proved address.** The player goes to the age screen (skipped when this browser already holds an age pass), then to the username on a step of its own: "Choose a username", the door's box and its checks, the bot check unseen, no guest line, and one main button, "Continue". The box takes the focus on a desktop (account:code-form-forgives).
  - Both steps stand under the line "No life is saved with {email} yet. Let's start one.", with "Use another email" as a quiet link. That link drops the proof and its cookie and goes back to the ways back in with the address emptied.
  - The age screen's own line back to the ways back in is not shown on this path. A minor's refusal drops the proof and makes nothing.
  - Continue makes the account there: secured by the email, confirmed, with no character, and the browser signed in. From then it is an ordinary signed-in account with no character, which every browser opens on the door. After Begin the world says "Saved with your email".
- **A new life from Google.** Google with no life proves its address and its Google identity as the right code proves an address. This applies when the player is signed out, Google's callback finds no account holding that Google identity and none using its address, Google says the address is verified, and neither the address nor the identity (`google:<sub>`) is banned. Then the server makes nothing, keeps the same kind of proof holding the address and the identity (named by the same cookie, set on the callback's own redirect home), and sends the page home with `?error=new-life`.
  - The same steps follow under the same line, with "Use another way" in place of "Use another email". It drops the proof and goes back to the ways back in as they stand.
  - Continue makes the account secured by the email and confirmed, with that Google identity joined as its Google way in, after checking again that the identity is not banned and not joined to another account. A failed check is refused as the address taken, never turned into a plain guest.
  - The account sheet then shows Google, the next "Continue with Google" signs straight in, and after Begin the world says "Saved with Google".
  - If the Google proof has run out at Continue: "Your Google sign-in ran out. Continue with Google again.", with Google's button on the step and no code sent. The fresh proof Google gives opens the step again with the username kept.
  - If the address or the identity was taken meanwhile: "That email has a life now. Continue with Google to open it."
- **While the proof lives**, the server names its address to the gate on load, so a reload or another tab opens on the same step.
  - If the code's proof has run out at Continue: "Your code ran out. We sent a new one to {email}.", with the code form on the step and the username kept. Its right code lets Continue go on.
  - If the address was taken meanwhile, the player is sent a code that opens that account.
  - A player who came to sign in is never made into a plain guest.
- **A passkey this site does not know, or a Google trip whose address Google has not verified**, finds no life. Only the holder of that passkey or Google account can try it, so saying no life was found tells nobody else anything (unlike an email address, which anyone can type). These cases keep their own words, with "Start a new life" under them, which opens Play's start.
- A banned address or Google identity is refused as moderation:ban-survives-as-hash says.

**account:email-code-is-short-lived** An email code is 6 digits, valid for 5 minutes, and allows 3 tries. A new code replaces the old one. The email's subject leads with the code ("{code} is your Japacity code"), so it can be read from the phone's notification. A code is sent without the request waiting on the send. The send answers the same for every address, with or without an account, inside the send limits, which count every address alike (account:sign-in-routes-rate-limited, account:sign-in-without-secret). The database keeps only a code's hash, so reading the database yields no working code.

**account:passkey-needs-signed-in-session** A passkey is registered only from a signed-in session and is bound to the game's own domain as its relying party.

- Registration asks the phone to keep the passkey itself (`residentKey: required`), so it signs in with no email typed, and the phone lists it under the account's email.
- **Admin accounts.** On an account on the admin list (moderation:admin-view-for-admin-list) that already holds a passkey, a new passkey is registered only from a session that has shown a passkey, and a passkey or a linked sign-in is removed only from such a session. Any other session is refused. So a session opened by a code cannot remove the admin's passkey and then add its own as the first. Without this, anyone who got into an admin's email could add a passkey of their own and reach the admin pages.
- **Audit and notice.** Every registration is written to the audit log: a hash of the account, the passkey, whether the account is an admin, and how the session was opened. A notice goes to the account's email, without the reply waiting on the send, saying where in the game to remove the passkey and sign out on every phone.
- **The standard.** NIST SP 800-63B-4 section 4.1.2.1 asks that binding a new authenticator needs authentication at the highest level the account already has (or at the level the new one will be used at, if lower), and that the subscriber is told by a way independent of the binding (section 4.6). The admin rule is stricter than the standard's letter: it takes only a session that has shown a passkey, where the standard would take any authentication at that level.
- **The relying party id** is exactly the host of SITE_URL: `japacity.app` in production (the apex, never a subdomain) and `staging.japacity.app` on staging, so a staging passkey never signs in to production. A SITE_URL that is not a bare https origin is refused. A passkey is bound to its relying party id for good, so neither id changes once a real passkey exists.

**account:passkey-added-in-place** Adding a passkey needs a session opened within the last 10 minutes, the auth library's fresh age (account:player-deletes-account).

- From an older session the account sheet asks in place: "To add a passkey, first confirm it is you.", with a code sent to the account's email, and "Use my passkey" where the account holds one (only that account's own passkeys answer, as account:player-deletes-account says). Once confirmed, the passkey is made at once. Nobody signs out to add one.
- On an admin's account that holds a passkey, the server refuses a session that has not shown a passkey within the admin's window (account:passkey-needs-signed-in-session). The sheet asks the same in place with "Use my passkey" alone, since a code opens no passkey session, and makes the new passkey once one is shown.
- The phone's passkey list names the passkey with the account's email, which the auth library already gives it. Nothing new is stored for the name.

**account:passkeys-listed-and-removed** The sheet of a kept life lists its passkeys under their count.

- The list is read each time the sheet opens, so a passkey added or removed on another phone shows as it is, and the count is the list's own once read.
- Oldest first. Each shows its provider's name from its AAGUID ("Passkey" where the authenticator gives none, as an iPhone's does), "Added" with the day, and "Remove".
- Removing one asks first, inside that passkey's own row in place of its Remove. Removing the last one also names the way still left: "You can still sign in with Google." or a code sent to the email.
- A removal that leaves this phone's session standing says "Removed. Other phones are signed out." in that row's place. One that also ended this phone's session takes the player to the start screen with the signed-out notice.

**account:passkey-offered-where-it-works** "Add a passkey" shows only where the browser can make one: it has its own authenticator or can use a phone nearby (`PublicKeyCredential.getClientCapabilities()`, or the platform authenticator alone where that call is missing). It never shows inside an in-app browser (the list in account:guest-secures-the-life), whose passkeys would stay in that app. On the account sheet it always carries the line "Sign in with your face, fingerprint or screen lock instead of a code."

A passkey is offered right after the way in, as most sites offer one after a sign-up or a sign-in by another way:

- **As the Kept sheet's next step.** Once a guest has kept its life with Google or the email code, and once a new life kept from the start comes into the world, the passkey is the Kept sheet's next step in the same flow (account:guest-secures-the-life). Under "Saved" and its line: the title "Sign in faster next time", the line "Use your face, fingerprint or screen lock instead of a code.", "Add a passkey" as the main button, and "Not now", which skips it and closes the sheet.
- **As a card after signing back in.** Once a kept life is signed back in to by Google or the code, a small card with the same words follows the welcome line over the world ("Signed in with Google" and its kin, account:guest-secures-the-life), once that line has been told. No card follows a line a Kept sheet told, so one save is offered a passkey once.
- **Where they show.** The step and the card show only where the account holds no passkey, and under the same check as the sheet's "Add a passkey", so never inside an in-app browser. The card never shows over an open sheet or a moment that holds the screen; it waits for them to close.
- **Once per device.** `japacity.passkey.offered` is set in the browser's storage as either shows, so after "Not now" neither asks again on that device.
- **Pressing "Add a passkey"** makes the passkey at once, since the session the way in opened is fresh (account:passkey-added-in-place). Success says "Passkey added. Use it next time you sign in." and sets the passkey mark (account:passkey-in-email-autofill). A cancel closes the card quietly and leaves the step standing with nothing said. Any other failure is told in the step or the card in its own words, as the sheet tells it (account:passkey-errors-told-apart).
- **Not offered** after a sign-in by passkey, or to an account that holds a passkey, an admin's among them.
- **Loading.** The step, the card and their words are fetched only once a life is kept or a welcome line the card may follow has been told, so a first visit carries none of them (engine:first-download-has-budget).
- The passkey on the delete confirmation shows under the same check.

**account:passkey-errors-told-apart** Each passkey failure has its own words:

- A prompt the player cancels (the browser's NotAllowedError, or an abort) says nothing on the account sheet and is treated elsewhere as if nothing happened, never as a refusal.
- A passkey this phone already holds for the account: "This phone already has a passkey for this life."
- A passkey the account no longer holds: "This passkey is not linked to any account. Sign in another way." It is also named to the phone with `PublicKeyCredential.signalUnknownCredential` where the browser has it, so the phone stops offering it.
- A passkey of another account: "That passkey belongs to another life. Use one made for this life."

**account:code-form-forgives** The code form forgives a slip and says one thing at a time.

- **The email field** is named `email` and is not capitalised or spell-checked. An address that is not something, an @, something, a dot and something is told "That email does not look right." and nothing is sent.
- **Before a send**, the ways back in hold the heading and its line, Google, the email field and "Send me a code", and the passkey button only as account:passkey-in-email-autofill says. The email field is the first field to fill: it takes the focus as the ways back in open on a desktop and not on a touch phone (as account:username-typed-and-checked says of a first field). A send refused for the address (empty, or not of its shape) focuses it on every device.
- **Once a code is sent**, the sheet holds the code step alone, with no Google, no passkey and no line under the heading:
  - the heading "Check your email";
  - the line "We sent a code to {email}." with "Change" right after the address, a quiet link back to the address, filled in, with the focus in the field on a desktop;
  - the code field, labelled "6-digit code" for screen readers with no label shown. It is the first field to fill on the step and takes the focus as the step opens on a desktop, not on a touch phone;
  - one status slot directly under the field (world:field-says-its-state);
  - "Sign in".
- Before a send, the slot stands directly under the email field, over "Send me a code".
- **The code field** keeps digits alone, up to six, with no length cut before that, so a pasted "123 456" keeps all six. The sixth digit sends the code, once.
- **The status slot** is one polite live region, mounted before its words. It holds one thing at a time, an error replacing whatever stood there:
  - nothing at first;
  - once 30 seconds have passed since the last send, "No code? Check spam, or send a new one.", where "send a new one" is a quiet link that sends a new code. There is no way to a new code before then;
  - after a new code, "We sent a new code. Use the newest one." until the next line replaces it;
  - or an error, in the out colour with the problem's icon (world:field-says-its-state). Changing a digit takes the error away.
- **Each answer says what it means and what to do:**
  - "Sign in" with fewer than six digits: "The code is 6 digits.", with the field focused on every device.
  - A wrong code: "That code is not right.", with the field focused on every device and its digits selected, so typing replaces them, and "Sign in" off until they change. A refused code is never sent again unchanged, which also keeps a player inside the limit on code checks.
  - Tries used up: "Too many wrong tries. Send a new code."
  - A code that ran out: "That code has run out."
  - For both of those, the field and "Sign in" go at once and "Send a new code" is the one main button.
  - The auth library's own limit on code checks from one address (account:sign-in-routes-rate-limited), a 429 with no code of the code's own: "Too many tries at once. Wait a few seconds and try again.", told apart from used-up tries.
- A code's expiry is told when it happens, never up front.
- An error from the send stands in the same slot under the field. A send over its limits keeps its own words.
- **Height.** On the ways back in the sheet rises to the band across the top, so on a 375 by 667 phone and a 390 by 844 one neither step scrolls with the keyboard closed. The start and age screens keep their own height.

**account:passkey-in-email-autofill** On the ways back in, outside an in-app browser (account:guest-secures-the-life), the email field carries `autocomplete="username webauthn"`.

- Where the browser says it offers passkeys in a field's autofill (`PublicKeyCredential.getClientCapabilities()` with `conditionalGet`, or the older `isConditionalMediationAvailable`), one conditional passkey request starts with the field. A passkey picked there signs in; a cancel of it says nothing; a passkey picked there that the server refuses is told as the button's is (account:passkey-errors-told-apart).
- Where the browser offers that autofill, a tap on the email field shows the phone's passkeys for the game, as on most sites with passkeys, and "Use a passkey" is not shown at first. The browser never tells the page whether its list showed, so the button shows, quietly under the email field, as soon as the field did not do the job:
  - the conditional request ends in a failure that is not a cancel or an abort (a cancel stays quiet and shows nothing, account:passkey-errors-told-apart); or
  - this browser holds the passkey mark below and the player types into the email field, so the passkey stands beside the code.
- Where the browser offers no such autofill, or until it has said it does, "Use a passkey" stands from the start.
- The button's own request cancels the conditional one. Once the button's prompt ends short of a sign-in (a cancel or a refusal), the conditional request starts again, so the autofill still works after it. Every request asks the server for a fresh challenge.
- Once a passkey signs in or is added here, `japacity.account.passkey` is set in the browser's storage (no account data, never cleared by the game). From then on the email field comes first on the ways back in, above Google, so the passkey is one tap away.

**account:no-text-message-codes** No text-message codes: a code to a Nigerian number costs $0.22 to $0.39 (`../design/04-where-things-live.md` section 5).

**account:stand-ins-test-sign-in** Locally, sign-in is tested with stand-ins that exist only in the test server's config:

- email codes are read back from the test server's stand-in for the send, since the database keeps only their hash (account:email-code-is-short-lived);
- Google sign-in goes to a stub provider, served by the test server, that signs in a fixed test identity;
- passkeys are made by a virtual authenticator in the browser tests;
- a signed-in session for a unit test comes from the test utilities' `login`.

A test proves the production config holds none of the four.

**account:session-is-secure-cookie** A session is a cookie that is `HttpOnly`, `Secure` and `SameSite=Lax`.

- Deleting the account (account:player-deletes-account) ends every session of that account at once.
- Removing a linked method or a passkey ends every other session of that account and keeps the one that removed it: the phone in hand stays signed in and every other phone is signed out.
- **Staging's wall.** Staging keeps Cloudflare Access in front of the whole host: an email login with its own 24 h cookie beside this session.
- **Wall or signed out.** A request that meets a login wall or a session ended outside the game is a `wall` (engine:browser-authority-for-dev-only), never the game's `signed-out`. A wall is a redirect, an opaque redirect, a redirect to a `cloudflareaccess.com` host, a 401 or 403 with no JSON body, or a page where JSON was expected. Only the game's Worker answers in JSON, so a 401 or 403 with a JSON body (the game's `signed-out`, the auth library's refusals) is the server's answer, never a wall. The game's own 401 always carries `signed-out` in its body and goes to the account screens.
- **Reloading on a wall.** The first wall reloads the whole page once, so the login shows. The reload is marked in the tab's session storage, and the mark is cleared only by a reply from the game that comes 3 s or more after it was set. So on a host walled in part, a route that answers at once beside a walled one never sets off a loop of reloads. A second wall within a minute does not reload again: the card says "Your session ended" with Reload. Without session storage nothing reloads and the card shows.

**account:dead-cookie-expired-on-first-read** A browser may send a validly signed session cookie whose session is gone (a reset, a deletion, a clean-up, sessions ended elsewhere). That cookie is expired on the reply to the first request that reads its session, whatever the reply's status, the game's `signed-out` 401 included. The session is read once per request, however many of its gates and its route ask. A reply that sets a session cookie of its own, as the guest start does after finding no live session, keeps its own: the browser ends with the new cookie, never with none.

**account:session-renewal-reaches-browser** A live session read more than a day after it was last renewed is renewed for its full life (the 400 days of account:guest-and-secured-states), and the renewed cookie is set on the reply that read it, so the browser's cookie lasts as long as the session it opens. A socket's upgrade is handed on untouched (server:security-headers-on-replies), so a renewal read there reaches the browser with the next reply. A reply whose headers cannot change is copied with the cookie. The privacy notice says what a session keeps and for how long, for a guest as for a kept account: the internet address and the kind of device and browser, kept with that session alone, which lasts up to 400 days, counted again from each day it is used.

**account:sign-out-ends-the-session** Signing out ends the session on the server before the player leaves. A sign-out that does not reach the server keeps the player in, with "Could not sign out. Check your connection and try again.", so the next load never opens the life again on a shared phone.

- A kept life's sheet also holds "Sign out on every phone", asked first in place of the two sign-out buttons, with "This signs you out everywhere, this phone too." It ends every session of the account on the server, then drops this browser's cookie, and the player leaves with the signed-out notice. A failure keeps the player in with the same line.
- A guest's sheet holds no Sign out. A guest's session is its only way back, so signing out would end its life as deleting does. Its one way out is "Delete my account" (account:player-deletes-account).

## Rules: guests and secured accounts

A player passes the age screen and the bot check, picks a username and plays at once. The life lives on that device until it is secured. Securing is asked for at moments of investment, never at the door.

**account:guest-and-secured-states** An account has two states, `guest` and `secured`.

- A guest account is created by the auth library's anonymous sign-in after the age screen (account:age-screen-refuses-minors) and the bot check (account:bot-check-on-guest-creation). It has a username (account:username-and-unconfirmed-email) and nothing else: no email, no password.
- Its session is the only way back in, so the life exists only in that browser on that device until secured. The game says so plainly when the life starts and in the quiet reminder of account:guest-reminded-to-secure.
- A notice left by signing out or deleting shows on the first screen of the gate and goes when the player moves on to another screen.
- **A dead session cookie never stops a new sign-in.** A browser still holding a signed session cookie whose session is gone (a reset, a deletion, a clean-up, sessions ended elsewhere) starts a guest, or signs in by code, Google or a passkey, as a browser with no cookie would. A live guest's cookie still links the new way in (account:guest-secures-the-life). If the character's start is still answered signed-out after the guest start, the page says the life did not start, and the next Begin makes the guest again.

**account:social-needs-secured-account** A guest can play the whole single life and see the world, the news and the rates. Only a secured account can:

- buy lottery tickets;
- appear on any board or public card;
- invite or be invited as a partner or sibling;
- send or read messages;
- have its life restored on another device.

Each of these is refused for a guest with the code `guest-only` and a detail that names the way to secure. The client shows the ask, never a dead end. The server enforces every one: a hidden screen is not enough. The boards are guarded at `/api/boards/*`, the paths the client reads. The board's rows read the account's own guest state, and securing lists the account's board rows again (city:board-line-and-ranking).

**account:guest-secures-the-life** A guest secures its life by adding Google first, or a code sent to an email address. A passkey can be registered once the account is secured.

**In-app browsers.** These block Google: WhatsApp, X, Instagram, TikTok, Facebook, Snapchat, LinkedIn, Line, WeChat, any Android web view marked `; wv)`, and an iPhone browser with no `Safari/` mark that is not Chrome, Firefox or Edge and was not opened from the home screen. Inside them:

- Google is not shown, and neither is a passkey, which is unreliable there: no passkey button and no passkey autofill on the ways back in.
- The ways back in offer the emailed code with "Open in my browser".
- The keep-this-life sheet offers the emailed code alone, with no line that sends a guest away before the life is kept, since the guest life lives in that app's own browser and nowhere else: "Google does not open inside this app. Save this life with your email here, then open it in any browser." Once the life is kept there, the Kept state adds "Open in my browser".
- "Open in my browser" is one button wherever it stands. On Android it is a Chrome intent link (`intent://<host><path>#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=<the address>;end`), which falls back to the plain address. On an iPhone, where no link can leave the app, it opens a small sheet with the one line "Tap the ••• or share button at the top, then Open in Safari." and the address to copy.

**Moving the life.** The auth library's anonymous link moves the guest onto the secured account. The life, the saves, the clock and every store row move with it; a test proves nothing is lost.

**A way in that already has an account.** Securing with it joins nothing and overwrites nothing: the player is told that way is taken and keeps the guest life; a test proves neither life changes. The refusal offers "Sign in to my saved life" under "This life on this phone ends if you do.". It signs the guest out and opens the ways back in, with the address filled in when the code was the way. A guest's account sheet offers "Sign in" too: the first press says the same line, and the second does the same.

**When the game asks.**

- The first ask comes once the first month's results are closed, before the visa decision, and before anything in account:social-needs-secured-account.
- Never at the door, and never before the early win (guide:nothing-asked-before-early-win). A life whose early win is not in by then is asked once the results that told it are closed.
- Each of the two staged asks, the first month's and the visa decision's, is made once per life. A life that holds the first chapter's mark of the ask counts as asked after its first month.
- The ask waits while a sheet is open. A mission card or a chapter close counts as an open sheet, and so does a brief's card still waiting for the place's first frame: the city marks that wait in the document (`[data-brief-pending]`, chapter:first-chapter-mission-card) and the ask waits for the mark to go.
- It waits the same way for a teach card open over the world (the teach of world:top-band-is-a-pill: the home's card, `[data-home-teach]`, and the first night's card, `[data-night-teach]`) and comes once the card is dismissed.

**The "Not saved" chip.** A guest's life carries the "Not saved" chip over the world as the standing way to the sheet (account:guest-reminded-to-secure). It is a sticker chip in the game's look (`../design/09-the-games-look.md` section 2) hung under the band's money (world:top-band-is-a-pill), never a countdown or an alarm, and is in view whenever the band is. A tap opens the keep-this-life sheet, inside an in-app browser too, where the sheet offers the email alone. It goes the moment the life is saved. It never stands on the door, the years or the handover, for a secured account, or in the local game, which has no account.

**Google's button.** Google is offered on Google's own standard button wherever it is offered (the keep-this-life sheet, the ways back in, the settings), as Google's sign-in branding guidelines describe: the G as Google gives it at the left, unchanged, "Continue with Google", the light theme on a light sheet and the dark one on a dark sheet, the guidelines' sizes, and Google Sans Medium. The sheet around it keeps the game's voice ("Save this life", "Or with your email").

**The keep-this-life sheet.**

- Its reason is one short line.
- Once a code is sent it says one thing at a time, as account:code-form-forgives says: the reason, Google and "Or with your email" step back, and the code step stands with "Not now", all in view on a 375 by 667 phone. "Change" brings the first step back whole.
- Once the life is kept, the sheet says only that and its next step: the heading "Saved", the one line "Saved. Sign in on any phone to carry on." and its close, then the passkey as the next step where one can be made (account:passkey-offered-where-it-works), or "Open in my browser" inside an in-app browser. No reason, no ways to keep, and "Not now" only as the passkey step's skip.

**Coming back from Google.** Google's trip comes back marked with its purpose (`?google=kept`, `?google=in`) or with `?error=`.

- A returned error is said at the top of the sheet it came back to, never only at its foot.
- A refusal the player chose at Google (`access_denied`) is told as a cancel: "Nothing happened. Try again when you are ready."
- A trip that lost its way (`state_mismatch`, `please_restart_the_process`, and any error the game does not know): "Google sign-in did not finish. Try again, or use a code by email."
- Kept with Google, the securing sheet opens in its Kept state, as the code's does.

**The welcome line.** As a Kept sheet closes, and when a kept life is signed back in to, a short line over the world names the way for three seconds. It is read out through one polite live region mounted with the world.

**Kept lives and other ways in.** A code to the address of a kept life opens it whatever way it was kept, with no words about it, since that is how the game works. Google on an address kept by code joins it by the verified address. Where the library refuses (`account_not_linked`), the player is pointed to the code in the game's words.

**A new life kept with an email from the start** (from the ways back in, account:sign-in-without-secret). The right code for an address no account uses proves it before the life starts.

- The server checks and spends the code in one step, as the auth library checks its own sign-in codes, and keeps a proof holding the address alone: single use, for 30 minutes, in the library's verification table under its own prefix. It is named only by an httpOnly cookie with the session cookie's attributes, never in a URL or the page's storage, and is deleted on use and on expiry.
- Wrong, run-out and used-up codes are told as account:code-form-forgives says.
- The life is made at the username's step, the earliest point where it can be, since the account's row needs the age and the username. The guest start, marked as one that came by the code, consumes the age pass and the live proof, and makes the account already kept by that email, as a guest that kept its life by the code would be (the same rows and marks, the email confirmed), with no character, after the bot check of account:bot-check-on-guest-creation.
- The door follows, as for any signed-in account with no character. Then the keep-this-life sheet stands over the world in its Kept state once nothing else is up (the first brief's card handed, the open sheets and moments closed, and a teach card over the world, the home's or the first night's, dismissed), with the passkey as its next step (account:passkey-offered-where-it-works), and "Saved with your email" as it closes.
- Such a life never gets the ask to save it, the "Not saved" chip or the guest reminder.
- That start with no live proof is refused `proof-gone` before the age pass is spent. Where an account took the address meanwhile, it is refused, never made a plain guest. A second tab's start finds the browser signed in and opens what the session holds. While sign-ups are off, the full screen stands and the proof is kept for its time.

**A new life kept with Google from the start** works the same way. Google's return with no life keeps the same kind of proof, holding the address Google verified and the Google identity (a proof holding the address alone is the code's). The start that consumes it makes the account kept by that email with the Google identity joined, written as the account's Google row through the auth library's adapter with no token. So the life is saved with Google as a guest's kept with Google would be, its Kept sheet stands over the world as the code's does, and "Saved with Google" is said as it closes.

**Play's start and the proof.**

- On Play's start, a live proof held by the browser is consumed the same way. With none, the life starts as a plain guest.
- Where an account took the address meanwhile, the life starts as a plain guest and the world says "That email has an account already. This life is not saved yet."
- A proof made in one browser does nothing in another.
- A guest keeping its life is sent a code to any address, and is told that the address already has an account only after the right code.

**account:username-and-unconfirmed-email** The unconfirmed email and the username.

- **Unconfirmed email.** An email that has not been confirmed gives nothing and blocks nothing: it cannot sign in or recover, and it does not reserve the address. If its real owner confirms it later on any account, the unconfirmed claim elsewhere is dropped.
- **Username.** Letters, digits and underscore, 3 to 20 characters, unique whatever the capitals, not on the reserved list (the game's name, admin, support, staff, official, moderator, japacity and their spellings) and not matching the blocked-words list. One free change, then a wait of `account.renameDays` between changes. It is the account's handle, never the character's name and never a way in, and it is reportable like any free text (`moderation.md`). The server enforces all of it.
- **Where it is asked** (its own step on the sign-in path, the door's last page on Play's path), the help line under its label, over the box, says who sees it: "Other players see this, on the street and on boards. You can change it once for free." The line under the box holds only the name's state: free, or what is wrong with it (world:field-says-its-state).
- **The account sheet** shows the username and the character's name as two labelled rows, "Username" and "Character name", so neither is guesswork. The username's row carries "Change it" as a quiet link, and "Your first change is free" while it is. The change's own step holds the help line over the box, the box, its free or taken line, and Save.

**account:username-typed-and-checked** The username box starts empty, with no suggestion: the player types their own.

- **Checking while typing.** While the player types, the game asks the server whether the name is free and says so under the box. The check answers only free or taken, after the username's own format and word checks, and is rate-limited per address and per session. Taking the name at Begin is the check that counts.
- **In Settings**, the box that changes the username checks the same way while the player types, and saving is the check that counts there. The player's own current name answers neither free nor taken.
- Enter in the box is Begin.
- **Focus on opening.** Where the username box is the first field to fill on its screen (the door's Where you live on Play's path, the username's own step on the sign-in path, the invite page's sign-up), it takes the focus as the screen opens on a desktop, so the caret shows where to type, with its focus ring in view.
  - A desktop is a fine pointer that hovers, `(hover: hover) and (pointer: fine)`, read as the screen opens, never the layout's width: a narrow desktop window still focuses, a tablet does not.
  - On a touch phone, opening a screen moves no focus, on Android and iOS alike, since a focus raises the keyboard by itself on Android's browsers and covers the screen (on Where you live it hides the homes). The box stands out by its label and the words under it instead.
  - A sheet open over the screen keeps its own focus.
- **Focus on refusal.** A Begin, a Continue or a form's own submit refused for the name brings the box into view and focuses it on every device, with the reason under it: the player has just pressed a button, and the next thing is to fix that field.

**account:guest-floods-are-capped** Against floods of guests: the bot check runs before a guest life is created, and at most `account.guestsPerDevice` new guest lives may come from one device cookie and `account.guestsPerConnection` from one connection in `account.guestWindowHours` hours. Over that, the request is refused with `too-many`.

**account:idle-guests-cleaned-by-hand** Guest lives are never removed by a schedule. Each life keeps its last-played time.

- A tool run by hand, `pnpm guests:clean --idle-days <n>`, lists guest accounts with no play for the given days and, with `--apply`, removes them, through the same removal as deletion (account:deleted-data-removed-within-month). 90 days is the working number, one setting, `account.guestIdleDays`.
- `apps/server/README.md` says what it does and how to run it.
- Secured accounts are never removed by it.
- The privacy notice says it as it is: a guest life not played for 90 days may be removed, by hand from time to time and never on a schedule, so one may stay longer.

**account:person-kept-with-character** The person built at the door (prologue:front-door-builds-a-person), with its first name, its look, its colours and the archetype it started as, is kept with the character on the server. It is sent with `POST /api/character` and read back with the view, so a life signed in on another phone has its own name and face.

- The name is Latin letters with at most two marks on each, as Nigerian names are written (Adébáyọ̀), so no letter of another alphabet passes for one. It passes the username's checks (account:username-and-unconfirmed-email), and `reset-name` resets it as it resets the username (moderation:fixed-admin-actions).
- The look must be one the game ships.
- A ready life carries no name of its own: until the person is read, the band says "You".
- Other players see the account's username and the look, never the character's name (city:players-fill-the-crowd).
- The page's photo is not kept: each phone draws it again from the look and its colours.

**account:guest-reminded-to-secure** A guest sees a quiet reminder to secure the life, saying plainly that it lives only on this phone until secured. It is never a countdown and never a figure that is not real. It appears in three places:

- the "Not saved" chip over the world (account:guest-secures-the-life), which stands for as long as the life is a guest's and opens the keep-this-life sheet;
- a line on the settings sheet;
- a line on the month report after the first chapter.

`GET /api/account` carries `ways`, read-only (no token, no subject). Settings opens the account from one full row at its top, never from a small icon: the initial, the name, @username and the way kept in a few words ("Signed in with Google", or "Only on this phone. Save it to play anywhere."). The account sheet names the way with its address and the passkeys held, so the address is said there alone.

**account:play-starts-without-email** The emailed code is never on the way to starting play: creating a guest life sends no email. The load test (`load.md`) covers the code send at the target rate separately.

## Rules: the start screen, the two lights and the dedication page

**account:start-screen-over-live-city** Online, the first screen is the start screen over the live city. With the local authority there is no account and no start screen: the game opens at the door.

**What it holds**, from the top:

1. the two lights hanging over the scene (account:two-lights-and-wink-lines);
2. then, in the sheet, the game's lockup, small at its head;
3. the hook in two rows (text:hook-not-explanation);
4. the whole game in three steps, an icon and a word each, with a small arrow between: Hustle with the Jobs app's briefcase, Papers with the Papers app's folder, Fly with the Japa app's plane;
5. **Play**, with its small second line "Free · no sign-up";
6. under it, "Sign in", with its small second line "Carry on a saved life", for a secured account (Google, or a code by email, in the order and with the in-app browser rule of account:guest-secures-the-life). It is a full-width outlined button as tall as Play, never a text link, so the two read as two doors;
7. the two links, Terms of play and Privacy notice.

**A browser a kept life was open in.** The doors turn round: "Sign in" comes first as the main button, with its line "Carry on a saved life", and "Start a new life" is outlined under it. The hook and the three steps are unchanged. The mark is `japacity.account.kept` in the browser's storage, set whenever a secured account is read there (a life kept with Google, by a code or a passkey, or a kept life signed back in to). It holds no account data and is never cleared by the game, since a signed-out player is the one most likely to come back. A new player on a shared phone still has both doors.

**Inside an in-app browser** (account:guest-secures-the-life), one quiet line stands under the doors, never a blocker: "Opened inside an app? Your life lives in the browser you play in." with "Open in my browser". Play still works right there.

**Play's path.**

- The second line "Free · no sign-up" holds because of this rule, account:age-screen-refuses-minors and account:guest-and-secured-states: nothing is signed up for to start, the only question is the date of birth, and the guest is made unseen at Begin.
- Play leads to the age screen of account:age-screen-refuses-minors (a date of birth in three fields), then to the three-screen door (prologue:front-door-three-screens).
- The bot check runs unseen when Begin creates the guest life (account:bot-check-on-guest-creation).
- The username is typed on the page, with its rules (account:username-and-unconfirmed-email, account:username-typed-and-checked), never on a screen of its own.
- The guest line is said once on the page, in the words of account:guest-reminded-to-secure.

**Words and titles.** Nothing says Lagos in words: the scene behind says it. The start screen and the age screen carry no title over the figure.

**The lockup.** The game's lockup is the seal with two bulbs on a wire and the word (`apps/client/public/brand/japacity-lockup-<ground>.svg`).

- It sits small at the head of the start screen's sheet. It is drawn for the ground under it, following the paint the root carries: the light ground's by day and the dark ground's under the night paint.
- It sits once at the top, with air around it, on the account screens: the ways back in, the invite's page (pair:invite-link-single-use) and the full screen (server:signups-off-shows-full).
- The age screen and the keep-this-life sheet (account:guest-secures-the-life), whose title heads it, carry none.

**The live city behind.** Behind the start screen, the age screen and the ways back in stands the live city: the painted map of Lagos (decision 0026), settled over the family house in Surulere. It is shown where WebGL draws (`canDraw` from `shared/front-door/Gate`, asked once in `app/App.tsx`); where WebGL is missing, the look's picture stands in. The compound and the figure come back at the door.

**Layout.**

- On a desktop (the door's desk, prologue:front-door-three-screens: at least `tuning.city.desktopMinWidth` CSS pixels wide and 640 tall), the sheet of the start screen, the age screen, the ways back in and the full screen docks to the left as a card 460 px wide (the door's panel's width) at the window's foot (`SheetDock`, `shared/ui/look/SheetColumn`). The middle of the city, where the map is settled over Surulere, stands clear to its right.
- On a screen wider than a phone that is not a desk, it stands centred in the door's column of at most 600 px, with the scene filling the window around it.
- On a phone the column is the screen.

**Focus.** A move between the start screen, the age screen and the ways back in takes the focus to the new screen's heading. The screen the gate opens on keeps the page's own focus. On a desktop, a screen whose first field to fill took the focus as it opened keeps it there instead (account:username-typed-and-checked, account:code-form-forgives). A notice the last screen left is said through one polite live region mounted before its words.

**account:two-lights-and-wink-lines** The two lights and the lines with a wink.

**Lines with a wink.**

- A place that carries a line with a wink has two or three lines at most, each kept in content. One is picked at random once per visit, drawn on the device, so a reload may show another.
- The pick never comes from the player's data or from anything a player could put in the address. A dev build alone has a hook that fixes the pick, for pictures.
- No wink on bad news, a refusal, grief or money lost: those are said plainly (text:bad-news-never-joked). The lines leave room for those who stay.
- The start screen's three, verbatim, two rows each: "Last one out, / off the light.", "Not going? / Keep the light on." (the stayer's answer), "Japa is not by force. / How ready are you?".

**The two lights** hang over the start screen from the top edge: one bulb for the lives at home and one for the lives abroad, on one wire.

- Each glows with its share. Home is never drawn under 30% of the light (new lives start there, and some stay by choice).
- Sparks run along the wire toward abroad, and now and then one runs back.
- HOME and ABROAD with their counts, "Everyone playing, now" under them, and a dusk across the top so the glows read in daylight.
- It is a picture of everyone, never a task: nothing in it can be tapped, switched or paid, and nothing rewards it, so a line about the light is a caption, never an errand.
- The glows breathe slowly and flicker as a spark reaches them, moved by transform and opacity alone with no render loop. Reduced motion holds them still and draws no sparks (world:motions-under-half-second).

**The counts** are public and name no one.

- `GET /api/lights` answers `{ ok, home, abroad, back }`: the whole game's, never a region's, each rounded to the nearest ten, made from the stored totals of analytics:nightly-game-counters alone.
- HOME and ABROAD are lives being played, not lives ever started. A nightly job on the 00:00 UTC cron, beside the other nightly jobs (`apps/server/src/scheduled/lives.ts`), reads every character in the characters store a page at a time. It counts each whose life has not ended (turn:finish-ends-the-life) and whose account still exists and still names it (account:one-character-per-account), by where it stands, as the `lives/playing` of analytics:nightly-game-counters for the day just ended. It keeps, returns and logs no character or account, only counts.
- `GET /api/lights` reads home and abroad from the whole game's rows of the last day counted. Back is the `place/returned` of this UTC month.
- A life on the road counts at home, since the road is no departure (road:road-route-has-no-figure: no `japa/departed`, never named) and the place rule has two places (place:new-character-at-home). The count keeps the road under its own key, so moving it is one line.
- While no nightly run has counted, figures made from the other totals stand in, and the reply has the same shape and says nothing different: abroad is every `japa/departed` less every `place/returned`, and home is every `lives/started` less those abroad.
- The route reads no session, and nothing of the asker enters the reply, the cache key or a log line. It counts against the address limit (server:anonymous-limit-by-address) and is kept in the server's cache by the hour and public to the browser until the hour ends (server:public-replies-cached).
- With no answer, the city's own people stand in: the crowds content gives every place at home and every place abroad (city:residents-fill-to-target), with no caption that calls them players.

**account:dedication-page-and-its-doors** The dedication page is a full screen.

- **Its doors.** It is reached from the lantern canoe on the map (world:lantern-canoe-on-map) and from the five taps on Settings' version line (city:credits-screen-attributions), and from nowhere else. It is never reached from the start screen, which keeps the two lights of account:two-lights-and-wink-lines alone.
- **The picture.** Night over the lagoon, with strings of small lights held up by canoes. The dedication's light is large on the top string with "soksonjr" under it (exactly so, lower case). The lit lights of account:name-a-light-for-yours hang along the strings, each whose name is approved carrying its name, the rest bare.
  - The lights fill the two strings under the dedication's light first, then the strings over the water, then its own string.
  - On the strings a named light takes every other place, with a bare one between, and every other name sits a little lower, so two names are never neighbours.
  - Glow layers only for the dedication's light, the account's own and the named ones.
- **The head.** At the top, the number of lights and "on the water tonight": the true count, never rounded; the singular is "1 light". The count and the close stand still at the head of the page, the count on the sky's own colour, so they stay in view while the form is filled and the page rises over the keyboard.
- **The foot.** One line, "For Osoko Emmanuel, 1998 to 2026. From Al-Ameen.", kept in content beside the dedication line of city:credits-screen-attributions (`DEDICATION_SHORT`, never retyped in code), then "Sun re o.". Then either the one button "Light one for yours" when the account has no light (disabled while the water is being read), or the account's own light named on the string with its line (account:name-a-light-for-yours).
- **Loading.** The page loads in its own chunk on first opening (engine:first-download-has-budget) and reads `GET /api/dedication/lights` (server:dedication-routes) as it opens. Offline, or when the read fails, it shows the dedication's light, the strings bare, no count, and the button closed with "The water is out of reach right now."
- **On a phone** at most 240 lights are drawn: the top strings as bulbs and the rest as dots receding into the dark, every glow by opacity alone and still under reduced motion (world:motions-under-half-second). The count says the true number whatever is drawn.
- The picture's colours are literal, like the two lights' and the paper map's (world:colours-are-role-tokens).
- It is never counted (analytics:client-sends-interface-counts lists no key for it).

**account:name-a-light-for-yours** Light one for yours. The page's button names the unlit light beside the dedication's, in place and with no sheet. While naming, that light is labelled "yours".

- **The form.**
  - "Who is it for?": a name of at most four words and forty characters.
  - "Years, if you want": a first year and a last, each 1900 to the current year, the last never before the first, either one alone allowed.
  - Each is its own box with the label inside the box above the value (no fieldset or legend, which Safari draws across the border).
  - The hint under the boxes: "Four words at most. Its name shows to everyone once it has been looked over."
  - "Light it", which waits for a name.
- **One check for both sides.** The limits live in one pure function shared by the client and the server (`packages/content/src/about/about.light.ts`, `checkLight`), and the server refuses what the client refuses. "A name first." is the server's `name-empty` said back; a `bad-light` refusal shows its problem; no answer shows the out-of-reach line.
- **Lighting.** "Light it" sends `PUT /api/dedication/light`. The light is kept with the account, guest or secured: it moves with the account when secured (account:guest-secures-the-life) and goes with the account's deletion. One per account: a second `PUT` replaces it and clears its approval.
- **After lighting.** The account's own light hangs on the page's top string beside the dedication's, with its name and years under it, for that account alone. Under the foot: "Yours is on the water. Its name shows to everyone once it has been looked over." Under that line, "Put it out" is a quiet button, always shown, never offered on a tap. It sends `DELETE /api/dedication/light`, removes the light and brings the button back.
- **What others see.** Every other account sees the light at once, bare, in the count and on the strings, and sees its name only once it is approved (moderation:dedication-lights-await-approval). A refused name puts the light out, and the account may light again. A name reaches other players only through that approval and is typed nowhere else, which is why it is not contact between players under region:no-stranger-matching.
- The page's words live with the start screen's words (text:jokes-keep-a-plain-version) and name no real person but the friend the game is dedicated to.
- The privacy notice says the name and years a player types are kept with the account and shown to other players once looked over.
- No light is kept on the device alone.

## Rules: who may sign up

**account:same-contact-for-everyone** Every account has the same contact with other players, wherever it signed up, as region:same-contact-everywhere sets it. There is no table of regions and no setting per country.

**account:country-comes-from-cloudflare** A request's country is the one Cloudflare gives it (`request.cf.country`, the same as the `CF-IPCountry` header). The country at sign-up is stored on the account as given, `XX` when Cloudflare gives none (`T1` is Tor). It is used to count play by country (`analytics.md`) and to choose the advert region (advert:campaign-chosen-without-player-data). It decides nothing a player may do.

**account:sign-up-open-everywhere** Sign-up is open from every country: the age screen, its standing and the guest start answer a request the same wherever it comes from.

**account:age-screen-refuses-minors** The age screen comes before the username and the guest life (there is no sign-in method at the door). It asks for a date of birth, with no date filled in and no hint of the age needed.

- Under 18 is refused, and a cookie that lasts 30 days makes the screen refuse that browser again without asking.
- Under its fields one quiet line, "Already have a life here? Sign in.", leads to the ways back in with nothing sent, so a returning player who tapped Play by habit turns back before any life is made. The refusal carries no such line.
- The account stores that the screen was passed, its date and the method `declared`, never the date of birth itself: less data kept is less to protect.
- While the pass holds, `GET /api/age` reports it passed, so a reload or Back before Begin returns to the door's step without asking again.

**account:bot-check-on-guest-creation** A bot check runs once, when a guest life (and so the account) is created.

- **The check.** The client sends a Cloudflare Turnstile token. The server checks it with Turnstile's verify endpoint before the account exists. A failed or reused token makes no account.
- **Host.** A pass is accepted only when Turnstile's `hostname` is SITE_URL's host, so a token solved on another site is refused.
- **Action.** Following Turnstile's server-side validation guidance, the widget is rendered with the action `guest`, and a pass that is not a test key's is accepted only when the verify answer's `action` is `guest` (refused `action-mismatch`).
- **Test keys.** Tests use Turnstile's published test keys, which pass or fail by design, and the dummy token they accept. A test key's pass names no action and is judged by its host alone. On the local stack (server:production-and-staging), a pass whose verify answer carries `metadata.result_with_testing_key` set to true (which Cloudflare always reports as solved on `example.com`) is accepted only when SITE_URL's host is `localhost` or `127.0.0.1`. On every other host the reported host must match.
- **Bad input.** A token longer than 2048 characters, the longest Turnstile issues, is refused `token-too-long` before any call. A verify answer that is not a JSON object fails closed as `bad-reply`.
- **Signing in again** needs no bot check of its own beyond the one on every code sent (account:bot-check-on-code-send).
- **When the check gives no pass**, Begin says why in its own words, never a bare "try again":
  - a script that could not load: "The quick check could not load. Check your connection, or turn off any blocker for this page, then tap Begin again." It is loaded again on the next Begin, which waits for it;
  - a widget that errs in the browser (Turnstile's `error-callback`) is told to reload or try another browser;
  - when Cloudflare needs a tap, the widget is scrolled into view (`before-interactive-callback`).
- **Cookies not kept.** An age answer or a guest session found gone a second time in a row, or a browser with cookies off, is told "This browser is not keeping the game's sign-in. Private browsing or blocked cookies can do this. Open Japacity in Chrome or Safari, or allow cookies for this site." The first time, the age screen says only that the answer ran out.

**account:bot-check-on-code-send** Every code sent to an email address passes the same unseen bot check first, wherever the send is asked: the ways back in, the keep-this-life sheet, the start of a life kept by the code (a proof run out or an address taken, account:sign-in-without-secret), the deletion's confirmation (account:player-deletes-account) and any other form that sends a code. All of them go through `POST /api/auth/email-otp/send-verification-otp`.

- The form holds a Turnstile widget rendered unseen with the action `code`. The send carries its token in the same header the guest start's goes in.
- The server checks it as account:bot-check-on-guest-creation checks the guest start's (the host, the test keys on a local SITE_URL only, the longest token, a reply that is not a JSON object), with `code` as the action a pass must name.
- The check runs before the send is counted against the address's limits (account:sign-in-routes-rate-limited) and before any code is made, so a send with no pass mails nothing and spends none of the address's sends.
- It is refused `bot-check` (403), and the form says why in its own words:
  - "The quick check did not go through. Wait a moment, then send the code again.";
  - a script that could not load: "The quick check could not load. Check your connection, or turn off any blocker for this page, then send the code again.", and it is loaded again on the next send;
  - a widget that errs in the browser: "The quick check did not work in this browser. Reload the page and send the code again, or try another browser."
- A token is good once, so the widget is reset after every send that carried one.

**account:sign-in-routes-rate-limited** Sign-in routes are rate limited by the auth library, with its store in the database, not in memory, so the limit holds across isolates:

- at most `auth.limits.otpSendPer60s` code sends per address and per email in 60 seconds;
- at most `auth.limits.otpSendPerDay` (10) per email in a day, so one address cannot be flooded with codes;
- at most 3 code checks per 10 seconds per address.

The email codes have their own load test (`tools/load/codes.ts`), with Google sign-in as the main path.

**The mail.** The provider is Cloudflare Email Service (decision 0007).

- The codes and the notices leave through one seam (`apps/server/src/mail/mail.ts`), which tries in order:
  1. with `MAIL_TRANSPORT=mailpit`, which only the local stack sets (server:production-and-staging), each mail is posted to Mailpit's HTTP send API on this machine, its subject and body from content's words, and refused when Mailpit's address is not on this machine;
  2. otherwise the binding, when it is bound;
  3. otherwise the seam refuses every send, so a deployment without the binding sends nothing.
- Production and staging each bind the provider as `MAIL`, a `send_email` binding in `apps/server/wrangler.jsonc` allowed one sender only: the game's `game@mail.japacity.app` (display name Japacity) on the sending subdomain `mail.japacity.app`. It is kept in one constant (`SENDER` in the seam), which a test holds equal to the binding's list.
- Every mail carries `Reply-To: hello@japacity.app`, a monitored inbox, since the sending subdomain has none (`REPLY_TO` beside `SENDER`).
- Every mail has a text part and a plain HTML part saying the same.
- A send the binding refuses rejects with the binding's error code alone, never its message, the address or the code (server:secrets-stay-on-server). The auth library logs that rejection and the route answers as it would, since its reply never waits on the send (account:email-code-is-short-lived).
- The binding needs no secret.
- Workers Paid includes 3,000 sends a month, then a charge per thousand. A new account starts on a small daily quota that grows with good sending. A mail is at most 5 MiB and 50 recipients.

## Rules: one character, a new life and deletion

**account:one-character-per-account** One account holds one character at a time. A new one is made only after the old is ended by account:start-a-new-life; a second while one lives is refused `one-character`.

**account:start-a-new-life** Settings holds "Start a new life".

- One sheet names the character and their age and says plainly that this life ends and cannot be brought back. Cancel is the easy choice; the ending button is held to confirm (no typing).
- On confirming, the life ends:
  - locally, the save is cleared and the kept person with it;
  - online, the account's character is ended by its own route. The life's rows are retired as a deletion's are (account:deletion-keeps-anonymous-totals). The account itself stays, with its age pass and its ways in. A real sibling or partner joined to the old life is told in the game's words (`people/ended` with its own `why`, `restart`), and their slot returns to a computer character.
- Then the front door opens, filled in as onboarding is except for the name, whose box starts empty, with its suggestion online from the account's username as prologue:front-door-builds-a-person says.
- No family member or invite is needed.
- The family draw is the new life's own roll (prologue:tile-path-open-from-start retries seeds for the tile), never kept from the old one.
- Online, a guest's restart makes the new life under the same guest account with the same username (the rename rule of account:username-and-unconfirmed-email is untouched). The bot check is not asked again.

**account:player-deletes-account** A player deletes the account from the settings, confirming with a session signed in within the last 10 minutes or a fresh email code.

- **Passkeys.** Signing in again to confirm offers a passkey only where the account holds one, and only one of the account's own passkeys confirms: the phone's answer is checked against the account's passkeys before it is sent, so another account's passkey on the same phone opens no session and deletes nothing.
- **At once:** every session ends, the character leaves every place and pair (the other player is told only that they left), and the account can no longer sign in.
- **The confirmation.** Its Delete wears the warning colour, and the main button keeps the account.
  - It shows one way first: a passkey where the account holds one and one works here, else the code to the account's email. The other ways stand under it as quiet links ("Use a code instead", "Use Google instead", "Use a passkey instead").
  - Google is offered only when Google is linked. After a Google sign-in to confirm, the player lands back on the confirmation. The line about coming back within 10 minutes shows only once Google is picked.
  - The button that deletes by a passkey or by the code wears the warning colour too.
- **A guest.** A guest's sheet holds "Delete my account" as its one costly row, in place of both Sign out and Delete. Its step says that this life lives only on this phone, so deleting it ends it here and nothing of it is saved. It offers "Save this life first" as the main button, and, apart from it, "Delete for good" in the warning colour. That deletes the guest as a saved life's deletion does, confirmed by its own session, with the deleted notice.

**account:deleted-data-removed-within-month** Within 30 days of the confirmation, and never later than one month, the server removes:

- the account and its methods (Google link, passkeys, email);
- sessions;
- the character row, every save segment, snapshot and log row, and the turn clock;
- its messages on both sides (`../design/04-where-things-live.md` section 4);
- its rate-limit rows;
- its country and age records;
- its ledger marks;
- the audit table's rows for every character the account had (a life's own when it ends, the last one's at the deletion).

Only the admin log and the switch log are kept.

**account:deletion-keeps-anonymous-totals** Deletion keeps only what names no one:

- the day totals of the money report;
- a lottery draw's ticket count and its published list of anonymous ticket tokens (lottery:fingerprint-commits-secret);
- an audit row holding a one-way hash of the account id and the date of deletion, so a second request can be answered.

**account:backups-never-restore-deleted** Backups are put beyond use: no restore brings a deleted account back into play, and a restore re-runs every deletion recorded in the audit rows since the backup was taken. The restore window is up to 7 days. The privacy notice says how long the provider keeps backups, and says the restore window.

**account:only-needed-data-kept** The account keeps only what sign-in and these rules need: the email address where one is used, the Google subject id and email where Google is used, passkey public keys, the sign-up country, the age record of account:age-screen-refuses-minors, and the created date. No name, phone number, address or photo is asked for.

## Numbers

| Setting | Value | Source | In config as |
|---|---|---|---|
| Least age | 18 | concept section 16 | `account.minAge` |
| Refusal cookie | 30 days | working value; the research asks for a cookie, with no length | `account.refusedCookieDays` |
| Email code | 6 digits, 5 minutes, 3 tries | the auth library's defaults | `auth.otp` |
| Code sends | 3 per address and per email in 60 seconds; 10 per email in a day | working values | `auth.limits.otpSendPer60s`, `auth.limits.otpSendPerDay` |
| Code checks | 3 per 10 seconds per address | the auth library's own rule for sign-in routes | `auth.limits` |
| Fresh session for deletion | 10 minutes | working value; the library's default freshness is 1 day | `account.deleteFreshMs` |
| Deletion completes within | 30 days | working value | `account.deleteWithinDays` |
| Turnstile token | single use, valid 300 seconds | Cloudflare | |
| Characters per account | 1 | account:one-character-per-account | `account.maxCharacters` |
| Text message to Nigeria | $0.22 to $0.39 a message | `../design/04-where-things-live.md` section 5 | not used |

## Sources

All read on 8 Oct 2026.

- [Better Auth: email OTP](https://better-auth.com/docs/plugins/email-otp): 6 digits, 300 seconds, 3 attempts by default; do not await the send; `storeOTP: "hashed"` keeps only a code's hash.
- [Better Auth: passkey](https://better-auth.com/docs/plugins/passkey): the `@better-auth/passkey` package.
- [Better Auth: Google](https://better-auth.com/docs/authentication/google)
- [Better Auth: email and password](https://better-auth.com/docs/authentication/email-password.md): off unless `emailAndPassword.enabled` is set.
- [Better Auth: captcha](https://better-auth.com/docs/plugins/captcha): Cloudflare Turnstile is supported; the token goes in the `x-captcha-response` header; the endpoints list is set per deployment.
- [Better Auth: rate limit](https://better-auth.com/docs/concepts/rate-limit): 100 in 10 seconds by default, 3 in 10 seconds on sign-in routes, a `database` store, `cf-connecting-ip` as the address header.
- [Better Auth: users and accounts](https://better-auth.com/docs/concepts/users-accounts): `deleteUser`, its verification email, `beforeDelete` and `afterDelete`, fresh sessions.
- [Better Auth: test utilities](https://better-auth.com/docs/plugins/test-utils): `testUtils`, `login`.
- [Cloudflare: HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/): `CF-IPCountry`, with `XX` for unknown and `T1` for Tor.
- [Cloudflare: Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/): test site keys and secret keys, and the dummy token.
- [Cloudflare: Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/): a token is valid for 300 seconds and can be validated once.
- [Cloudflare: Turnstile plans](https://developers.cloudflare.com/turnstile/plans/): free, unlimited challenges.

## Not verified

- Email delivery to Nigerian mailboxes for any provider.

## Contract

The contract touches nothing in the simulation. This page rests on:

1. `packages/store/src/types.ts`: `AccountStore` and its `AccountRow`, the account's own row beside the auth library's tables (its id, country, age record, created date, character, settings, state, username and last play).
2. `packages/store/src/types.ts`: `DeletionStore` with `request`, `due`, `complete` and `find`, and the audit row `DeletionRow` (`account`, `accountHash`, `requestedAt`, `dueAt`, `completedAt`).
3. The server config (`apps/server/src/config.ts`): `account` (`minAge`, `refusedCookieDays`, `deleteFreshMs`, `deleteWithinDays`, `maxCharacters`, `renameDays`, and the guest settings `guestsPerDevice`, `guestsPerConnection`, `guestWindowHours` and `guestIdleDays`) and `auth` (`otp`, `limits`).
4. `packages/api`: the code `one-character` in `ServerCode` (`server.md`, Contract).
