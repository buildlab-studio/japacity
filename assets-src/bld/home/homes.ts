// The three homes of the home redesign, each a set of numbers for the one home builder (R-ASSET-014), each
// one view seen down its length (docs/rules/world.md R-WORLD-029): the camera stands at +z and looks toward -z, so the
// near end of the floor is the bottom of a portrait screen and the yard or the corridor is the top.
//
// The family house: the parlour in the middle, the kitchen through an arch and your corner at the near end, the front
// wall to the veranda cut low so the yard shows over it, the yard with its gate at the far end.
// The self-contain: one room in a compound, its door open to the yard and the neighbours' wing across it.
// The hostel room: one small room of a block, its door open to the yard with the block across it and its shared corner.
import type { HomeSpec } from "./build";

export const HOMES = {
  family: {
    name: "bld_home-family",
    cap: "wallPeachWorn",
    walls: [
      // The house's long wall on the left, full height, with the parlour's and the kitchen's wall things.
      {
        from: [-3.075, 5.0],
        to: [-3.075, -4.6],
        height: 3.0,
        upper: "wallPeach",
        lower: "wallPeachWorn",
        dado: 1.0,
        fittings: [
          { kind: "photo", at: 1.4, y: 1.75 },
          { kind: "calendar", at: -0.7, y: 1.3, colour: "green" },
          { kind: "clock", at: 3.4, y: 2.3 },
          { kind: "switch", at: -1.6, y: 1.25 },
          { kind: "shelf", at: -3.4, y: 1.55 },
        ],
      },
      // The front wall to the veranda, cut low, the front door open out onto it.
      {
        from: [-3.075, -4.6],
        to: [3.075, -4.6],
        height: 1.1,
        upper: "wallPeach",
        lower: "wallPeachWorn",
        dado: 1.0,
        outer: "wallPeachWorn",
        openings: [
          { kind: "door", at: 0.7, width: 1.0, height: 2.1, swing: -105, colour: "darkWood" },
        ],
      },
      // The right wall, cut to the knee.
      { from: [3.075, -4.6], to: [3.075, 5.0], height: 0.8, upper: "wallPeach", lower: "wallPeachWorn", dado: 1.0 },
      // The kitchen's wall, the arch through to the parlour, its face to the camera tiled white to the shoulder.
      {
        from: [-3.0, 2.2],
        to: [-0.4, 2.2],
        height: 2.5,
        upper: "wallCream",
        lower: "white",
        dado: 1.4,
        openings: [{ kind: "arch", at: -0.05, width: 1.3, height: 2.25 }],
      },
      // The yard's fence walls, concrete with their wear, the gate in the far one.
      { from: [-3.075, -4.6], to: [-3.075, -11.8], height: 2.1, upper: "concrete", lower: "concreteWorn", dado: 0.5 },
      {
        from: [-3.075, -11.8],
        to: [3.075, -11.8],
        height: 2.1,
        upper: "concrete",
        lower: "concreteWorn",
        dado: 0.5,
        openings: [{ kind: "gate", at: 1.35, width: 2.8, height: 2.1, colour: "roofGreen" }],
      },
      { from: [3.075, -11.8], to: [3.075, -4.6], height: 1.5, upper: "concrete", lower: "concreteWorn", dado: 0.5 },
    ],
    wires: [
      // NEPA's line from the house over the yard to the street's pole beyond the gate, and the generator's lead.
      [[-3.0, 2.95, -4.5], [2.95, 2.4, -11.7], 0.55],
      [[-3.0, 2.9, -4.55], [-2.95, 2.0, -11.7], 0.3],
    ],
    curtain: { from: [3.0, 2.2], to: [0.8, 2.2], top: 2.15, colour: "teal", drawn: 0.4 },
  },
  room: {
    name: "bld_home-room",
    cap: "charcoal",
    walls: [
      // The room's left wall, full height, the window with its louvres open and the room's wall things.
      {
        from: [-2.475, 2.3],
        to: [-2.475, -2.075],
        height: 3.0,
        upper: "wallSky",
        lower: "wallSkyWorn",
        dado: 1.0,
        openings: [{ kind: "window", at: 0.45, width: 1.2, height: 2.1, sill: 0.9 }],
        fittings: [
          { kind: "calendar", at: -1.25, y: 1.45, colour: "teal" },
          { kind: "switch", at: 1.55, y: 1.25 },
          { kind: "mirror", at: -0.55, y: 2.1 },
        ],
      },
      // The front wall to the yard, cut low, the door open out.
      {
        from: [-2.475, -2.075],
        to: [2.475, -2.075],
        height: 1.1,
        upper: "wallSky",
        lower: "wallSkyWorn",
        dado: 1.0,
        outer: "wallSkyWorn",
        openings: [{ kind: "door", at: 0.35, width: 1.0, height: 2.1, swing: -100, colour: "roofGreen" }],
      },
      { from: [2.475, -2.075], to: [2.475, 2.3], height: 0.8, upper: "wallSky", lower: "wallSkyWorn", dado: 1.0 },
      // The yard: the fence on the left, the neighbours' wing across the far side with two doors and a window, a low wall on the right.
      { from: [-2.475, -2.075], to: [-2.475, -8.4], height: 2.1, upper: "concrete", lower: "concreteWorn", dado: 0.5 },
      {
        from: [-2.475, -8.4],
        to: [2.475, -8.4],
        height: 3.0,
        upper: "wallCream",
        lower: "wallCreamWorn",
        dado: 0.9,
        openings: [
          { kind: "door", at: -1.5, width: 0.9, height: 2.1, swing: 0, colour: "blue" },
          { kind: "window", at: 0.05, width: 1.0, height: 2.0, sill: 0.9 },
          { kind: "door", at: 1.55, width: 0.9, height: 2.1, swing: 70, colour: "wine" },
        ],
        fittings: [
          { kind: "number", at: -1.5, y: 2.3 },
          { kind: "number", at: 1.55, y: 2.3, colour: "red" },
          { kind: "louvre", at: 0.05, y: 0.9 },
        ],
      },
      { from: [2.475, -8.4], to: [2.475, -2.075], height: 1.0, upper: "concrete", lower: "concreteWorn", dado: 0.5, openings: [{ kind: "gap", at: 1.0, width: 2.6, height: 1.0 }] },
    ],
    wires: [
      [[-2.45, 2.95, -2.1], [-2.4, 2.95, -8.35], 0.3],
      [[-2.4, 2.9, -8.3], [2.4, 2.9, -8.35], 0.2],
    ],
  },
  hostel: {
    name: "bld_home-hostel",
    cap: "concreteWorn",
    walls: [
      // The room's left wall, full height and tired: a nail's mirror, the switch.
      {
        from: [-1.675, 1.9],
        to: [-1.675, -1.575],
        height: 3.0,
        upper: "wallMint",
        lower: "wallMintWorn",
        dado: 1.1,
        fittings: [
          { kind: "switch", at: -1.2, y: 1.25 },
          { kind: "mirror", at: 1.0, y: 1.3 },
        ],
      },
      // The front wall to the yard, cut low, a louvre window over it and the door open out.
      {
        from: [-1.675, -1.575],
        to: [1.675, -1.575],
        height: 1.1,
        upper: "wallMint",
        lower: "wallMintWorn",
        dado: 1.1,
        outer: "wallMintWorn",
        openings: [
          { kind: "window", at: -0.75, width: 1.0, height: 2.0, sill: 0.9 },
          { kind: "door", at: 0.85, width: 0.9, height: 2.1, swing: -95, colour: "charcoal" },
        ],
      },
      { from: [1.675, -1.575], to: [1.675, 1.9], height: 0.8, upper: "wallMint", lower: "wallMintWorn", dado: 1.1 },
      // The yard: the block's wall carried on to the left with the house rules and the posters, the block across with
      // two more rooms' doors, a low wall to the right.
      {
        from: [-1.675, -1.575],
        to: [-1.675, -5.6],
        height: 2.6,
        upper: "wallMint",
        lower: "wallMintWorn",
        dado: 1.1,
        fittings: [
          { kind: "notice", at: -0.2, y: 1.5 },
          { kind: "posters", at: 0.6, y: 1.2 },
        ],
      },
      {
        from: [-1.675, -5.6],
        to: [1.675, -5.6],
        height: 3.0,
        upper: "wallMint",
        lower: "wallMintWorn",
        dado: 1.1,
        openings: [
          { kind: "door", at: -0.95, width: 0.9, height: 2.1, swing: 0, colour: "darkWood" },
          { kind: "door", at: 0.8, width: 0.9, height: 2.1, swing: 60, colour: "blue" },
        ],
        fittings: [
          { kind: "number", at: -0.95, y: 2.3 },
          { kind: "number", at: 0.8, y: 2.3, colour: "red" },
        ],
      },
      { from: [1.675, -5.6], to: [1.675, -1.575], height: 1.0, upper: "wallMint", lower: "wallMintWorn", dado: 1.1 },
    ],
    wires: [
      [[-1.6, 2.55, -1.65], [1.6, 2.9, -5.5], 0.35],
    ],
  },
} as const satisfies Record<string, HomeSpec>;

export type HomeName = keyof typeof HOMES;
