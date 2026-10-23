// What a screen offers to a thumb and an eye (world:reach-and-read), measured as the screen draws it: every control a tap can reach,
// with its hit area (its box, or the larger pad a `.reach` control lays round it), and every line of text with its size in CSS
// pixels after transforms. Only what a tap or a look can reach counts: in the viewport, shown, and not under something else.
import type { Page } from "@playwright/test";

export interface Small {
  /** The tag, its data attributes and its words, enough to find it again. */
  where: string;
  width: number;
  height: number;
}

export interface Reach {
  /** Controls whose hit area is under 44 by 44 CSS pixels. */
  targets: Small[];
  /** Text drawn under 12 CSS pixels: `height` holds its size. */
  texts: Small[];
}

/** The controls under 44 px and the text under 12 px on the screen now. */
export function reachOnScreen(page: Page): Promise<Reach> {
  return page.evaluate(() => {
    const MIN_HIT = 44;
    const MIN_TEXT = 12;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const round = (n: number) => Math.round(n * 10) / 10;

    function whereOf(element: Element): string {
      const data = [...element.attributes].filter((attribute) => attribute.name.startsWith("data-") || attribute.name === "aria-label").map((attribute) => `[${attribute.name}="${attribute.value.slice(0, 40)}"]`);
      const words = (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
      return `${element.tagName.toLowerCase()}${data.join("")}${words === "" ? "" : ` "${words}"`}`;
    }

    function shown(element: Element): boolean {
      if (element.closest("[inert]") !== null) return false;
      for (let at: Element | null = element; at !== null; at = at.parentElement) {
        const style = getComputedStyle(at);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      }
      return true;
    }

    /** The part of a box inside the viewport, or null. */
    function onScreen(box: DOMRect): DOMRect | null {
      const left = Math.max(0, box.left);
      const top = Math.max(0, box.top);
      const right = Math.min(viewW, box.right);
      const bottom = Math.min(viewH, box.bottom);
      if (right - left < 1 || bottom - top < 1) return null;
      return new DOMRect(left, top, right - left, bottom - top);
    }

    /** True when a tap or a look at the middle of `box` lands on `element` (or inside it), not on something over it. */
    function onTop(element: Element, box: DOMRect): boolean {
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit !== null && (hit === element || element.contains(hit) || hit.contains(element));
    }

    const CONTROLS = "button, a[href], input:not([type='hidden']), select, textarea, summary, [role='button'], [role='link'], [role='tab'], [role='switch'], [role='checkbox'], [role='radio'], [role='menuitem'], [role='option'], [role='slider']";
    const targets: Small[] = [];
    for (const element of document.querySelectorAll(CONTROLS)) {
      if ((element as HTMLButtonElement).disabled === true) continue;
      if (!shown(element)) continue;
      // A control inside another control is the outer one's tap.
      if (element.parentElement?.closest(CONTROLS) !== null && element.parentElement?.closest(CONTROLS) !== undefined) continue;
      const box = element.getBoundingClientRect();
      const visible = onScreen(box);
      if (visible === null || !onTop(element, visible)) continue;
      // A `.reach` control lays its pad round itself as ::after; the pad is the hit area where it is larger, unless the control clips
      // what overflows it, which cuts the pad to its own box.
      const pad = getComputedStyle(element, "::after");
      const own = getComputedStyle(element);
      const clips = own.overflowX !== "visible" || own.overflowY !== "visible";
      const padded = !clips && pad.content !== "none" && pad.position === "absolute";
      const width = Math.max(box.width, padded ? parseFloat(pad.width) || 0 : 0);
      const height = Math.max(box.height, padded ? parseFloat(pad.height) || 0 : 0);
      if (width + 0.5 < MIN_HIT || height + 0.5 < MIN_HIT) targets.push({ where: whereOf(element), width: round(width), height: round(height) });
    }

    const texts: Small[] = [];
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if ((node.textContent ?? "").trim() === "") continue;
      const parent = node.parentElement;
      if (parent === null || seen.has(parent)) continue;
      if (parent.closest("script, style, noscript, title, .sr-only") !== null) continue;
      if (!shown(parent)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      const visible = onScreen(box);
      if (visible === null || box.width < 2 || box.height < 2 || !onTop(parent, visible)) continue;
      seen.add(parent);
      // The size as drawn: the computed size times the scale the element is drawn at.
      const size = parseFloat(getComputedStyle(parent).fontSize);
      let scale = 1;
      if (parent instanceof SVGGraphicsElement) {
        const matrix = parent.getScreenCTM();
        if (matrix !== null) scale = Math.hypot(matrix.a, matrix.b);
      } else {
        // The scale every transform from the element up draws it at, turning aside (rotation keeps the size).
        for (let at: Element | null = parent; at !== null; at = at.parentElement) {
          const style = getComputedStyle(at);
          const matrix = /^matrix(?:3d)?\(([^)]+)\)$/.exec(style.transform)?.[1]?.split(",").map(Number);
          if (matrix !== undefined && matrix.length >= 2) scale *= Math.hypot(matrix[0] ?? 1, matrix[1] ?? 0);
          const own = style.scale === "none" || style.scale === "" ? 1 : Number(style.scale.split(" ")[0]);
          if (Number.isFinite(own) && own > 0) scale *= own;
        }
      }
      const drawnSize = size * scale;
      if (drawnSize + 0.05 < MIN_TEXT) texts.push({ where: whereOf(parent), width: round(box.width), height: round(drawnSize) });
    }
    return { targets, texts };
  });
}
