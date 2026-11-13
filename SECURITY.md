# Security

## Reporting a vulnerability

Write to **security@japacity.app**, the address in [`/.well-known/security.txt`](https://japacity.app/.well-known/security.txt). If you get no reply, write to the operator's general address, social@japacity.app (`packages/content/src/legal/legal.operator.ts`).

Include:

- what you found and where (the address, the route or the file),
- the steps to reproduce it, with the smallest request or command that shows it,
- what an attacker gains: another player's data, unearned money or standing in the game, control of the admin pages, or cost to the operator.

Do not open a public issue or pull request for a vulnerability. Do not test against other players' accounts or lives: use your own account, or [run your own copy](docs/site/built/your-own-copy.md).

## In scope

- The game at `japacity.app` and the Worker behind it (`apps/server`): every `/api` route, sign-in, sessions and passkeys, the age screen and the bot check, account deletion, the admin pages, moderation, pairs, conversations, invites, presence and its socket, adverts, counters and the draw.
- The stores (`packages/store`, `packages/db`) and how their queries are built.
- The client's pages (`apps/client`): anywhere text from the server or another player reaches the page, and the page's own headers.
- The simulation's checks on a player's command (`packages/sim`): any command that gives a life money, standing or progress the rules do not allow.

## Out of scope

- Denial of service by volume, and rate limits that work as their rule page says.
- The services the game runs on (Cloudflare, Neon, Google sign-in, the email provider), unless the game's own setup of them is at fault.
- Copies of the game run by other people.
- Reports from automated scanners with no working case.
- Social engineering of the operator or of players.
- The game's balance: a strategy that wins within the rules is play, not a vulnerability.
