// Every raster picture a screen shows, measured as the screen draws it (prologue:front-door-three-screens): each image,
// each CSS background (an element's own and its ::before and ::after), each video's poster, each SVG <image> and each
// canvas, with its source's own pixels, the box it is drawn into in CSS pixels after transforms, and its scale: the device
// pixels it covers over the source pixels behind them. Over 1 is soft. A vector file is listed with no scale.
import type { Page } from "@playwright/test";

export interface Raster {
  kind: "img" | "background" | "poster" | "svg-image" | "canvas";
  /** The source: a path on this origin, the start of a data or blob URL, or the canvas's place. */
  source: string;
  /** The source's own pixels. */
  natural: { width: number; height: number };
  /** The picture as drawn, in CSS pixels after transforms (for a cover, the whole picture, past the box it is cut to). */
  drawn: { width: number; height: number };
  /** The box it fills, in CSS pixels after transforms. */
  box: { width: number; height: number };
  ratio: number;
  /** Device pixels over source pixels, the larger of the two directions; null for a vector picture. */
  scale: number | null;
  /** The element's marks, enough to find it again: its tag and its data attributes. */
  where: string;
}

/** The rasters on the screen now, in the viewport and not hidden, one a picture and box. */
export async function rastersOnScreen(page: Page): Promise<Raster[]> {
  return page.evaluate(async () => {
    const ratio = window.devicePixelRatio;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const found: Raster[] = [];
    const sizes = new Map<string, Promise<{ width: number; height: number } | null>>();
    const round = (n: number) => Math.round(n * 100) / 100;

    function naturalOf(url: string): Promise<{ width: number; height: number } | null> {
      let known = sizes.get(url);
      if (known === undefined) {
        const picture = new Image();
        picture.src = url;
        known = picture
          .decode()
          .then(() => ({ width: picture.naturalWidth, height: picture.naturalHeight }))
          .catch(() => null);
        sizes.set(url, known);
      }
      return known;
    }

    function sourceOf(url: string): string {
      if (url.startsWith("data:") || url.startsWith("blob:")) return `${url.slice(0, 40)}...`;
      try {
        const parsed = new URL(url, location.href);
        return parsed.origin === location.origin ? parsed.pathname : parsed.href;
      } catch {
        return url;
      }
    }

    const isVector = (url: string) => /\.svg(\?|#|$)/i.test(url) || url.startsWith("data:image/svg");

    function whereOf(element: Element, pseudo = ""): string {
      const marks = [...element.attributes].filter((attribute) => attribute.name.startsWith("data-")).map((attribute) => (attribute.value === "" ? attribute.name : `${attribute.name}=${attribute.value.slice(0, 30)}`));
      let parent = element.parentElement;
      // The nearest marked ancestor names the surface where the element itself carries none.
      while (marks.length === 0 && parent !== null) {
        const near = [...parent.attributes].filter((attribute) => attribute.name.startsWith("data-")).map((attribute) => attribute.name);
        if (near.length > 0) marks.push(`in ${near.slice(0, 2).join(" ")}`);
        parent = parent.parentElement;
      }
      return `${element.tagName.toLowerCase()}${pseudo}${marks.length > 0 ? ` [${marks.slice(0, 3).join(" ")}]` : ""}`;
    }

    /** Hidden by itself or by an ancestor: no layout, visibility hidden, or opacity 0 on the way up. */
    function hidden(element: Element): boolean {
      if (getComputedStyle(element).visibility === "hidden") return true;
      for (let at: Element | null = element; at !== null; at = at.parentElement) if (getComputedStyle(at).opacity === "0") return true;
      return false;
    }

    function onScreen(rect: DOMRect): boolean {
      return rect.width >= 1 && rect.height >= 1 && rect.right > 0 && rect.bottom > 0 && rect.left < viewW && rect.top < viewH;
    }

    /**
     * The CSS pixels each layout pixel of the element is drawn at: the scale of every transform on the way up (a turn
     * leaves the size as it is, where the bounding box of a turned card would grow), and the `scale` property.
     */
    function transformOf(element: Element): { x: number; y: number } {
      let x = 1;
      let y = 1;
      for (let at: Element | null = element; at !== null; at = at.parentElement) {
        const style = getComputedStyle(at);
        if (style.transform !== "none") {
          const matrix = new DOMMatrixReadOnly(style.transform);
          x *= Math.hypot(matrix.a, matrix.b);
          y *= Math.hypot(matrix.c, matrix.d);
        }
        if (style.scale !== "none") {
          const [sx = 1, sy = sx] = style.scale.split(/\s+/).map(Number);
          x *= sx;
          y *= sy;
        }
      }
      return { x, y };
    }

    function push(kind: Raster["kind"], url: string, natural: { width: number; height: number }, drawn: { width: number; height: number }, box: { width: number; height: number }, where: string): void {
      const scale = isVector(url) || natural.width === 0 ? null : round(Math.max(drawn.width / natural.width, drawn.height / natural.height) * ratio);
      found.push({ kind, source: kind === "canvas" ? url : sourceOf(url), natural, drawn: { width: round(drawn.width), height: round(drawn.height) }, box: { width: round(box.width), height: round(box.height) }, ratio, scale, where });
    }

    /** How a picture of `natural` pixels is drawn into a box by object-fit or background-size. */
    function fit(mode: string, natural: { width: number; height: number }, box: { width: number; height: number }): { width: number; height: number } {
      const sx = box.width / natural.width;
      const sy = box.height / natural.height;
      if (mode === "cover") return { width: natural.width * Math.max(sx, sy), height: natural.height * Math.max(sx, sy) };
      if (mode === "contain") return { width: natural.width * Math.min(sx, sy), height: natural.height * Math.min(sx, sy) };
      if (mode === "scale-down") {
        const s = Math.min(1, sx, sy);
        return { width: natural.width * s, height: natural.height * s };
      }
      if (mode === "none") return natural;
      return box;
    }

    /** background-size for one layer: cover, contain, or a width and a height each a length, a percentage or auto. */
    function backgroundDrawn(size: string, natural: { width: number; height: number }, box: { width: number; height: number }): { width: number; height: number } {
      if (size === "cover" || size === "contain") return fit(size, natural, box);
      const [first = "auto", second = "auto"] = size.split(/\s+/);
      const length = (value: string, whole: number): number | null => (value === "auto" ? null : value.endsWith("%") ? (Number.parseFloat(value) / 100) * whole : Number.parseFloat(value));
      const width = length(first, box.width);
      const height = length(second, box.height);
      if (width !== null && height !== null) return { width, height };
      if (width !== null) return { width, height: (width * natural.height) / natural.width };
      if (height !== null) return { width: (height * natural.width) / natural.height, height };
      return natural;
    }

    const urlsIn = (value: string) => [...value.matchAll(/url\("?([^")]+)"?\)/g)].map((match) => match[1] ?? "");

    const jobs: Promise<void>[] = [];
    for (const element of document.querySelectorAll("*")) {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) continue;
      const rect = element.getBoundingClientRect();
      if (!onScreen(rect) || hidden(element)) continue;
      const scaleBy = transformOf(element);
      const style = getComputedStyle(element);

      if (element instanceof HTMLImageElement && element.currentSrc !== "") {
        const box = { width: (element.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)) * scaleBy.x, height: (element.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)) * scaleBy.y };
        // The source's own pixels, read apart: an image chosen from a srcset by width reports its natural size divided by
        // the density the choice gave it, not its pixels.
        const url = element.currentSrc;
        const where = whereOf(element);
        const fitting = style.objectFit;
        jobs.push(
          naturalOf(url).then((natural) => {
            if (natural !== null && natural.width > 0) push("img", url, natural, fit(fitting, natural, box), box, where);
          }),
        );
      }
      if (element instanceof HTMLVideoElement && element.poster !== "") {
        const url = element.poster;
        const box = { width: element.clientWidth * scaleBy.x, height: element.clientHeight * scaleBy.y };
        jobs.push(
          naturalOf(url).then((natural) => {
            if (natural !== null) push("poster", url, natural, fit(style.objectFit, natural, box), box, whereOf(element));
          }),
        );
      }
      if (element instanceof SVGImageElement) {
        const url = element.href.baseVal;
        const box = { width: element.width.baseVal.value * scaleBy.x, height: element.height.baseVal.value * scaleBy.y };
        jobs.push(
          naturalOf(new URL(url, location.href).href).then((natural) => {
            if (natural !== null) push("svg-image", url, natural, fit("contain", natural, box), box, whereOf(element));
          }),
        );
      }
      if (element instanceof HTMLCanvasElement && element.clientWidth > 0) {
        const box = { width: element.clientWidth * scaleBy.x, height: element.clientHeight * scaleBy.y };
        const natural = { width: element.width, height: element.height };
        push("canvas", `canvas ${element.closest("[data-city]") !== null ? "(the city)" : ""}`.trim(), natural, box, box, whereOf(element));
      }

      for (const pseudo of ["", "::before", "::after"]) {
        const layer = pseudo === "" ? style : getComputedStyle(element, pseudo);
        if (layer.backgroundImage === "none" || !layer.backgroundImage.includes("url(")) continue;
        if (pseudo !== "" && layer.content === "none") continue;
        // A pseudo element's box is its computed size; an element's background fills its padding box.
        const box =
          pseudo === ""
            ? element instanceof HTMLElement
              ? { width: element.clientWidth * scaleBy.x, height: element.clientHeight * scaleBy.y }
              : { width: rect.width, height: rect.height }
            : { width: Number.parseFloat(layer.width) * scaleBy.x, height: Number.parseFloat(layer.height) * scaleBy.y };
        if (!(box.width >= 1 && box.height >= 1)) continue;
        const sizesOf = layer.backgroundSize.split(",").map((one) => one.trim());
        urlsIn(layer.backgroundImage).forEach((url, at) => {
          const size = sizesOf[at] ?? sizesOf[0] ?? "auto";
          jobs.push(
            naturalOf(url).then((natural) => {
              if (natural === null) return;
              // The background is drawn in layout pixels, then transformed with its element.
              const unscaled = { width: box.width / scaleBy.x, height: box.height / scaleBy.y };
              const drawn = backgroundDrawn(size, natural, unscaled);
              push("background", url, natural, { width: drawn.width * scaleBy.x, height: drawn.height * scaleBy.y }, box, whereOf(element, pseudo));
            }),
          );
        });
      }
    }
    await Promise.all(jobs);
    return found;
  });
}

/** The largest of each source's scales on a screen, one row a source and kind, worst first. */
export function worstBySource(rasters: readonly Raster[]): Raster[] {
  const worst = new Map<string, Raster>();
  for (const raster of rasters) {
    const key = `${raster.kind} ${raster.source} ${raster.where}`;
    const kept = worst.get(key);
    if (kept === undefined || (raster.scale ?? 0) > (kept.scale ?? 0)) worst.set(key, raster);
  }
  return [...worst.values()].sort((a, b) => (b.scale ?? 0) - (a.scale ?? 0));
}
