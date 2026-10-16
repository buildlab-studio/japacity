// R-ENGINE-015 (the splash): the game's mark with its name under it, about a
// third down the game's ground. index.html paints this very markup before the script runs and holds its style and the
// mark's drawing (one symbol, outside #root, so React's renders keep it), so the page and the opening screen are one
// splash and nothing jumps when the script mounts. Splash.test.tsx holds the two equal. What stands under the name (the
// opening words, a fault card) is the caller's.
import type { ComponentProps } from "react";

import { say } from "../words/text";

/** The id of the mark's drawing in index.html: the brand's small mark, drawn inline, never fetched. */
export const MARK_ID = "japacity-mark";

export function Splash({ children, ...rest }: ComponentProps<"div">) {
  return (
    <div className="splash" data-splash="" {...rest}>
      <svg className="splash-mark" aria-hidden="true">
        <use href={`#${MARK_ID}`} />
      </svg>
      <p className="splash-name">{say("ui.game")}</p>
      {children}
    </div>
  );
}
