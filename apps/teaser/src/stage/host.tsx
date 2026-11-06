// Where the game stands in each frame of the teaser. Wide (1920 by 1080, drawn at 1280 by 720 and scaled by one and a
// half): the game in a laptop's browser at japacity.app, the world filling the window and the game's pieces in the
// centred column of a phone's width, as the game stands on a laptop. Tall (1080 by 1920, drawn at 540 by 960 and
// doubled): the phone in the hand, whole, the game filling its screen. The scenes put the same pieces in both.
import type { ReactNode } from "react";

import { Phone, Window } from "./kit";

export type Shape = "wide" | "tall";

/** The design size of each frame; the page scales it to the window, one and a half times wide and twice tall. */
export const FRAME = { wide: { width: 1280, height: 720 }, tall: { width: 540, height: 960 } } as const;

/** The browser window in the wide frame, a gutter from every edge, and its address bar's height. */
const WINDOW = { inset: 20, bar: 38 } as const;
/** The phone in the tall frame, centred, and its screen in true points. */
/**
 * The phone in the tall frame: as wide as lets its screen stand whole while the foot of its frame runs past the stage's
 * bottom, a gutter above it and the same on each side of the stage's centre.
 */
const PHONE = { width: 452, top: 24, screen: { width: 402, height: 874 }, safe: 59 } as const;

/** The game's screen in each frame: its size in the frame's points, the column's width and the room the system takes at the top. */
export const SCREEN = {
  wide: { width: FRAME.wide.width - WINDOW.inset * 2, height: FRAME.wide.height - WINDOW.inset * 2 - WINDOW.bar, column: 430, top: 12 },
  tall: { width: PHONE.screen.width, height: PHONE.screen.height, column: PHONE.screen.width, top: PHONE.safe },
} as const;

/** The world behind the game's pieces: a still of the family house by day from the game's own recordings. */
export function World({ shape }: { shape: Shape }) {
  return <img className="jc-world" data-shape={shape} src={`../stage/house-day-${shape}.webp`} alt="" draggable={false} />;
}

/**
 * The host round the game's screen: the browser or the phone. `children` is the screen; `column` puts its pieces in
 * the centred column, as the game does on a laptop and as wide as the screen on a phone.
 */
export function Host({ shape, children }: { shape: Shape; children: ReactNode }) {
  if (shape === "wide") {
    return (
      <Window url="japacity.app" urlShape="pill" className="jc-window" style={{ left: WINDOW.inset, top: WINDOW.inset, width: SCREEN.wide.width, height: FRAME.wide.height - WINDOW.inset * 2 }}>
        <div className="jc-screen">{children}</div>
      </Window>
    );
  }
  const left = (FRAME.tall.width - PHONE.width) / 2;
  return (
    <Phone width={PHONE.width} className="jc-phone" style={{ left, top: PHONE.top }}>
      <div className="jc-screen">{children}</div>
    </Phone>
  );
}

/** The front door's reading column on a laptop, wider than the world's; on a phone, the screen. */
export const DOOR_COLUMN = { wide: 600, tall: SCREEN.tall.column } as const;

/** The centred column of the game's pieces, a phone's width on a laptop unless `width` says otherwise. */
export function Column({ shape, width, children }: { shape: Shape; width?: number; children: ReactNode }) {
  return (
    <div className="jc-column" style={{ width: width ?? SCREEN[shape].column }}>
      {children}
    </div>
  );
}
