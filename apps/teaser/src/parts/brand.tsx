// The seal and the name, drawn as the brand files draw them (apps/client/public/brand), so the two bulbs over the J can
// glow and the letters can scale to a title.
import { NAVY, YELLOW } from "./tokens";
import { WORDMARK_BOX, WORDMARK_PATH } from "./wordmark";

const LINE = "#eaf3fb";

/** The round seal: navy, two rings, the arc, the J and its two bulbs. `glow` from 0 to 1 lights the bulbs' halos. */
export function Seal({ size, glow = 0.7, id = "seal" }: { size: number; glow?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <radialGradient id={`${id}-warm`}>
          <stop offset="0" stopColor={YELLOW} stopOpacity={glow} />
          <stop offset="1" stopColor={YELLOW} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-cool`}>
          <stop offset="0" stopColor="#cfe9ff" stopOpacity={glow} />
          <stop offset="1" stopColor="#cfe9ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="256" cy="256" r="256" fill={NAVY} />
      <circle cx="256" cy="256" r="240" fill="none" stroke={LINE} strokeWidth="9" />
      <circle cx="256" cy="256" r="158" fill="none" stroke={LINE} strokeWidth="9" />
      <path d="M82.2 147.4A205 205 0 0 1 429.8 147.4" fill="none" stroke={LINE} strokeWidth="4" strokeLinecap="round" />
      <circle cx="176" cy="92.3" r={36 + 30 * glow} fill={`url(#${id}-warm)`} />
      <line x1="176" y1="67.3" x2="176" y2="71" stroke={LINE} strokeWidth="4" />
      <rect x="168.5" y="69" width="15" height="10.5" rx="2" fill={LINE} />
      <circle cx="176" cy="92.3" r="15" fill={glow > 0.05 ? YELLOW : "#8a7a3d"} />
      <circle cx="171.5" cy="87.8" r="4.2" fill="#fff" opacity=".7" />
      <circle cx="336" cy="91.6" r={27.6 + 24 * glow} fill={`url(#${id}-cool)`} />
      <line x1="336" y1="67.3" x2="336" y2="75.7" stroke={LINE} strokeWidth="4" />
      <rect x="330.2" y="73.7" width="11.5" height="8" rx="2" fill={LINE} />
      <circle cx="336" cy="91.6" r="11.5" fill={glow > 0.05 ? "#cfe9ff" : "#6f8196"} />
      <circle cx="332.6" cy="88.1" r="3.2" fill="#fff" opacity=".7" />
      <path d="M-40 -78H34V22A52 52 0 0 1 -70 22" fill="none" stroke={LINE} strokeWidth="48.6" transform="translate(256 256) scale(0.9) translate(18 2)" />
    </svg>
  );
}

/** The name in the wordmark's own letters, `height` pixels tall. */
export function Wordmark({ height, color = NAVY }: { height: number; color?: string }) {
  const width = (height * WORDMARK_BOX.width) / WORDMARK_BOX.height;
  return (
    <svg width={width} height={height} viewBox={`${String(WORDMARK_BOX.x)} ${String(WORDMARK_BOX.y)} ${String(WORDMARK_BOX.width)} ${String(WORDMARK_BOX.height)}`} style={{ display: "block" }}>
      <path d={WORDMARK_PATH} fill={color} />
    </svg>
  );
}
