// The compositions behind a card's words (share:card-art-shows-no-face):
// places, objects and people seen from behind, drawn in code from the asset
// palette. No face, no logo, no crest, no lettering: a person is a single
// colour shape with no features, and nothing here draws text.
import type { PaletteName } from "../../../../../packages/assets/src/palette";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Shape =
  | { op: "rect"; x: number; y: number; w: number; h: number; color: PaletteName }
  | { op: "poly"; points: [number, number][]; color: PaletteName }
  | { op: "circle"; x: number; y: number; r: number; color: PaletteName }
  | { op: "line"; x1: number; y1: number; x2: number; y2: number; width: number; color: PaletteName };

/** Places drawn in thousandths of the box, so a composition fits any card or preview. */
interface Pen {
  rect(x0: number, y0: number, x1: number, y1: number, color: PaletteName): void;
  poly(points: [number, number][], color: PaletteName): void;
  /** A circle whose radius is in thousandths of the box's width. */
  circle(x: number, y: number, r: number, color: PaletteName): void;
  line(x1: number, y1: number, x2: number, y2: number, width: number, color: PaletteName): void;
  shapes: Shape[];
}

function penFor(box: Box): Pen {
  const shapes: Shape[] = [];
  const px = (fx: number) => Math.round(box.x + (box.w * fx) / 1000);
  const py = (fy: number) => Math.round(box.y + (box.h * fy) / 1000);
  return {
    shapes,
    rect(x0, y0, x1, y1, color) {
      shapes.push({ op: "rect", x: px(x0), y: py(y0), w: px(x1) - px(x0), h: py(y1) - py(y0), color });
    },
    poly(points, color) {
      shapes.push({ op: "poly", points: points.map(([fx, fy]) => [px(fx), py(fy)]), color });
    },
    circle(x, y, r, color) {
      shapes.push({ op: "circle", x: px(x), y: py(y), r: Math.max(1, Math.round((box.w * r) / 1000)), color });
    },
    line(x1, y1, x2, y2, width, color) {
      shapes.push({ op: "line", x1: px(x1), y1: py(y1), x2: px(x2), y2: py(y2), width: Math.max(1, Math.round((box.w * width) / 1000)), color });
    },
  };
}

/**
 * A person seen from behind: a round head, shoulders, a body and legs in one
 * colour, with no features. `height` is in thousandths of the box's height.
 */
function figure(pen: Pen, x: number, foot: number, height: number, color: PaletteName, aspect: number): void {
  const unit = height / 10;
  // Widths are in thousandths of the box's width; `aspect` is the box's height over its width, in thousandths.
  const wide = (value: number) => Math.round((value * aspect) / 1000);
  const top = foot - height;
  pen.circle(x, top + unit, Math.max(1, Math.round((unit * aspect) / 1000)), color);
  pen.poly(
    [
      [x - wide(unit * 2), top + unit * 3],
      [x + wide(unit * 2), top + unit * 3],
      [x + wide(Math.round(unit * 1.5)), top + unit * 6],
      [x - wide(Math.round(unit * 1.5)), top + unit * 6],
    ],
    color,
  );
  pen.rect(x - wide(Math.round(unit * 0.8)), top + Math.round(unit * 2.2), x + wide(Math.round(unit * 0.8)), top + unit * 3, color);
  pen.rect(x - wide(Math.round(unit * 1.4)), top + unit * 6, x - wide(Math.round(unit * 0.2)), foot, color);
  pen.rect(x + wide(Math.round(unit * 0.2)), top + unit * 6, x + wide(Math.round(unit * 1.4)), foot, color);
}

/** Rows of buildings along a skyline, each with a few windows. */
function skyline(pen: Pen, base: number, heights: number[], color: PaletteName, windows: PaletteName | null): void {
  const width = Math.floor(1000 / heights.length);
  heights.forEach((height, index) => {
    const left = index * width;
    pen.rect(left, base - height, left + width - 6, base, color);
    if (windows === null) return;
    for (let row = base - height + 30; row < base - 30; row += 60) {
      for (let column = left + 18; column < left + width - 30; column += 40) {
        if ((row + column + index) % 3 === 0) pen.rect(column, row, column + 14, row + 22, windows);
      }
    }
  });
}

function danfo(pen: Pen, left: number, base: number, length: number): void {
  const top = base - Math.round(length * 0.42);
  pen.rect(left, top, left + length, base - 30, "danfoYellow");
  pen.rect(left, base - 70, left + length, base - 55, "black");
  for (let window = left + 20; window < left + length - 60; window += 70) pen.rect(window, top + 20, window + 52, top + 70, "glass");
  pen.circle(left + Math.round(length * 0.22), base - 24, 22, "tyre");
  pen.circle(left + Math.round(length * 0.78), base - 24, 22, "tyre");
}

