---
name: japacity-play
description: "Play Japacity end to end on a phone-sized browser with the repository's play driver (pnpm play): from the front door through the years before, the ride into the world, months that follow the nudge, and every app on the phone, with pictures and a plain log in a folder outside the repository. Use to see a change in the real game, to gather pictures for a report, or to look over the game as a player meets it."
---

# Playing the game end to end

The driver is `tools/play/`. It plays the way a first-time player who does what the nudge says would, on the phone profile the browser tests use (390 by 844, touch). It asserts nothing; the browser tests in `apps/client/e2e/` do that. Its README has every option.

## Run it

```sh
pnpm play --life developer --months 3 --out /tmp/japacity-play
```

- `--out` is required and must be outside the repository. The pictures, `play.log` and (when the driver started one) `dev-server.log` go there.
- `--life` takes a short name: a tile (developer, nurse, accountant, writer, trader, shop-worker, water) or, with `--ready`, a ready life (graduate, banker, developer, nurse, teacher). The names come from the game's words, so a new life needs no change to the driver.
- `--months` is how many months to end once in the world (1 to 60).
- `--port <n>` starts the dev server there, or reuses one that already answers. In a worktree, use the port your task gives. `--url <address>` plays a server already running elsewhere.
- `--played` marks the device as played, so the first-use labels on the Map and Phone thumbs never show; leave it off to see what a new player sees.
- `--keep <file>` saves the browser's storage at the end (mode 600, outside the repository, never printed); `--resume <file>` opens that life where it stands, with no front door, and plays `--months` more. `--stop door` keeps a life made with its years before unplayed, `--stop planned` one with its next month planned and not ended. A resumed life the server refuses is a `PROBLEM` naming the status and the run fails.

From a fresh clone, install the browser once: `pnpm exec playwright install chromium`.

## What a run does

1. The front door, three screens with everything chosen (prologue:front-door-three-screens): Next on "Who are you?" with the name offered, the tile and its age on "Your life so far", then Next; Begin on "Where you live" with the home as it stands.
2. The page fills as the handover (prologue:printed-page-hands-over): the family card turns over and the years' chips show; Go opens the world.
3. The first chapter's title stands over the world for a moment (chapter:first-chapter-mission-card); the nudge gives the first step; the map with the stop picked, Go by danfo, the ride (a picture, then Skip), the place.
4. The first-use labels at the Map and Phone thumbs, unless `--played` (world:no-walkthrough-before-play).
5. Each month: the nudge is read and tapped; the act it floats over a thing is tapped; on the sheet that opens, the main button (or the first answer: an offer's Accept, a repair's Pay) is taken; then the ride home by the map, Sleep on the bed's fan, any staged moment, the results, and back to the place. A card over the world (a toast's card, the chapter's words) is read and closed.
6. The phone: every app, one by one, each with a picture.

## Read the log

Each line starts with the minutes and seconds since the start:

```
[00:19] month 1: nudge says "Find a job on the board"
[00:20] acts over the thing: Jobs; tapping the first
[00:22] tapped "Look for a job"
[00:26] month 1 results: 23 YRS 2 MO The month is done Down this month ...
[00:26] picture 13-month-1-results.png
```

- `PROBLEM` lines are steps the driver could not take. The run goes on where it can.
- `page error` and `console error` lines at the end are the browser's own errors during the run.
- The last line counts months ended, pictures, problems and errors. The exit code is 0 only when every month asked for was ended.

A `PROBLEM` is not always a bug in the game. When the interface changes a button's name or a `data-` hook, the driver needs the change too: its selectors are in `tools/play/play.ts`, and they follow the hooks the browser specs use (`apps/client/e2e/support/door.ts`, `world.spec.ts`, `phone.spec.ts`).

## Pictures

`NN-step.png` in the order taken: `01-front-door.png`, `09-the-world.png`, `13-month-1-results.png`, `21-phone.png`, `22-phone-bank.png`. Open them to check a change looks right on a phone; put the ones that matter in your report by path.

## Changing the driver

- The option parsing and the picture names are in `tools/play/options.ts`, tested without a browser by `pnpm exec vitest run tools/play`. Keep anything that can be tested without a browser there.
- The browser steps are in `tools/play/play.ts`. Keep it generic: no path under anyone's home, no fixed port beyond the default, nothing that only works on one machine.
- Follow `japacity-dev` for everything else (the check, the writing rules, the report).
