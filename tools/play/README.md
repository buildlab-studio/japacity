# The play driver

Plays Japacity from the front door in a phone-sized browser, takes a picture at each step and prints a plain log. Use it to see a change in the real game as a player meets it.

```sh
pnpm play --life developer --months 3 --out /tmp/japacity-play
```

## Steps

1. Uses a dev server already answering on the port, or starts one (`vite` for the client) and stops it at the end.
2. Opens the front door on the phone profile the browser tests use (390 by 844, touch, mobile), with WebGL on the software renderer.
3. Rolls the dice for a name (the box starts empty and Begin never takes its placeholder). Takes the archetype's life (or, with `--ready`, asks for the ready lives as Settings does and picks that kind), leaves the age and Where you live as they are, and taps Begin.
4. Watches the page fill as the years go by, with no card, then taps Go on the filled page, which opens the world.
5. Reads the first chapter's title and the nudge under it while the title shows, and logs the first-use labels on the thumbs. A later chapter's opening card is passed with Go, which takes its step and rides there.
6. Each month:
   1. reads the nudge if one shows, or rides to the place the map rings for the step and taps the step's marker there;
   2. takes the act it opens: the fan's button the nudge's step names; otherwise the first that stages an entry (so the racks' Work the racks comes before their Look); otherwise the first open one, never a Stop. Then the sheet's main button or its first answer;
   3. rides home by the map, sleeps the month from the bed's fan, passes any staged moment, reads the results and goes back to the place.
7. Opens the phone and every app on it, one by one.

## Log and exit code

- Every step is a line in the log, with the minutes and seconds since the start.
- A step that fails is a `PROBLEM` line, and the run goes on where it can.
- The last line counts the months ended, the pictures, the problems and the browser's own errors.
- The exit code is 0 only when every month asked for was ended.

## Options

| Option | What it does |
|---|---|
| `--out <folder>` | Required. Where the pictures, `play.log` and `dev-server.log` go. Must be outside the repository, so nothing lands in git |
| `--life <name>` | The life by its short name (default `developer`). Tiles: developer, nurse, accountant, writer, trader, shop-worker, water. Ready lives, with `--ready`: graduate, banker, developer, nurse, teacher. The names are read from the game's words, so a new life works without changing this tool |
| `--ready` | Start from the ready life of that kind instead of the tile |
| `--months <n>` | Months to end once in the world, 1 to 60 (default 3) |
| `--url <address>` | Play a server already running there: a dev server, or the local stack at `https://localhost:8787` (`pnpm dev:full`), whose self-signed certificate is accepted. Certificate errors are ignored only for https on `localhost` or `127.0.0.1`. Online, the start screen's Play and the age screen come before the door, and Begin makes a guest life on the server. Staging (`--url https://staging.japacity.app`) is behind Access: with `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` set in the environment (from your keychain or secret store), every request carries the service token's two headers. They are never printed or written. Give `--url` or `--port`, not both |
| `--port <n>` | The port to use or start the dev server on (default 5190). Pick your own when several worktrees run at once |
| `--keep <file>` | At the end of the run, save the browser's storage (cookies and local storage) to this file, with mode 600. The file must be outside the repository: it holds a signed-in session. Only its counts are logged, never a name or a value |
| `--resume <file>` | Open with the storage a `--keep` saved, on the same `--url` or `--port` it was kept on. The front door is skipped, the life opens where it stands (if it stopped in the years before, they fill and hand over) and `--months` more are played. A refusal by the server (a 409 for a diverged life, a server error) or a trouble card is a `PROBLEM` line naming the status, and the exit code is not 0. `--life` and `--ready` are refused with it |
| `--stop <where>` | Stop the life part way, to keep it there with `--keep`. `door` holds back the years before at Begin, so the life is made and its prologue is still open (refused with `--resume`). `planned` follows the next month's nudge after `--months` and leaves the bed alone, so that month is planned and not ended |
| `--take <acts>` | Comma separated acts. Each month, before the nudge, tap each thing in the place and take any of these acts its fan offers open, with the main answer of what it opens, going through each door of the scene to the things behind it and back out. `--take activity.ask-fisherman,activity.take-net-work,activity.buy-canoe,activity.start-canoe-taxi` plays the water life on the boats |
| `--played` | Mark the device as played, so the first-use labels on the thumbs never show |
| `--headed` | Show the browser |
| `--help` | Print the options |

## Keeping a life and playing it on

```sh
pnpm play --url https://localhost:8787 --life nurse --months 2 --keep /tmp/japacity-kept/nurse.json --out /tmp/japacity-play/nurse
pnpm play --url https://localhost:8787 --resume /tmp/japacity-kept/nurse.json --months 2 --out /tmp/japacity-play/nurse-resumed
```

The second run opens the same account's life where the first left it, so a change deployed between the two meets a life already played. Its first picture is `NN-resumed.png`, the screen the life opens on. To keep the life again after the resumed months, give `--keep` and `--resume` the same file.

## From a fresh clone

```sh
pnpm install
pnpm exec playwright install chromium
pnpm play --out /tmp/japacity-play
```

If the browser is missing, the log says so and names the install command.

## Pictures

Named `NN-step.png`: a two-digit count, then the step in lower case with dashes (`13-month-1-results.png`). A new run into the same folder overwrites by name and starts a new `play.log`.

## It is not a test

It asserts nothing about the game; the browser tests in `apps/client/e2e/` do that. It plays as a first-time player who does what the nudge says, so its pictures show what that player meets. Its choices are fixed (the first answer, the first act), so two runs differ only where the game's own draws differ.

Its own test, `pnpm exec vitest run tools/play`, checks the option parsing and the picture names without a browser.
