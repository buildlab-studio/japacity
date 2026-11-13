# The play driver

Plays Japacity from the front door in a phone-sized browser, takes a picture at each step and prints a plain log. Use it to see a change in the real game as a player meets it. This page is the driver's reference: its steps, options, log and pictures.

```sh
pnpm play --life developer --months 3 --out /tmp/japacity-play
```

## From a fresh clone

```sh
pnpm install
pnpm exec playwright install chromium
pnpm play --out /tmp/japacity-play
```

If the browser is missing, the log says so and names the install command.

## Steps

1. Uses a dev server already answering on the port, or starts one (`vite` for the client, its output in `dev-server.log`) and stops it at the end.
2. Opens the front door on the phone profile the browser tests use (390 by 844, touch, mobile), with WebGL on the software renderer. Online (`--url` on a server), the start screen's Play and the age screen come first.
3. Goes through the door's three screens (prologue:front-door-three-screens): rolls the dice for a name on "Who are you?" (the box starts empty and Begin never takes its placeholder), then Next; takes the archetype's tile and its age on "Your life so far" (or, with `--ready`, asks for the ready lives as Settings does and picks that kind), then Next; and taps Begin on "Where you live" with the home as it is. Online, Begin makes a guest life on the server.
4. Watches the printed page fill as the years go by, with no card (prologue:printed-page-hands-over), then taps Go on the filled page, which opens the world.
5. Reads the first chapter's title (chapter:first-chapter-mission-card) and the nudge under it while the title shows, and logs the first-use labels on the Map and Phone thumbs (world:no-walkthrough-before-play). A later chapter's opening card is passed with Go, which takes its step and rides there.
6. Each month:
   1. reads the nudge if one shows, or rides to the place the map rings for the step and taps the step's marker there;
   2. takes the act it opens: the fan's button the nudge's step names; otherwise the first that stages an entry (so the racks' Work the racks comes before their Look); otherwise the first open one, never a Stop. Then the sheet's main button or its first answer (an offer's Accept, a repair's Pay);
   3. rides home by the map, sleeps the month from the bed's fan, passes any staged moment, reads the results and goes back to the place. A card over the world (a toast's card, the chapter's words) is read and closed.
7. Opens the phone and every app on it, one by one, each with a picture.

## Options

| Option | What it does |
|---|---|
| `--out <folder>` | Required. Where the pictures, `play.log` and `dev-server.log` go. Must be outside the repository, so nothing lands in git |
| `--life <name>` | The life by its short name (default `developer`). Tiles: developer, nurse, accountant, writer, trader, shop-worker, water. Ready lives, with `--ready`: graduate, banker, developer, nurse, teacher. The names are read from the game's words, so a new life works without changing this tool |
| `--ready` | Start from the ready life of that kind instead of the tile |
| `--months <n>` | Months to end once in the world, 1 to 60 (default 3) |
| `--url <address>` | Play a server already running there: a dev server, or the local stack at `https://localhost:8787` (`pnpm dev:full`), whose self-signed certificate is accepted. Certificate errors are ignored only for https on `localhost` or `127.0.0.1`. Staging (`--url https://staging.japacity.app`) is behind Access: with `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` set in the environment (from your keychain or secret store), every request carries the service token's two headers. They are never printed or written. Staging's bot check refuses the driver's browser at Begin, so a new life there ends at Begin by design. Give `--url` or `--port`, not both |
| `--port <n>` | The port to use or start the dev server on (default 5190). Pick your own when several worktrees run at once |
| `--keep <file>` | At the end of the run, save the browser's storage (cookies and local storage) to this file, with mode 600. The file must be outside the repository: it holds a signed-in session. Only its counts are logged, never a name or a value |
| `--resume <file>` | Open with the storage a `--keep` saved, on the same `--url` or `--port` it was kept on. The front door is skipped, the life opens where it stands (if it stopped in the years before, they fill and hand over) and `--months` more are played. A refusal by the server (a 409 for a diverged life, a server error) or a trouble card is a `PROBLEM` line naming the status, and the exit code is not 0. `--life` and `--ready` are refused with it |
| `--stop <where>` | Stop the life part way, to keep it there with `--keep`. `door` holds back the years before at Begin, so the life is made and its prologue is still open (refused with `--resume`). `planned` follows the next month's nudge after `--months` and leaves the bed alone, so that month is planned and not ended |
| `--take <acts>` | Comma separated activity ids. Each month, before the nudge, tap each thing in the place and take any of these acts its fan offers open, with the main answer of what it opens, going through each door of the scene to the things behind it and back out. `--take activity.ask-fisherman,activity.take-net-work,activity.buy-canoe,activity.start-canoe-taxi` plays the water life on the boats |
| `--played` | Mark the device as played, so the first-use labels on the thumbs never show. Leave it off to see what a new player sees |
| `--headed` | Show the browser |
| `--help` | Print the options |

## Keeping a life and playing it on

```sh
pnpm play --url https://localhost:8787 --life nurse --months 2 --keep /tmp/japacity-kept/nurse.json --out /tmp/japacity-play/nurse
pnpm play --url https://localhost:8787 --resume /tmp/japacity-kept/nurse.json --months 2 --out /tmp/japacity-play/nurse-resumed
```

The second run opens the same account's life where the first left it, so a change deployed between the two meets a life already played. Its first picture is `NN-resumed.png`, the screen the life opens on. To keep the life again after the resumed months, give `--keep` and `--resume` the same file.

## Log and exit code

Each line starts with the minutes and seconds since the start:

```
[00:19] month 1: nudge says "Find a job on the board"
[00:20] acts over the thing: Jobs; tapping the first
[00:22] tapped "Look for a job"
[00:26] month 1 results: 23 YRS 2 MO The month is done Down this month ...
[00:26] picture 13-month-1-results.png
```

- A step that fails is a `PROBLEM` line, and the run goes on where it can.
- `page error` and `console error` lines at the end are the browser's own errors during the run.
- The last line counts the months ended, the pictures, the problems and the errors.
- The exit code is 0 only when every month asked for was ended.

A `PROBLEM` is not always a bug in the game. When the interface changes a button's name or a `data-` hook, the driver needs the same change. Its selectors are in `play.ts` and follow the hooks the browser specs use (`apps/client/e2e/support/door.ts`, `world.spec.ts`, `phone.spec.ts`).

## Pictures

Named `NN-step.png`: a two-digit count, then the step in lower case with dashes, in the order taken (`01-front-door.png`, `09-the-world.png`, `13-month-1-results.png`, `21-phone.png`, `22-phone-bank.png`). A new run into the same folder overwrites by name and starts a new `play.log`.

## It is not a test

It asserts nothing about the game; the browser tests in `apps/client/e2e/` do that. It plays as a first-time player who does what the nudge says, so its pictures show what that player meets. Its choices are fixed (the first answer, the first act), so two runs differ only where the game's own draws differ.

## Changing the driver

- Option parsing and picture names are in `options.ts`, tested without a browser by `pnpm exec vitest run tools/play`. Keep anything that can be tested without a browser there.
- The browser steps are in `play.ts`. Keep it generic: no path under anyone's home, no fixed port except the default, nothing that only works on one machine.
