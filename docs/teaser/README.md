# The teaser

## Files

| File | What it is |
|---|---|
| `japacity-teaser.mp4` | The teaser: 28 seconds, 1920 by 1080, 30 frames a second, H.264, with sound. |
| `japacity-teaser-portrait.mp4` | The portrait teaser, for sharing on a phone: 1080 by 1920, with the same shots, words, sounds and length. |
| `japacity-teaser-end.webp` | The landscape teaser's end card, shown on the front page. |
| `japacity-teaser-portrait-open.webp` | The portrait teaser's opening, shown on the front page. |

## What the teaser shows

It follows one life, Ada's, from the door's question to the flight, and looks in on Makoko on the lagoon, where another life can start. The game's own pieces stand inside the world's shots: the word bubbles in each place's voice, the band, the brief's chip, the passbook, the four ways out (a master's in the UK, a tech job abroad, health care in the UK, the Gulf), the night, the plane and the seal's two bulbs.

The portrait teaser is the game in the hand from the first shot. Every shot of the world is the phone's own recording, full frame, with the band, the bubbles, the beat's words and the cards where the game puts them on a phone, all clear of a feed's own bars at the top and bottom of the frame.

Both end cards close on `japacity.app`, then GitHub's mark and the line "Free. Open source on GitHub." The address of the source goes in a post's caption, where it can be tapped.

## Making it again

It is made from code with Remotion in `apps/teaser`. From the repository's root:

```sh
pnpm teaser:record   # plays the game on a development server and records the clips into apps/teaser/clips
pnpm teaser:render   # renders both files to docs/teaser/japacity-teaser.mp4 and docs/teaser/japacity-teaser-portrait.mp4
```

- `pnpm teaser:record` needs Chromium for Playwright (`pnpm exec playwright install chromium`) and ffmpeg on the path (or `FFMPEG=/path/to/ffmpeg`).
- `pnpm teaser:render` stops if either file reaches 10 MB.
- The two pictures are made from `pnpm teaser:render --stills <folder>` (the `landscape-end` and `portrait-open` stills), resized to 600 pixels high and saved as WebP.

## On the front page

GitHub never plays a file from the repository inline, so the root `README.md` plays the teaser through a GitHub asset link (an upload of the file through GitHub's editor). Under the player stand the two pictures at one height, each a link to its uploaded asset so a tap plays it, and a caption linking the two video files here, to download and share. After a new render the uploads are made again and the links replaced: `apps/teaser/README.md` says how.
