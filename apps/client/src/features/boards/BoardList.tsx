// One board's lines (docs/rules/city.md R-CITY-040): rank, name and figure for
// the top lines, then the player's own line wherever it ranks. The name is the
// account's username on every board, friends too. Loaded
// only after the server has answered with a board, so a switched-off board's
// screen is never fetched. Each line is a card with a face sticker, the name,
// and the figure as a chip: this week's rise in green; the player's own line
// ringed (docs/design/13-the-lively-layer.md section 2).
import type { BoardReply, BoardRow } from "@japacity/api";
import { useEffect, useState } from "react";

import { lookForName } from "../../shared/frontdoor/looks";
import { assetUrl, loadManifest } from "../../shared/three/manifest";
import { TINTS } from "../../shared/ui/lively/tint";
import { formatNumber } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import type { When } from "./boards";
import { PERSON_KEY } from "../../shared/kept/storage";

function figureWords(row: BoardRow, when: When): string {
  const figure = formatNumber(row.figure);
  if (when === "all-time") return say("ui.boards.figure.all-time", { figure });
  return say(row.figure > 0 ? "ui.boards.figure.this-week.up" : "ui.boards.figure.this-week.down", { figure });
}

/** The line's name: the account's username; a quiet word for an account that is gone. */
function nameOf(row: BoardRow): string {
  return row.username ?? say("ui.boards.someone");
}

/**
 * The looks the door offers, each with its face tile published: named here so the boards' chunk carries none of the
 * city's roster (BoardsView.dress.test proves the list is the door's `LOOKS`).
 */
export const BOARD_FACES: readonly string[] = ["chr_ada", "chr_tunde", "chr_zainab", "chr_tobi", "chr_ngozi", "chr_femi", "chr_kemi", "chr_bisi", "chr_amaka", "chr_bayo", "chr_dayo", "chr_emeka", "chr_kunle", "chr_sade", "chr_segun", "chr_tolani"];

/**
 * The look kept from the door, or null. Read straight from the device so the boards' chunk shares no module with the
 * city's loader (a shared module there regroups the first visit's chunks).
 */
export function keptLook(): string | null {
  try {
    const kept: unknown = JSON.parse(window.localStorage.getItem(PERSON_KEY) ?? "null");
    const look = typeof kept === "object" && kept !== null ? (kept as { look?: unknown }).look : null;
    return typeof look === "string" ? look : null;
  } catch {
    return null;
  }
}

/**
 * The face on a line. No look travels on a board (R-CITY-040), so another player's face is one of the door's looks
 * picked from the name the line shows (`lookForName`), the same name always the same face; the player's own line wears the look they
 * built at the door, kept on this device, where there is one.
 */
export function boardFace(name: string, me: boolean, own: string | null = keptLook()): string {
  if (me && own !== null && BOARD_FACES.includes(own)) return own;
  // The one face picker the game has, so a name wears the same face on a board, a bond and a card.
  return lookForName(name);
}

/**
 * A look's face as a round sticker, the door's published face tile (`tiles/<look>-face.png`). Drawn here, not with the
 * door's own sticker, so the boards' chunk stays clear of the door's colours and the city's models.
 */
function Face({ look, me, tilt }: { look: string; me: boolean; tilt: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void loadManifest()
      .then((manifest) => {
        if (alive) setSrc(assetUrl(manifest, `tiles/${look}-face.png`));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [look]);
  return (
    <span className={`face-sticker ${TINTS[me ? "money" : "plain"]}`} style={{ width: 36, height: 36, rotate: `${String(tilt)}deg` }} data-face-sticker={look} aria-hidden>
      {src === null ? null : <img src={src} alt="" draggable={false} />}
    </span>
  );
}

function Line({ row, when }: { row: BoardRow; when: When }) {
  const name = nameOf(row);
  const rise = when === "this-week" && row.figure > 0;
  return (
    <li data-board-line={row.rank} data-me={row.me ? "true" : undefined} className={`lively-card flex min-h-14 items-center gap-3 px-3 py-2 ${row.me ? "phone-picked" : ""}`}>
      <span className="w-7 shrink-0 text-right text-[16px] font-bold tabular-nums" aria-label={say("ui.boards.rank", { rank: row.rank })}>
        {row.rank}
      </span>
      <Face look={boardFace(name, row.me)} me={row.me} tilt={row.rank % 2 === 0 ? 4 : -4} />
      <span className="min-w-0 flex-1 truncate text-[16px] font-bold" data-board-name>
        {name}
      </span>
      {row.me ? (
        <span className="pill shrink-0 px-2 py-0.5 text-[12px] font-bold" data-board-you>
          {say("ui.boards.you")}
        </span>
      ) : null}
      <span
        className={`sticker-chip shrink-0 text-[14px] tabular-nums ${rise ? "bg-tint-money" : "bg-sheet-2"}`}
        style={{ rotate: "-2deg", ...(rise ? { color: "var(--money-ink)" } : {}) }}
        data-board-figure={rise ? "rise" : "figure"}
      >
        {figureWords(row, when)}
      </span>
    </li>
  );
}

export default function BoardList({ reply, when, friends }: { reply: BoardReply; when: When; friends: boolean }) {
  const own = reply.own;
  const ownShown = own !== null && reply.rows.some((row) => row.me);
  // Above the list, so a player far down a long board sees their place without scrolling.
  const ownLine = ownShown ? null : (
    <div className="flex flex-col gap-1.5" data-board-own>
      <p className="px-0.5 text-[15px] font-semibold text-text-2">{say("ui.boards.your-place")}</p>
      {own === null ? (
        <p className="lively-card p-3 text-[15px]">{say("ui.boards.no-route")}</p>
      ) : (
        <ol>
          <Line row={own} when={when} />
        </ol>
      )}
    </div>
  );
  return (
    <div className="flex flex-col gap-2.5" data-board={reply.board}>
      {ownLine}
      {reply.rows.length === 0 ? (
        <p className="lively-card p-3 text-[15px] text-text-2">{say(friends ? "ui.boards.empty.friends" : "ui.boards.empty")}</p>
      ) : (
        <ol className="flex flex-col gap-2" data-board-lines>
          {reply.rows.map((row) => (
            <Line key={row.rank} row={row} when={when} />
          ))}
        </ol>
      )}
    </div>
  );
}
