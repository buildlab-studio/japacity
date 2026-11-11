// The admin page's charts, drawn in plain SVG (admin:sections-alarms-first): an area chart of a daily series with a faint
// grid and the last point marked, and a shaded grid of two bands. One scale per chart, every label inside the box.
import { useId } from "react";

import { words } from "./admin.words";

export interface Series {
  /** One point a day; null where the server hid the count. */
  values: readonly (number | null)[];
  /** A thinner line drawn under the main one. */
  thin?: readonly (number | null)[];
  /** The label under the first, middle and last point. */
  labels: readonly [string, string, string];
  title: string;
}

const WIDTH = 640;
const HEIGHT = 180;
const LEFT = 40;
const RIGHT = 12;
const TOP = 12;
const BOTTOM = 24;

function niceTop(highest: number): number {
  if (highest <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(highest));
  const unit = highest / magnitude;
  const step = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10;
  return step * magnitude;
}

function path(values: readonly (number | null)[], top: number, close: boolean): string {
  const span = WIDTH - LEFT - RIGHT;
  const floor = HEIGHT - BOTTOM;
  const step = values.length > 1 ? span / (values.length - 1) : 0;
  const parts: string[] = [];
  let open = false;
  values.forEach((value, at) => {
    if (value === null) {
      open = false;
      return;
    }
    const x = LEFT + at * step;
    const y = floor - ((floor - TOP) * value) / top;
    parts.push(`${open ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
    open = true;
  });
  if (close && parts.length > 0) {
    const last = values.findLastIndex((value) => value !== null);
    const first = values.findIndex((value) => value !== null);
    parts.push(`L${(LEFT + last * step).toFixed(1)} ${String(floor)}`, `L${(LEFT + first * step).toFixed(1)} ${String(floor)}`, "Z");
  }
  return parts.join(" ");
}

/** A daily series as an area under a line, the last point marked. */
export function AreaChart({ values, thin, labels, title }: Series) {
  const id = useId();
  const highest = Math.max(0, ...values.filter((value): value is number => value !== null), ...(thin ?? []).filter((value): value is number => value !== null));
  const top = niceTop(highest);
  const floor = HEIGHT - BOTTOM;
  const lines = [0, 0.5, 1].map((share) => ({ y: floor - (floor - TOP) * share, label: String(Math.round(top * share)) }));
  const last = values.findLastIndex((value) => value !== null);
  const step = values.length > 1 ? (WIDTH - LEFT - RIGHT) / (values.length - 1) : 0;
  const lastValue = last >= 0 ? values[last] : null;
  return (
    <svg viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`} role="img" aria-labelledby={id} className="block h-auto w-full max-w-full">
      <title id={id}>{title}</title>
      {lines.map((line) => (
        <g key={line.label}>
          <line x1={LEFT} y1={line.y} x2={WIDTH - RIGHT} y2={line.y} stroke="var(--sheet-line)" strokeWidth="1" />
          <text x={LEFT - 6} y={line.y + 3} textAnchor="end" fontSize="10" fill="var(--text-2)">
            {line.label}
          </text>
        </g>
      ))}
      {values.some((value) => value !== null) ? (
        <>
          <path d={path(values, top, true)} fill="var(--accent)" opacity="0.12" />
          <path d={path(values, top, false)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        </>
      ) : null}
      {thin === undefined ? null : <path d={path(thin, top, false)} fill="none" stroke="var(--text-2)" strokeWidth="1" strokeLinejoin="round" />}
      {lastValue === null || lastValue === undefined ? null : <circle cx={LEFT + last * step} cy={floor - ((floor - TOP) * lastValue) / top} r="4" fill="var(--accent)" />}
      <text x={LEFT} y={HEIGHT - 6} fontSize="10" fill="var(--text-2)">
        {labels[0]}
      </text>
      <text x={LEFT + (WIDTH - LEFT - RIGHT) / 2} y={HEIGHT - 6} fontSize="10" fill="var(--text-2)" textAnchor="middle">
        {labels[1]}
      </text>
      <text x={WIDTH - RIGHT} y={HEIGHT - 6} fontSize="10" fill="var(--text-2)" textAnchor="end">
        {labels[2]}
      </text>
    </svg>
  );
}

export interface GridCell {
  row: string;
  column: string;
  /** The count as words, and its size for the shade; null shades nothing. */
  text: string;
  size: number | null;
}

/** Two bands as a shaded grid: rows down, columns across, each cell shaded by its share of the largest count. */
export function HeatGrid({ caption, rows, columns, cells, corner }: { caption: string; rows: readonly { key: string; label: string }[]; columns: readonly { key: string; label: string }[]; cells: readonly GridCell[]; corner: string }) {
  const largest = Math.max(1, ...cells.map((cell) => cell.size ?? 0));
  const find = (row: string, column: string) => cells.find((cell) => cell.row === row && cell.column === column);
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-text-2">
              {corner}
            </th>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="px-2 py-1 text-center text-xs font-medium whitespace-nowrap text-text-2">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="px-2 py-1 text-left text-xs font-medium whitespace-nowrap text-text-2">
                {row.label}
              </th>
              {columns.map((column) => {
                const cell = find(row.key, column.key);
                const share = cell?.size === null || cell?.size === undefined ? 0 : cell.size / largest;
                return (
                  <td key={column.key} className="admin-grid-cell rounded px-2 py-1.5 text-center" data-deep={share > 0.55 ? "true" : "false"} style={{ "--share": share.toFixed(2) } as React.CSSProperties}>
                    {cell?.text ?? words("admin.no-data")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
