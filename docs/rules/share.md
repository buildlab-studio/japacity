# Share cards and the official accounts page

> Rests on `../design/06-assets-and-visuals.md` sections 8 (the japacity card) and 9 (rules for AI-made media), `text.md` ("Money on screen"), chapter:send-off-card-on-close (the send-off card), road:road-earns-nothing and road:real-story-card-after-chain, luck:big-wins-are-staged.
> Kind: `share`. The simulation says when a card is due and what is on it; the client draws it. The invite card is `pair.md`'s and follows share:card-carries-no-money, share:card-never-looks-official, share:card-art-shows-no-face and share:card-shows-only-own-character too.

A share card is a picture a player sends to friends at a moment worth telling: a chapter done, a visa granted, the send-off. It is how most people first hear of the game, so it must never be mistaken for anything real.

## Rules: when a card is due

**share:cards-due-at-set-moments** A card is due at these moments, and only these: a chapter closes (`chapter.md`), a visa is granted (route:grant-moves-to-granted), the send-off (chapter:send-off-card-on-close), the first pay abroad, a status secured, the December visit, a Friday draw win (`lottery.md`), and the end of the road chain (the real-story card, road:real-story-card-after-chain). The view's `card` carries the moment as `kind`. Also due: the send-off's ticket stub beside the send-off card, and the japa type once it is read (decision 0024). A chapter's card that its moment card already told is kept in the gallery and does not open (moment:card-shows-when-outcome-lands).

**share:no-card-for-harm** No card is due for anything on the road chain except the real-story card (road:road-earns-nothing), for a refusal, a removal or a return marked `assisted` or `removed`, or for a life that ended `lost`. A card never celebrates harm.

**share:card-offered-never-sent** A card is offered, never sent. The player presses share; nothing is posted for them, and nothing asks them to share to earn anything. No reward is ever tied to sharing, the same rule as invites (`../design/01-concept.md` section 6, safety rule 6).

## Rules: what is on a card

**share:card-contents** A card shows: the moment's title from content, the character's name (the view's `card.name` is null, since the simulation holds no words: the client reads the scenario's `share.first-name` key where the name below is missing), the japacity figure and route name where the moment has them, months played, the chapter's artwork, the game's name as the sender, the game's address, and the words "Japacity is a game" in plain sight at a size no smaller than the address. The stub shows FROM, TO, MONTHS and JAPACITY with the type badge in the game's drawn hand; the type card the type's name and its one line; Wrapped the months, the route, the figure, the type and one line a card; a stamp its number and name; the scrapbook page the data page with its stamps (the page carries no stamp until a visa is granted; the visa's is the first, round and red; steps after it, the flight, the landing, a status secured, may stamp beneath it; nothing before it does; the scrapbook keeps its own look, and only the in-game page takes the document layout); the weekly tiles the world's result as drawn tiles and never a player's name; "Started as" the tile picked. The name on a card and its stub, on screen and in the image that travels, is the character's name as the band says it: the name given at the door, else the first word of the life's own name ("Adaeze"), never a shorter name the band does not use; the card's share, the screenshot's hint and Close stand together on a ground of their own at the foot, and the card, its picker and that foot scroll within the screen's height.

**share:card-carries-no-money** A card carries no sum of money in any currency. A sum on a picture is the part a scammer crops and reposts as proof, and `text.md` already bars the bank-alert look; the lottery card says "won the Friday draw" and no figure.

**share:card-never-looks-official** A card never looks like a bank alert, a transfer receipt, a payment app, a visa or a letter from any government or university: no logos, no crests, no reference numbers, no barcodes, no green tick beside a figure, no real institution's name. Every share picture carries three marks so nothing passes for proof: a faint watermark of the game's name across the background, a diagonal corner badge at a top corner with the game's name, and the branding with the address at the foot; the marks never cover the words. The game's own seal is drawn on every card, its link preview and its stub as a fourth mark that says it is a game; it is the one logo a card carries and never an institution's.

