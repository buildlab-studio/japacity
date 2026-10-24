# Who can play, and who runs the game

> Rests on `../design/01-concept.md` sections 16 to 18.
> Kind: `region`, server behaviour. The region is only the country a request comes from, which counts play by country and chooses an advert region; nothing a player may do turns on it. `account.md` holds the age screen and sign-up; `pair.md` holds how two players meet; this page holds who may play, what contact every player has, and who runs the game.

Every player, from any country, plays the same game. Sign-up is open everywhere, the date-of-birth screen is the same for everyone, and contact between players is the same for everyone: preset phrases and pair records between accounts connected by an invite, with block and report. Nothing a player may do turns on where they are.

## Rules

**region:same-contact-everywhere** Contact between players is the same wherever they are: preset phrases and pair records only between accounts connected by an invite (pair:invite-link-single-use, pair:everyone-meets-by-invite), with block and report on every pair (pair:block-ends-every-bond, `moderation.md`). A character in a place is a game profile, not a person: seeing other players' characters in a place, with their display names, is not contact (city:players-fill-the-crowd, clock:presence-is-not-contact).

**region:one-age-line-for-all** The date-of-birth screen of `account.md` (account:age-screen-refuses-minors) turns away anyone under 18, the same for every player; the terms of play state the same line. No strong age check is asked for.

**region:no-stranger-matching** No player is matched with a stranger: the matchmaker is shut (`tuning.people.matchmaker` false, pair:no-records-between-strangers), and nothing a player types reaches another player as a message. The name on a dedication light (account:name-a-light-for-yours) reaches other players only once the game's makers have approved it on the admin page (moderation:dedication-lights-await-approval), and until then nobody but its own account sees it; an approved name is not contact between players.

**region:operator-named-once** Who runs the game. The operator is named in one constant, `OPERATOR` in `packages/content/src/legal/legal.operator.ts`: the name, the place and the one address for help, privacy requests and complaints. The two player pages, the terms of play and the privacy notice, read it from there and are the whole of the legal surface; no other published file in `apps/` or `packages/` spells the operator's name or place, so a change of operator is a change to that one constant and a rebuild. The section "Who runs the game, and its two pages" below says what the pages hold.

## Who runs the game, and its two pages

The game is run from Nigeria by the operator that region:operator-named-once names. The privacy notice follows Nigeria's data protection law of 2023 and names the operator as the data controller. The terms are governed by the law of Nigeria, with the courts of Lagos State for disputes.

Two pages are the whole of the legal surface: the terms of play at `/terms` and the privacy notice at `/privacy`, served beside the game and linked from the start screen, the settings and the guides menu. Both read the operator from the one constant (region:operator-named-once).

## Numbers

| Setting | Value | Source | Held in |
|---|---|---|---|
| Age screen pass | 18 or over | the concept's adults-only rule | `account.md` |

## Contract

- **Account fields**: `country: string`, the request's country at sign-up (account:country-comes-from-cloudflare), read only to count play by country (`analytics.md`) and to choose an advert region (advert:campaign-chosen-without-player-data).
- **Rejection codes**: none of this page's own.
- **View fields**: none.
