# The teaser

`japacity-teaser.mp4` is the game's teaser, twenty eight seconds: 1920 by 1080, 30 frames a second, H.264, with sound. It follows one life, Ada's, from the door's question to the flight, and looks in on Makoko on the lagoon, where another life can start, with the game's own pieces inside the world's shots: the word bubbles in each place's voice, the band, the brief's chip, the passbook, the four ways out (a master's in the UK, a tech job abroad, health care in the UK, the Gulf), the night, the plane and the seal's two bulbs. It is made from code with Remotion in `apps/teaser`, so it can be made again whenever the game changes.

`japacity-teaser-portrait.mp4` is the portrait teaser, for sharing on a phone: 1080 by 1920, the same shots, words, sounds and length. It is the game in the hand from the first shot: every shot of the world is the phone's own recording, full frame, with the band, the bubbles, the beat's words and the cards where the game puts them on a phone, all clear of a feed's own bars at the top and the bottom of the frame. Both end cards close on `japacity.app` and GitHub's mark before the line "Free. Open source on GitHub."; the address of the source goes in the caption of a post, where it can be tapped.

Two commands make it again, from the repository's root:

```sh
pnpm teaser:record   # plays the game on a development server and records the clips into apps/teaser/clips
pnpm teaser:render   # renders both files to docs/teaser/japacity-teaser.mp4 and docs/teaser/japacity-teaser-portrait.mp4
```

`pnpm teaser:record` needs Chromium for Playwright (`pnpm exec playwright install chromium`) and ffmpeg on the path (or `FFMPEG=/path/to/ffmpeg`). `pnpm teaser:render` stops if either file reaches 10 MB.

The front page plays it inline through a GitHub asset link (an upload of this file through GitHub's editor), because GitHub never plays a file from the repository inline. After a new render, the upload is made again and the link in the root `README.md` replaced; `apps/teaser/README.md` says how. Under it stand two pictures from the cut, the landscape teaser's end card (`japacity-teaser-end.webp`) and the portrait teaser's opening (`japacity-teaser-portrait-open.webp`), at one height, each a link to its uploaded asset, so a tap plays it; the caption under them links the two files here, to download and share. Both are made from `pnpm teaser:render --stills <folder>` (`landscape-end` and `portrait-open`), resized to 600 pixels high and saved as WebP.
