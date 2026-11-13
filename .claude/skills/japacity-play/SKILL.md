---
name: japacity-play
description: "Play Japacity end to end on a phone-sized browser with the repository's play driver (pnpm play): from the front door through the years before, the ride into the world, months that follow the nudge, and every app on the phone, with pictures and a plain log in a folder outside the repository. Use to see a change in the real game, to gather pictures for a report, or to look over the game as a player meets it."
---

# Playing the game end to end

The driver is in `tools/play/`. It plays like a first-time player who does what the nudge says, on the phone profile the browser tests use. It asserts nothing; the browser tests in `apps/client/e2e/` do that. `tools/play/README.md` is its reference: the steps a run takes, every option, the log and the pictures. Read it before your first run.

## Running it

```sh
pnpm play --life developer --months 3 --out /tmp/japacity-play
```

- On a fresh clone, install the browser once: `pnpm exec playwright install chromium`.
- `--out <folder>` is required and must be outside the repository.
- In a worktree, give `--port` the port your task gives you. To play the local stack from `pnpm dev:full`, give `--url https://localhost:8787` instead; never both.
- A file given to `--keep` must be outside the repository: it holds a signed-in session. Never print it or put it in a report.
- To reach staging, set the Access token's two variables from the keychain for that one command, as the README says. Never write them to a file.
- Leave `--played` off when you want to see what a new player sees.

## Reading the result

- The exit code is 0 only when every month asked for was ended. Read the last line and every `PROBLEM`, `page error` and `console error` line.
- A `PROBLEM` is not always a bug in the game. When the interface changed a button's name or a `data-` hook, the driver needs the same change (see the README's "Log and exit code"). Say which it is in your report.
- Open the pictures to check that a change looks right on a phone. Put the ones that matter in your report, by path.

## Changing the driver

- Follow the README's "Changing the driver": testable parts in `options.ts`, browser steps in `play.ts`, nothing that only works on one machine.
- Follow `japacity-dev` for everything else (the check, the writing rules, the report).
