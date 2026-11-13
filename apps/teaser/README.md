# Teaser tooling

This package makes the game's teaser, so it can be made again whenever the game changes. This page is for whoever records, renders or changes it; the rendered files and what they show are in [`docs/teaser/`](../../docs/teaser/README.md). It is its own workspace package (`@japacity/teaser`). Nothing else imports it and it ships nothing to players. The colours, face and wordmark letters come from `@japacity/brand` (`packages/brand/`).

## Commands

Run them from the repository's root.

| Command | What it does |
|---|---|
| `pnpm teaser:record` | Plays the real game on a development server (it starts one if none answers) and records the clips the cut shows as WebM files under `apps/teaser/clips/`, through Chromium's screencast. See [Recording](#recording). |
| `pnpm --filter @japacity/teaser sound` | Makes the thirteen sounds from code into `apps/teaser/public/sound/`, so they are our own: the bed (pad, thumb piano and shaker), the danfo's horn and engine, the crowd, the pops, the swish, the coins, the stamp, the chime, the night, the jet, the switch and the swell. |
| `pnpm teaser:render` | Renders the teaser in both frames as H.264 with sound: `Lead` to `docs/teaser/japacity-teaser.mp4` and `LeadPortrait` to `docs/teaser/japacity-teaser-portrait.mp4`. Stops if a file reaches 10 MB. See [Rendering](#rendering). |
| `pnpm --filter @japacity/teaser studio` | Opens Remotion's studio to scrub any composition frame by frame. |
| `pnpm --filter @japacity/teaser stage -- [flags]` | Builds and renders the stageshow cuts (`Stageshow`, `StageshowPortrait`, `StageshowBPortrait`), the game's own screens as product shots. The flags are listed at the top of `render/stage.ts`. |
| `npx remotion still src/index.ts Poster out.png` (from `apps/teaser`) | Renders one frame of the cut with a play button over it, for anywhere a still has to stand for the video. `--props='{"frame":250}'` picks the frame. |

### Recording

- Needs Chromium for Playwright (`pnpm exec playwright install chromium`) and ffmpeg on the path (or `FFMPEG=/path/to/ffmpeg`).
- Wide shots hide every surface over the scene, so the world stands alone.
- Tall shots (`tall-day`, `tall-sofa`, `tall-ride`, `tall-street`, `tall-makoko`, `tall-night`) are the same sessions on the phone at scale 3, cropped to 1080 by 1920 for the portrait teaser.
- The screencast sends frames at the device's pixels only from a browser started at that scale. So the wide sessions run in a browser started at 1.5 (a true 1920 by 1080) and the tall ones in a browser started at 3, one browser open at a time.
- Every session starts from the life the front door makes for it: Ada the nurse. `wide-makoko` and `tall-makoko` use Bisi, the child of the water, whose life starts in Makoko, recorded by morning so the stilts, the water and the canoes read apart.
- `--port 5183` picks the server's port (5183 is the default).
- `--only tall-day,tall-night` records only the named clips or sessions and leaves every other clip as it is. `--only wide-day,wide-night,wide-sofa,wide-ride,wide-street,wide-makoko` records the landscape clips again.

### Rendering

- `--only LeadPortrait` renders one composition.
- `--stills <folder>` renders the named moments of `src/lead/stills.ts` as PNG files instead: the portrait teaser's opening, street, turn, night in the hand and end card, its busiest frame with a phone feed's bars drawn over it (`portrait-feed`), and the landscape's end card.
- If Remotion's own browser does not open the bundle, set `TEASER_BROWSER` to another Chromium headless shell (Playwright's, under `~/Library/Caches/ms-playwright`).

## Putting a new render on the front page