/** A plane climbing away, drawn from a side view in hundredths of `size` and turned by `climb` degrees. */
function plane(pen: Pen, x: number, y: number, size: number, climb: number, color: PaletteName, aspect: number): void {
  const turn = (climb * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const at = (px: number, py: number): [number, number] => {
    const along = (px * size) / 100;
    const across = (py * size) / 100;
    return [Math.round(x + along * cos + across * sin), Math.round(y + ((-along * sin + across * cos) * 1000) / aspect)];
  };
  const part = (points: [number, number][]) => pen.poly(points.map(([px, py]) => at(px, py)), color);
  part([[-100, -6], [88, -6], [100, 0], [88, 7], [-100, 7]]);
  part([[-96, -6], [-80, -6], [-98, -42], [-108, -42]]);
  part([[-92, 5], [-80, 5], [-100, 22], [-110, 22]]);
  part([[-14, -5], [16, -5], [-26, -62], [-40, -62]]);
  part([[-14, 6], [18, 6], [-30, 78], [-48, 78]]);
}

type Composer = (pen: Pen, aspect: number) => void;

const COMPOSITIONS: Record<string, Composer> = {
  "art.lagos-dusk": (pen, aspect) => {
    pen.rect(0, 0, 1000, 400, "orange");
    pen.rect(0, 400, 1000, 560, "wallPeach");
    pen.circle(700, 430, 90, "danfoYellow");
    skyline(pen, 640, [180, 260, 140, 320, 220, 160, 280, 200], "charcoal", "cream");
    pen.rect(0, 640, 1000, 760, "glass");
    pen.line(80, 690, 300, 690, 4, "marking");
    pen.line(520, 720, 820, 720, 4, "marking");
    pen.rect(0, 760, 1000, 1000, "asphalt");
    pen.line(0, 880, 1000, 880, 6, "marking");
    danfo(pen, 80, 900, 420);
    figure(pen, 760, 990, 300, "black", aspect);
  },
  "art.paper-desk": (pen, aspect) => {
    pen.rect(0, 0, 1000, 1000, "wallCream");
    pen.rect(560, 80, 940, 460, "indigo");
    skyline(pen, 460, [120, 200, 90, 160, 240], "black", "danfoYellow");
    pen.rect(540, 60, 960, 80, "darkWood");
    pen.rect(540, 460, 960, 480, "darkWood");
    pen.rect(0, 640, 1000, 700, "wood");
    pen.rect(40, 700, 80, 1000, "darkWood");
    pen.rect(920, 700, 960, 1000, "darkWood");
    pen.rect(120, 560, 420, 600, "tan");
    pen.rect(140, 520, 400, 560, "khaki");
    pen.rect(110, 480, 430, 520, "cream");
    pen.rect(130, 600, 410, 640, "blue");
    pen.line(300, 300, 360, 640, 10, "charcoal");
    pen.poly([[240, 300], [380, 300], [340, 220], [280, 220]], "charcoal");
    pen.poly([[250, 300], [370, 300], [430, 520], [190, 520]], "cream");
    figure(pen, 700, 1000, 420, "black", aspect);
  },
  "art.waiting-bench": (pen, aspect) => {
    pen.rect(0, 0, 1000, 760, "wallSky");
    pen.rect(0, 760, 1000, 1000, "concrete");
    pen.rect(560, 160, 860, 760, "roofBlue");
    pen.rect(580, 180, 840, 760, "wallSkyWorn");
    pen.circle(800, 470, 14, "zinc");
    pen.circle(300, 220, 70, "white");
    pen.line(300, 220, 300, 170, 6, "black");
    pen.line(300, 220, 340, 230, 6, "black");
    pen.rect(60, 760, 500, 800, "wood");
    pen.rect(80, 800, 110, 900, "darkWood");
    pen.rect(450, 800, 480, 900, "darkWood");
    figure(pen, 200, 900, 360, "black", aspect);
    figure(pen, 380, 900, 330, "wine", aspect);
  },
  "art.runway-lagoon": (pen, aspect) => {
    pen.rect(0, 0, 1000, 300, "orange");
    pen.rect(0, 300, 1000, 560, "sky");
    pen.circle(230, 520, 110, "danfoYellow");
    pen.rect(0, 560, 1000, 1000, "blue");
    skyline(pen, 600, [40, 70, 30, 90, 50, 60, 40, 80, 30, 50], "charcoal", null);
    // Fewer, wider ripples: thin lines on the blue cost the JPEG the most (share:card-drawn-on-device).
    for (let row = 660; row < 1000; row += 110) pen.line(60 + (row % 140), row, 360 + (row % 140), row, 6, "marking");
    for (let row = 720; row < 1000; row += 130) pen.line(560 - (row % 120), row, 900 - (row % 120), row, 6, "glass");
    plane(pen, 660, 220, 260, 14, "black", aspect);
  },
  "art.cold-street": (pen, aspect) => {
    pen.rect(0, 0, 1000, 1000, "concrete");
    skyline(pen, 760, [520, 420, 600, 380, 480], "concreteWorn", "cream");
    for (let column = 40; column < 1000; column += 90) pen.line(column, 40 + (column % 200), column - 30, 140 + (column % 200), 3, "white");
    pen.rect(0, 760, 1000, 1000, "asphalt");
    pen.line(0, 860, 1000, 860, 6, "marking");
    figure(pen, 520, 990, 420, "charcoal", aspect);
    pen.rect(600, 860, 690, 990, "wine");
    pen.rect(630, 830, 660, 860, "black");
  },
  "art.lit-window": (pen, aspect) => {
    pen.rect(0, 0, 1000, 1000, "indigo");
    pen.rect(120, 80, 880, 1000, "wallCreamWorn");
    pen.rect(220, 200, 780, 780, "cream");
    pen.rect(220, 470, 780, 490, "darkWood");
    pen.rect(490, 200, 510, 780, "darkWood");
    pen.rect(220, 780, 780, 820, "darkWood");
    pen.poly([[600, 780], [700, 780], [680, 700], [620, 700]], "laterite");
    pen.circle(650, 650, 50, "green");
    pen.circle(620, 600, 36, "pepper");
    figure(pen, 360, 780, 400, "black", aspect);
  },
  "art.lagos-lights": (pen, aspect) => {
    pen.rect(0, 0, 1000, 1000, "black");
    pen.circle(820, 140, 60, "cream");
    skyline(pen, 760, [260, 200, 320, 240, 180, 280], "indigo", "danfoYellow");
    pen.rect(0, 760, 1000, 1000, "asphalt");
    const lights: PaletteName[] = ["danfoYellow", "red", "green", "white", "teal"];
    for (let step = 0; step < 20; step += 1) {
      const x = 25 + step * 50;
      const sag = Math.abs(step - 10) * 6;
      pen.circle(x, 340 - sag, 9, lights[step % lights.length] ?? "white");
    }
    pen.line(0, 280, 1000, 280, 2, "zinc");
    figure(pen, 300, 990, 340, "wine", aspect);
    figure(pen, 450, 990, 380, "charcoal", aspect);
    figure(pen, 590, 990, 240, "gold", aspect);
  },
  "art.bunting": (pen) => {
    pen.rect(0, 0, 1000, 1000, "purple");
    const flags: PaletteName[] = ["danfoYellow", "red", "green", "white", "teal", "orange"];
    for (const [row, top] of [
      [0, 120],
      [1, 380],
      [2, 640],
    ] as const) {
      pen.line(0, top, 1000, top + 40, 3, "white");
      for (let step = 0; step < 10; step += 1) {
        const left = step * 100 + (row % 2) * 50;
        pen.poly([[left, top + step * 4], [left + 80, top + step * 4 + 3], [left + 40, top + step * 4 + 130]], flags[(step + row) % flags.length] ?? "white");
      }
    }
    for (let step = 0; step < 30; step += 1) pen.circle((step * 337) % 1000, 880 + ((step * 53) % 110), 6, flags[step % flags.length] ?? "white");
  },
  "art.desert-road": (pen) => {
    pen.rect(0, 0, 1000, 520, "sky");
    pen.poly([[0, 520], [300, 440], [620, 500], [1000, 430], [1000, 1000], [0, 1000]], "sand");
    pen.poly([[0, 700], [400, 620], [1000, 720], [1000, 1000], [0, 1000]], "tan");
    pen.poly([[460, 520], [540, 520], [760, 1000], [240, 1000]], "laterite");
    pen.rect(620, 470, 700, 510, "charcoal");
    pen.rect(700, 480, 730, 510, "charcoal");
  },
  "art.night-sea": (pen) => {
    pen.rect(0, 0, 1000, 560, "black");
    pen.circle(760, 200, 50, "cream");
    pen.rect(0, 560, 1000, 1000, "glass");
    for (let row = 600; row < 1000; row += 60) pen.line(100 + (row % 180), row, 380 + (row % 180), row, 3, "canvas");
    pen.line(0, 560, 1000, 560, 2, "concreteWorn");
  },
};

export const ART_IDS: readonly string[] = Object.keys(COMPOSITIONS);

/** The shapes of one composition inside `box`, or null for an id with none. */
export function artShapes(id: string, box: Box): Shape[] | null {
  const compose = COMPOSITIONS[id];
  if (compose === undefined) return null;
  const pen = penFor(box);
  compose(pen, Math.round((box.h * 1000) / box.w));
  return pen.shapes;
}
