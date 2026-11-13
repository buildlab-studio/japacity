# Share cards and the official accounts page

> Rests on `../design/06-assets-and-visuals.md` sections 8 (the japacity card) and 9 (rules for AI-made media), `text.md` ("Money on screen"), chapter:send-off-card-on-close (the send-off card), road:road-earns-nothing, road:real-story-card-after-chain and luck:big-wins-are-staged.
> Kind: `share`. The simulation decides when a card is due and what is on it; the client draws it. The invite card belongs to `pair.md` and also follows share:card-carries-no-money, share:card-never-looks-official, share:card-art-shows-no-face and share:card-shows-only-own-character.

A share card is a picture a player sends to friends at a moment worth telling: a chapter done, a visa granted, the send-off. Most people first hear of the game through these cards, so a card must never be mistaken for anything real.

## When a card is due

**share:cards-due-at-set-moments** A card is due at these moments and no others:

- a chapter closes (`chapter.md`);
- a visa is granted (route:grant-moves-to-granted);
- the send-off (chapter:send-off-card-on-close);
- the first pay abroad;
- a status is secured;
- the December visit;
- a Friday draw win (`lottery.md`);
- the end of the road chain: the real-story card (road:real-story-card-after-chain), whose `kind` is `lost` when the chain ended lost.

The view's `card` carries the moment as `kind`. The send-off card comes with a ticket stub beside it, and the player picks which to share. Once the japa type is read (decision 0024), the stub carries the type's badge. Neither the stub nor the badge is a `kind` of its own. When a moment card has already told a chapter's outcome, that chapter's card is kept in the gallery and does not open (moment:card-shows-when-outcome-lands).

**share:no-card-for-harm** No card is due for anything on the road chain except the real-story card (road:road-earns-nothing), for a refusal, for a removal, or for a return marked `assisted` or `removed`. A road chain that ended lost shows its real-story card as `lost`, which is shown and never shared (`shareable` false in the client's card face). A card never celebrates harm.

**share:card-offered-never-sent** A card is offered, never sent. The player presses share; nothing is posted for them. Nothing asks them to share to earn anything, and no reward is ever tied to sharing: the same rule as invites (`../design/01-concept.md` section 6, safety rule 6).

## What is on a card

**share:card-contents** A card shows:

- the moment's title, from content;
- the character's name (the view's `card.name` is null, because the simulation holds no words; the client reads the name given at the door);
- the japacity figure and the route name, where the moment has them;
- the months played;
- the chapter's artwork;
- the game's name as the sender, and the game's address;
- the words "Japacity is a game", in plain sight and no smaller than the address.

The stub shows FROM, TO, MONTHS and JAPACITY in the game's drawn hand, and the type badge (its heading, the type's name and its one line) once the type is read. The name on the card and on the stub, both on screen and in the image that travels, is the character's name as the band shows it: the name given at the door, kept with the character (account:person-kept-with-character). The card's share button, the screenshot hint and Close sit together at the foot on a ground of their own. The card, its picker and that foot scroll within the screen's height.

**share:card-carries-no-money** A card carries no sum of money in any currency. A sum on a picture is the part a scammer crops and reposts as proof, and `text.md` bars the bank-alert look. The lottery card says "won the Friday draw" and gives no figure.

**share:card-never-looks-official** A card never looks like a bank alert, a transfer receipt, a payment app, a visa, or a letter from any government or university. It carries no logos, no crests, no reference numbers, no barcodes, no green tick beside a figure and no real institution's name. Every share picture carries three marks, so nothing passes for proof:

1. a faint watermark of the game's name across the background;
2. a diagonal corner badge with the game's name at a top corner;
3. the branding with the address at the foot.

The marks never cover the words. The game's own seal is a fourth mark that says it is a game: it is drawn on every card, its link preview and its stub. It is the one logo a card carries, and never an institution's.

**share:card-art-shows-no-face** The art is built only from the game's own approved artwork: the chapter's background, the city, objects, and the character seen from behind or in silhouette. A card never shows a face, and never a generated face (`../design/06-assets-and-visuals.md` sections 8 and 9). A person has approved every image a card is built from.

**share:card-shows-only-own-character** A card shows only the player's own character: no other player and no display name.

## Card size and sharing