GitHub plays a video inline only from an asset uploaded through its own editor, never from a file in the repository (a link to a repository file opens the file's page, where it has to be downloaded).

1. Run `pnpm teaser:render`.
2. Signed in to GitHub, open `README.md` in the web editor (or any issue's comment box) and drag in `docs/teaser/japacity-teaser.mp4`. GitHub answers with a line like `https://github.com/user-attachments/assets/<id>`.
3. Replace the line under the teaser comment at the top of `README.md` with it, on a line of its own with a blank line on each side.
4. Drag in `docs/teaser/japacity-teaser-portrait.mp4` too, for a second asset link.
5. Under the player stand two pictures at one height, each a link to its uploaded asset (landscape and portrait), so a tap plays it in the browser, including where GitHub's app shows no player. The pictures are `docs/teaser/japacity-teaser-end.webp` and `docs/teaser/japacity-teaser-portrait-open.webp`. Make them from the `landscape-end` and `portrait-open` stills of `pnpm teaser:render --stills <folder>`, resized to 600 pixels high and saved as WebP (`cwebp -q 82 -resize 0 600`). The caption under them links the files in `docs/teaser/`.

## Compositions in `src/`

- `lead/Lead.tsx`: the teaser as shipped, in two frames built from one list of shots: `Lead` (1920 by 1080) and `LeadPortrait` (1080 by 1920, for a phone's feed).
  - [What it shows](../../docs/teaser/README.md#what-the-teaser-shows) is the world's recordings with the game's pieces inside them, and sounds laid on each shot. Makoko comes before the house, with Bisi's band and the fish seller's call; the passbook stands over the house.
  - The portrait teaser opens on the same card, stacked. Every later shot is the phone's own recording, with each piece inside its zone of a feed's frame (`parts/zones.tsx`): the band at 220 to 320, bubbles over heads in the picture, the beat's words as one centred chip at 1180 to 1360, the cards at 1000 to 1540 (the four ways out 120 pixels high, from 1006 to 1534), and nothing of ours above 220 or below 1540, where a feed draws its own bars.
  - The end cards' closing line is `END_LINE`.
- `lead/Poster.tsx`: one frame of the cut with a play button, a still to stand for the video.
- `lead/stills.ts`: the named stills that `--stills` renders.
- `teaser/`: the thirty second `Teaser` composition (title cards, map push, night fall, flight, end card). `lead/Lead.tsx` uses its scenes `Flight`, `MapShot` and `NightFalls`.
- `deck/`: the `Deck` composition, a deck of cards beside a caption with a window that grows into the world. Open it in the studio.
- `stage/`: the stageshow cuts (`Stageshow`, `StageshowPortrait`, and the second cut `StageshowBPortrait` in `stage/b/`). Each cut's folder has a `REHEARSAL.md`.
- `clips.ts`: the list of clips, read by both the recorder and the compositions.
- `parts/`:
  - the dress at a trailer's scale: the card, the chip, the sticker, the pressed button, the pill, the title, the phone, the plane;
  - the seal, the wordmark and GitHub's mark (`GitHub_Invertocat_White.svg`, kept as GitHub hands it out on [its logos page](https://github.com/logos); the drawn mark uses the same path with only its fill set);
  - the motion springs;
  - `frame.ts`: the frame a cut is drawn in (wide or tall) with the two compositions' sizes, which the pieces read to lay themselves out;
  - `zones.tsx`: the feed's zones every tall piece stands in.

## Changing the cut

Edit `lead/Lead.tsx`. A change to the list shows in both frames.

- `SHOTS` is the list of shots. Each has its length in frames, its act in the portrait teaser (`open`, `city`, `turn`, `hand`, `end`) and a React node.
- The pieces (`Bubble`, `Band`, `BriefChip`, `BigChip`, `Passbook`, `RouteCard`, `Sfx`) take their position in pixels of the 1920 by 1080 frame and their delay in frames. In the 1080 by 1920 frame they lay themselves out by their zone.
- A `World` takes `tall`: the phone's recording of the same moment (its clip, in-point and speed) and how it is framed. `scale` and `at` (the recording's top left corner in the frame) are for views where the phone puts its people low. `after` is another framing from a given frame of the shot on, for where the recording cuts to another view.
- A bubble's `tall.head` is its speaker's head in the phone's recording (in its own 1080 by 1920 pixels), or a list of heads at frames of the shot where the speaker or the view moves. The tail stays on the head as the picture eases closer.
- A tall bubble lays its words in lines of known letters, so every box is known. `Lead.test.tsx` walks each shot at five frames and checks every piece stands in its zone.

Render, pull frames with ffmpeg (or `--stills`), look, and repeat.

The game's word rules hold here too: never slots, turn, banked, pages, days left, a day count or a percentage, and nothing about how the game is made.

## Licence

Remotion is free for individuals and for companies of up to three people, commercial use included ([Remotion's licence questions](https://www.remotion.dev/docs/license/faq)). It runs only at build time.
