// The seal and the name, drawn as the brand files draw them (apps/client/public/brand), so the two bulbs over the J can
// glow and the letters can scale to a title; and GitHub's own mark for the end cards' open source line.
import { NAVY, WORDMARK_BOX, WORDMARK_PATH, YELLOW } from "@japacity/brand";

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

/**
 * GitHub's mark (the Invertocat), as GitHub hands it out (https://github.com/logos, GitHub_Invertocat_White.svg, kept
 * unaltered beside this file): the same box and the same path, only its fill set, so it can stand in cream on the navy.
 * GitHub allows the mark to say a project lives on GitHub, never changed in shape and never the biggest thing in sight.
 */
export const GITHUB_MARK = { width: 98, height: 96, path: "M41.4395 69.3848C28.8066 67.8535 19.9062 58.7617 19.9062 46.9902C19.9062 42.2051 21.6289 37.0371 24.5 33.5918C23.2559 30.4336 23.4473 23.7344 24.8828 20.959C28.7109 20.4805 33.8789 22.4902 36.9414 25.2656C40.5781 24.1172 44.4062 23.543 49.0957 23.543C53.7852 23.543 57.6133 24.1172 61.0586 25.1699C64.0254 22.4902 69.2891 20.4805 73.1172 20.959C74.457 23.543 74.6484 30.2422 73.4043 33.4961C76.4668 37.1328 78.0937 42.0137 78.0937 46.9902C78.0937 58.7617 69.1934 67.6621 56.3691 69.2891C59.623 71.3945 61.8242 75.9883 61.8242 81.252L61.8242 91.2051C61.8242 94.0762 64.2168 95.7031 67.0879 94.5547C84.4102 87.9512 98 70.6289 98 49.1914C98 22.1074 75.9883 6.69539e-07 48.9043 4.309e-07C21.8203 1.92261e-07 -1.9479e-07 22.1074 -4.3343e-07 49.1914C-6.20631e-07 70.4375 13.4941 88.0469 31.6777 94.6504C34.2617 95.6074 36.75 93.8848 36.75 91.3008L36.75 83.6445C35.4102 84.2188 33.6875 84.6016 32.1562 84.6016C25.8398 84.6016 22.1074 81.1563 19.4277 74.7441C18.375 72.1602 17.2266 70.6289 15.0254 70.3418C13.877 70.2461 13.4941 69.7676 13.4941 69.1934C13.4941 68.0449 15.4082 67.1836 17.3223 67.1836C20.0977 67.1836 22.4902 68.9063 24.9785 72.4473C26.8926 75.2227 28.9023 76.4668 31.2949 76.4668C33.6875 76.4668 35.2187 75.6055 37.4199 73.4043C39.0469 71.7773 40.291 70.3418 41.4395 69.3848Z" } as const;

/** GitHub's mark, `height` pixels tall, in one colour. */
export function GitHubMark({ height, color }: { height: number; color: string }) {
  return (
    <svg data-github-mark width={(height * GITHUB_MARK.width) / GITHUB_MARK.height} height={height} viewBox={`0 0 ${String(GITHUB_MARK.width)} ${String(GITHUB_MARK.height)}`} fill="none" style={{ display: "block", flex: "none" }}>
      <path d={GITHUB_MARK.path} fill={color} />
    </svg>
  );
}
