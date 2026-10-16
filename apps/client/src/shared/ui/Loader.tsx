// The one look for every wait (R-ENGINE-015): a thin rounded bar in the band's ink on the sheet's ground, under the waiting words. Without a
// known share a short segment eases across by transform alone; with one the bar fills to it. Under reduced motion the
// moving segment stands still as a full quiet bar (index.css, `.loader`). Never a spinner.
import type { ReactNode } from "react";

/** The bar alone: `percent` given, it fills to that share; left out, it runs. Spans only, so it sits inside a line's `<p>`. */
export function Loader({ label, percent, small = false, className = "" }: { label: string; percent?: number; small?: boolean; className?: string }) {
  const filled = percent === undefined ? null : Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(filled === null ? {} : { "aria-valuenow": filled })}
      className={`loader ${small ? "loader-small" : ""} ${className}`.trim()}
      data-loader={filled === null ? "busy" : "share"}
    >
      <span style={filled === null ? undefined : { transform: `scaleX(${String(filled / 100)})` }} />
    </span>
  );
}

/**
 * The splash's waiting words with the bar under them, the column as wide as its widest line: the words pulse as the
 * opening's do, the bar under the first line so a second line (`more`) arrives below it and nothing moves.
 */
export function Waiting({ words, more = null, percent }: { words: string; more?: ReactNode; percent?: number }) {
  return (
    <div className="loader-column" data-waiting="">
      <p className="splash-words">{words}</p>
      <Loader label={words} {...(percent === undefined ? {} : { percent })} />
      {more === null ? null : <p className="splash-more">{more}</p>}
    </div>
  );
}
