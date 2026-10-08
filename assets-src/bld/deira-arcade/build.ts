// A block of old Deira (city.md place.deira): rendered concrete over an arcade, the shops set back
// behind square columns so the pavement runs in the shade. Each bay has its glass shopfront under
// the arcade (gold shops show their gold in the window) and its board on the arcade's beam, words
// by text key (R-ASSET-012). Above, aluminium windows with air conditioners in them, a parapet,
// water tanks and dishes on the roof, all facing the one satellite (R-ASSET-019). The data below
// makes the variants; a far bank variant carries no boards.
import { type PaletteName, setFootprint, type SignStyle } from "@japacity/assets";
import { box, dish, onWall, quad, seeded, signboard, stain } from "@japacity/assets/kit";
import { Group } from "three";

export interface ArcadeSpec {
  name: string;
  bays: number;
  storeys: 2 | 3;
  wall: PaletteName;
  worn: PaletteName;
  /** Which bays are gold shops, by index. */
  gold: number[];
  signs: string[];
  styles: SignStyle[];
  seed: number;
}

export const ARCADE = { bay: 4.0, depth: 12.0, ground: 4.2, storey: 3.2, parapet: 1.0, colonnade: 2.5 } as const;

export function buildArcade(spec: ArcadeSpec, dishYaw: number): Group {
  const g = new Group();
  g.name = spec.name;
  const random = seeded(spec.seed);
  const { bay, depth, ground, storey, parapet, colonnade } = ARCADE;
  const w = spec.bays * bay;
  const top = ground + (spec.storeys - 1) * storey;
  const front = depth / 2;
  const inner = front - colonnade;
  // The block behind the arcade, the floors over it carried out to the front.
  box(g, w, ground, depth - colonnade, 0, 0, -colonnade / 2, spec.wall);
  box(g, w, top - ground + parapet, depth, 0, ground, 0, spec.wall);
  box(g, w, 0.12, colonnade, 0, ground - 0.12, inner + colonnade / 2, "white");
  // The arcade's beam along the front, and a square column at every bay line.
  box(g, w, 0.9, 0.4, 0, ground - 0.9, front - 0.2, spec.wall);
  for (let index = 0; index <= spec.bays; index += 1) {
    const x = Math.min(w / 2 - 0.25, Math.max(-w / 2 + 0.25, -w / 2 + index * bay));
    box(g, 0.5, ground - 0.9, 0.5, x, 0, front - 0.25, spec.wall);
    stain(onWall(g, x, 0, front + 0.001), 0, 0, 0.5, 0.7, spec.worn);
  }
  const shopfront = onWall(g, 0, 0, inner + 0.005);
  const beam = onWall(g, 0, 0, front + 0.005);
  for (let index = 0; index < spec.bays; index += 1) {
    const x = -w / 2 + bay * (index + 0.5);
    const gold = spec.gold.includes(index);
    quad(shopfront, bay - 0.4, 3.0, x, 0, 0.002, gold ? "white" : "hub");
    quad(shopfront, 1.0, 2.3, x + bay / 2 - 0.9, 0.05, 0.006, "glass");
    quad(shopfront, bay - 1.8, 2.2, x - 0.4, 0.6, 0.006, "glass");
    if (gold) {
      // Gold in the window: rows of chains and bangles on a cream ground, lit.
      quad(shopfront, bay - 1.9, 2.0, x - 0.4, 0.7, 0.008, "cream");
      for (let row = 0; row < 5; row += 1) {
        for (let item = 0; item < 6; item += 1) quad(shopfront, 0.22, 0.16 + random() * 0.1, x - 1.6 + item * 0.45, 0.85 + row * 0.38, 0.012, "gold");
      }
    } else {
      const goods: PaletteName[] = ["red", "blue", "danfoYellow", "white", "teal", "orange"];
      for (let row = 0; row < 3; row += 1) quad(shopfront, bay - 2.0, 0.22, x - 0.4, 0.9 + row * 0.55, 0.01, goods[Math.floor(random() * goods.length)] ?? "red");
    }
    quad(shopfront, bay - 0.3, 0.45, x, 3.0, 0.004, "concreteWorn");
    const key = spec.signs[index];
    if (key === undefined) quad(beam, bay - 0.7, 0.8, x, ground - 0.88, 0.04, (["white", "blue", "red"] as const)[index % 3] ?? "white");
    else signboard(g, beam, key, spec.styles[index % spec.styles.length] ?? { board: "white", ink: "black" }, x, ground - 0.88, bay - 0.7, 0.8);
  }
  // Upper floors: two windows a bay, each with an air conditioner in its lower pane or not.
  const face = onWall(g, 0, 0, front + 0.005);
  for (let floor = 1; floor < spec.storeys; floor += 1) {
    const y = ground + (floor - 1) * storey + 0.9;
    for (let index = 0; index < spec.bays; index += 1) {
      for (const dx of [-0.95, 0.95]) {
        const x = -w / 2 + bay * (index + 0.5) + dx;
        quad(face, 1.3, 1.5, x, y, 0.002, "hub");
        quad(face, 1.2, 1.4, x, y + 0.05, 0.006, "glass");
        if (random() < 0.55) box(face, 0.7, 0.45, 0.35, x, y + 0.1, 0.12, "white");
        else if (random() < 0.4) quad(face, 1.2, 0.6, x, y + 0.8, 0.008, (["cream", "wine", "teal"] as const)[Math.floor(random() * 3)] ?? "cream");
      }
    }
    box(g, w + 0.06, 0.18, 0.12, 0, ground + (floor - 1) * storey + 0.6, front + 0.06, "white");
    stain(face, (random() - 0.5) * w * 0.6, ground + (floor - 1) * storey, 1.2 + random(), 0.9, spec.worn);
  }
  // The parapet's coping, the roof's tanks and dishes, a stair head.
  box(g, w + 0.1, 0.1, depth + 0.1, 0, top + parapet - 0.1, 0, "white");
  for (let index = 0; index < Math.max(1, spec.bays - 1); index += 1) {
    box(g, 1.6, 1.2, 1.0, -w / 2 + 1.4 + index * 3.6, top, -front + 1.6, "white");
    box(g, 1.7, 0.08, 1.1, -w / 2 + 1.4 + index * 3.6, top + 1.2, -front + 1.6, "basin");
  }
  box(g, 2.4, 2.0, 2.6, w / 2 - 1.6, top, -front + 2.0, spec.wall);
  dish(g, g, -w / 2 + 1.3, top, 0.5, dishYaw);
  dish(g, g, w / 2 - 1.3, top, 1.2, dishYaw);
  stain(face, 0, top + parapet - 0.6, w, 0.5, spec.worn);
  // The block behind the arcade and the arcade's columns; the pavement under the arcade is open.
  return setFootprint(g, [
    { x: 0, z: -colonnade / 2, width: w, depth: depth - colonnade },
    ...Array.from({ length: spec.bays + 1 }, (_, index) => ({ x: Math.min(w / 2 - 0.25, Math.max(-w / 2 + 0.25, -w / 2 + index * bay)), z: front - 0.25, width: 0.5, depth: 0.5 })),
  ]);
}