**share:card-drawn-on-device** The client draws the card on a canvas at `tuning.share.width` by `tuning.share.height` (portrait, the shape of a messaging app's status) and encodes it as a JPEG under `tuning.share.maxBytes`. It shares the file through the Web Share API when `navigator.canShare` accepts it, and offers a download when it does not. Sharing needs a tap, because the API requires one. The ticket stub is landscape, the shape of a ticket; the other cards keep the status shape. The marks of share:card-never-looks-official are drawn on before encoding, and the size limit holds with them.

**share:card-link-has-fixed-preview** The card's text also travels as a link to the game's address with a `?card=<kind>` parameter. That page's link preview image is a fixed picture for that kind: `tuning.share.previewWidth` by `tuning.share.previewHeight`, under `tuning.share.previewMaxBytes`, made once and approved, never drawn per player. No server draws images, so no player's data reaches a preview, and the preview stays under the size messaging apps are reported to need. The previews are drawn by `tools/share/draw-previews.ts` (one command, `pnpm exec tsx tools/share/draw-previews.ts`, which also writes the assets register's bytes). They count as approved once a person has approved them.

**share:card-never-stored** The card is built from the view alone and is never stored on the server. The `?card=` link carries the kind and nothing about the player.

## The official accounts page

**share:official-accounts-page** The game has one page, at `/official`, that lists every official account and address: the web address (`japacity.app`), the game's email (`social@japacity.app`), and each social and messaging account the game holds. Every account listed is claimed. Claiming the name on each platform, and the domain, is the operator's job outside the repository. The default list is below.

**share:official-page-warns-plainly** The page also says plainly that the game never asks a player for money, never sells months to play, never messages first about a prize, never sells an advert by direct message, and has no agents. It gives the address for reporting an account that pretends to be the game.

**share:everything-links-to-official** Every card, the terms, the privacy notice and the guides link to `/official`. Nothing else in the game names an outside account.

**share:send-off-card-kept** Where the send-off card is kept (chapter:send-off-scene-in-beats, beat 6). The send-off card of chapter:send-off-card-on-close has no screen of its own:

- During the first ride abroad, the chip "Send-off card saved" shows with a tick.
- From then until the end of the first month abroad, a tile among the notices on the phone's home reads "Your send-off card is ready" with Open the card. The tile goes when the first month abroad ends.
- Open the card, and the share of share:card-drawn-on-device, work as for any card. The card's data and the marks of share:card-never-looks-official are those of any card.

The ticket stub keeps its landscape shape and carries the seat the counter gave (beat 2). The card is kept with the seat once the first ride says it is saved, or at once when no scene shows (a life reopened after the flight). The seat appears as words under the destination, "By the window" or "On the aisle" (`share.stub.seat.*`), on the screen's stub and on the drawn one, never as a seat number or letter (share:card-never-looks-official). On screen, each field of the stub grows to fit its longest word, so a place name wraps between words.

## Entries: the official accounts (the default list)

| Platform | Why |
|---|---|
| The web domain, and the same name with the likely misspellings pointing to it | Where the game lives |
| An email on that domain, `social@japacity.app` (receive only) | Reports, appeals, advertiser contact |
| WhatsApp channel | Where the cards are shared most |
| Instagram, TikTok, X, YouTube, Facebook page | Where clips and cards spread; claimed even if unused, so nobody else holds the name |
| The code repository | The open source home |

## Numbers

| Setting | Value | Source | In content as |
|---|---|---|---|
| Card size | 1080 x 1920 px | working value: the common full-screen phone status size; no official messaging app figure found | `tuning.share.width`, `tuning.share.height` |
| Card file | under 150 KB, JPEG | `../design/06-assets-and-visuals.md` section 8 (about 150 KB) | `tuning.share.maxBytes` = 153600 |
| Link preview | 1200 x 630 px, 1.91 to 1 | the Open Graph size large platforms recommend (Wix guidance) | `tuning.share.previewWidth`, `previewHeight` |
| Link preview file | under 300 KB | reported for the main messaging app by Wix and Branch; not officially documented | `tuning.share.previewMaxBytes` = 300000 |

## Sources

All read 8 Oct 2026.

- [MDN: `Navigator.share()` (files, `canShare`, secure context, a user gesture)](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
- [The Open Graph protocol](https://ogp.me/)
- [Wix: recommended og:image size (1200 x 630; previews in the messaging app need under 300 KB)](https://support.wix.com/en/article/wix-editor-recommended-ogimage-size)
- [Branch: why some link thumbnails do not show in the messaging app (about 300 KB)](https://help.branch.io/faq/docs/why-are-some-quick-link-thumbnails-not-shown-in-whatsapp)
- [EU AI Act, Regulation 2024/1689, article 50 (disclosure of generated images that resemble real people, applying from 2 Aug 2026)](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)

## Not verified

- The messaging app publishes no limit for link preview images; 300 KB comes from vendors' observations.
- Which phone browsers accept an image file in the Web Share API; MDN marks the feature as not yet available everywhere. The download fallback covers the rest.

## Contract

- View field: `card` is `{ kind: "chapter" | "granted" | "send-off" | "first-pay-abroad" | "secured" | "december" | "draw-win" | "real-story" | "lost"; chapter: Id<"chapter"> | null; route: Id<"route"> | null; percent: number | null; months: number; standing: number; topActivities: Id<"activity">[]; name: string | null } | null`. The simulation sets the kind and says when a card is due, the send-off and the road included. The client's card face (`apps/client/src/shared/share/face.ts`) adds `shareable` (share:no-card-for-harm).
- Content: text keys `share.<kind>.title` and `share.disclaimer` ("Japacity is a game."), and an art id per chapter and per kind, `share.<kind>.art`, pointing at the assets register.
- Tuning: `tuning.share = { width; height; maxBytes; previewWidth; previewHeight; previewMaxBytes }`.
- Static files: one approved preview image per kind, `/share/<kind>.jpg` (in `apps/client/public/share/`), and the `/official` page.
