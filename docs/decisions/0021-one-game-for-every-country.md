# 0021. One game for every country, and players before residents

Status: Accepted

## Context

Players come from many countries. The contact the game offers is preset phrases between friends who invited each other, so levels of contact by country would guard nothing, and a player would get a different game for where they signed up. A place in the city is also livelier with the people actually playing in it.

## Decision

- **No region table.** Every player, from any country, plays the same game: the date-of-birth screen (18 and over) for everyone, sign-up open everywhere, and the same contact for everyone, preset phrases and pair records between accounts connected by an invite, with block and report (region:same-contact-everywhere, region:one-age-line-for-all). The country the edge reports at sign-up is stored and read only for counts, the advert region and moderation, never for what a player may do (account:country-comes-from-cloudflare).
- **Seeing is not contact.** Who is in a place, by display name and look, is presence: a character in a place is a game profile, and the socket carries only nudges, so seeing one gives no way to reach its player (city:players-fill-the-crowd, clock:presence-is-not-contact).
- **No matchmaker and no typed text.** The game has no matchmaker for strangers, and nothing a player types reaches another player, so no stranger can reach a player through the game (region:no-stranger-matching). The date-of-birth screen is the one age line, the same for everyone (region:one-age-line-for-all).
- **Players fill the crowd.** In a place, real players fill the crowd up to its headcount and computer residents fill only the slots no player takes. Residents with a part in the scene (a seller, a clerk, an officer, the family at home) keep their spots, and the crowd never grows past the place's headcount and the graphics mode's cap (city:residents-fill-to-target). No player is ever shown in a home.

## Consequences

- One behaviour to build, test and explain, the same in every country.
- Advert regions are their own list (`config.advert.regions`), apart from anything a player may do.
- A change to who may play or how players meet is a change to the code, to `../rules/region.md` and a new record here.