**share:card-art-shows-no-face** The art is composed from the game's own approved artwork: the chapter's background, the city, objects, and the character seen from behind or in silhouette. A card never shows a face, and never a generated face (`../design/06-assets-and-visuals.md` sections 8 and 9). A person approved every image a card is built from.

**share:card-shows-only-own-character** A card shows no other player and no display name, only the player's own character.

## Rules: size and how it travels

**share:card-drawn-on-device** The client draws the card on a canvas at `tuning.share.width` by `tuning.share.height` (portrait, the shape of a messaging app's status), encodes it as JPEG under `tuning.share.maxBytes`, and shares the file through the Web Share API when `navigator.canShare` accepts it, or offers a download when it does not. Sharing needs a tap: the API requires one. The ticket stub is landscape, a ticket's shape; the other cards keep the status shape; the marks of share:card-never-looks-official are drawn on before encoding and the limit holds with them.

**share:card-link-has-fixed-preview** The card's text also travels as a link to the game's address with a `?card=<kind>` parameter. That page's link preview image is a fixed picture for that kind, `tuning.share.previewWidth` by `tuning.share.previewHeight`, under `tuning.share.previewMaxBytes`, made once and approved, never drawn per player. No server draws images, so no player's data reaches a preview, and the preview stays under the size messaging apps are reported to need. The previews are drawn by the script kept in the repository, `tools/share/draw-previews.ts` (one command, which also writes the register's bytes), and count as approved once a person has approved them.

**share:card-never-stored** The card is built from the view alone and is never stored on the server. The `?card=` link carries the kind and nothing about the player.

## Rules: the official accounts page

**share:official-accounts-page** The game has one page, at `/official`, listing every official account and address: the web address (`japacity.app`), the game's email (`social@japacity.app`), and each social and messaging account the game holds. Every account on it is claimed. Claiming the name on each platform and the domain is the operator's, outside the repository; the default list is below.

**share:official-page-warns-plainly** The page also says plainly: the game never asks a player for money, never sells months to play, never messages first about a prize, never sells an advert by direct message, and has no agents. It gives the address to report an account pretending to be the game.

**share:everything-links-to-official** Every card, the terms, the privacy notice and the guides link to `/official`. Nothing else in the game names an outside account.

**share:send-off-card-kept** The keepsake's place (chapter:send-off-scene-in-beats beat 6). The send-off card of chapter:send-off-card-on-close is not a screen of its own: during the first ride abroad the chip "Send-off card saved" shows with a tick, and from then until the card's time ends (the first month abroad) the card is reached from a tile among the notices on the phone's home, "Your send-off card is ready" with Open the card, gone when the first month abroad ends; Open the card and the share of share:card-drawn-on-device work as for any card. The card's data and the marks of share:card-never-looks-official are those of any card. The ticket stub keeps its landscape shape and carries the seat the counter gave (beat 2). The card is kept with the seat once the first ride says it is saved, or at once when no scene shows (a life reopened after the flight); the seat travels as words under the place flown to, "By the window" or "On the aisle" (`share.stub.seat.*`), on the screen's stub and in the drawn one, never as a seat's number or letter (share:card-never-looks-official); on the screen each field of the stub grows to its longest word so a place name wraps between words.

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

- **View field**: `card` is `{ kind: "chapter" | "granted" | "send-off" | "first-pay-abroad" | "secured" | "december" | "draw-win" | "real-story" | "lost"; chapter: Id<"chapter"> | null; route: Id<"route"> | null; percent: number | null; months: number; standing: number; topActivities: Id<"activity">[]; name: string | null; shareable: boolean } | null`. `shareable` is false for `lost` and for every case in share:no-card-for-harm. The simulation sets the kind and says when a card is due, the send-off and the road included.
- **Content**: text keys `share.<kind>.title`, `share.disclaimer` ("Japacity is a game"), and an art id per chapter and per kind, `share.<kind>.art`, pointing at the assets register.
- **Tuning**: `tuning.share = { width; height; maxBytes; previewWidth; previewHeight; previewMaxBytes }`.
- **Static files**: one approved preview image per kind, `/share/<kind>.jpg`, and the `/official` page.
