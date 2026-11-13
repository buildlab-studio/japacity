# 0021. One game for every country, and real players before computer residents

Status: Accepted

## Context

- Players come from many countries.
- The only contact the game offers is preset phrases between friends who invited each other. Levels of contact by country would guard nothing.
- Rules by country would give a player a different game for where they signed up.
- A place in the city is livelier with the people actually playing in it.

## Decision

**No region table.** Every player, from any country, plays the same game (region:same-contact-everywhere, region:one-age-line-for-all):

- the same date-of-birth screen (18 and over);
- sign-up open everywhere;
- the same contact: preset phrases and pair records between accounts connected by an invite, with block and report.

The country the edge reports at sign-up is stored. It is read only for counts, the advert region and moderation, never for what a player may do (account:country-comes-from-cloudflare).

**Seeing is not contact.** Who is in a place, by display name and look, is presence (city:players-fill-the-crowd, clock:presence-is-not-contact):

- a character in a place is a game profile;
- the socket carries only nudges;
- so seeing a character gives no way to reach its player.

**No matching and no typed text** (region:no-stranger-matching):

- the matchmaker for strangers is off (`tuning.people.matchmaker` false);
- nothing a player types reaches another player;
- so no stranger can reach a player through the game.

**Players fill the crowd** (city:residents-fill-to-target):

- in a place, real players fill the crowd up to its headcount;
- computer residents fill only the slots no player takes;
- residents with a part in the scene (a seller, a clerk, an officer, the family at home) keep their spots;
- the crowd never grows past the place's headcount or the graphics mode's cap;
- no player is ever shown in a home.

## Consequences

- One behaviour to build, test and explain, the same in every country.
- Advert regions are their own list (`config.advert.regions`), apart from anything a player may do.
- A change to who may play or how players meet is a change to the code, to `../rules/region.md`, and a new record that supersedes this one.
