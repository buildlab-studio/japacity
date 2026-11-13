# The Japacity mark

The mark is the seal: a J in two rings, with two bulbs on a wire across the top, a warm one for home and a cool one for abroad. The wordmark beside it is the name in the plain bold face, drawn as paths so no font is needed. The name and its logo are reserved; no licence in `LICENSES.md` covers them.

## Files

The files are in `apps/client/public/brand/`, which the site serves. These notes live here instead, so the site never serves them.

| File | Use |
|---|---|
| `japacity-lockup-<ground>.svg` | The seal and the name side by side |
| `japacity-mark-<ground>.svg` | The seal alone, full drawing, above 192 px |
| `japacity-mark-medium-<ground>.svg` | The seal from 48 to 192 px: heavier rings |
| `japacity-mark-small-<ground>.svg` | The seal up to 48 px: one ring, bulbs as plain discs |

`<ground>` is `light` for a light ground (navy disc, chalk lines) or `dark` for a dark ground (yellow disc, navy lines, the lockup's letters in the band's chalk).

The same folder also holds `google-g.svg`, Google's mark for the sign-in button; it is not part of the Japacity mark.

In `apps/client/public/`:

- `favicon.svg`: the small drawing.
- `favicon.ico`: 16, 32 and 48 px.
- `icon-192.png`, `icon-512.png`.
- `icon-maskable-512.png`: the yellow seal on navy, inside the safe zone.
- `apple-touch-icon.png`: 180 px, the yellow seal on navy.
- `manifest.webmanifest`: names the three `icon-*` files.

`index.html` links the favicon, the apple touch icon and the manifest. The PNGs are rendered from the SVGs with a headless browser at their own size.

## Colours

| Colour | Value | Where |
|---|---|---|
| Navy | #1c2a5e | The disc on a light ground; the lines on a dark one |
| Chalk | #eaf3fb | The rings, the wire and the J on a light ground |
| Danfo yellow | #f2b705 | The disc on a dark ground; the warm bulb |
| Cool | #cfe9ff | The cool bulb |

## Clear space and size

- Keep clear space of at least a quarter of the seal's height on every side. Nothing else stands inside it.
- The seal reads from 16 px (the favicon); the lockup from 24 px high. Smaller than that, write the game's name in words.
- Never stretch, rotate, recolour, outline or add a shadow to either. Use the file made for the ground it stands on and the drawing made for the size.

## Where it appears

- The lockup heads the start screen's sheet, the door's first screen, and the account screens (the ways back in, the keep-this-life sheet, the invite page and the full screen).
- The seal signs every screenshot moment, in the card's corner beside the address japacity.app.
- The seal stands before the game's name at the foot of every share card, its link preview and the ticket stub. On the canvas it is drawn in the small drawing's shapes (`src/shared/share/paint.ts`); on screen it is the footer's picture.
