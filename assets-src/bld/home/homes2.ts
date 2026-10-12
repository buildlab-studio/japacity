// The home as two small scenes (the home redesign): for each home the room alone and the yard
// behind its door, each a set of numbers for the one home builder (R-ASSET-014), each centred on its own floor. The camera
// stands at +z and looks toward -z, so the room's back wall, full height, faces it and carries the room's wall things and
// the door out; the yard is entered by a door in its own left wall, the house's or the block's.
import type { HomeSpec } from "./build";

export const HOMES2 = {
  "family-room": {
    name: "bld_home-family-room",
    cap: "wallPeachWorn",
    walls: [
      {
        from: [-3.075, 4.2],
        to: [-3.075, -4.2],
        height: 3.0,
        upper: "wallPeach",
        lower: "wallPeachWorn",
        dado: 1.0,
        fittings: [
          { kind: "photo", at: 1.4, y: 1.75 },
          { kind: "switch", at: -1.2, y: 1.25 },
          { kind: "shelf", at: -3.3, y: 1.55 },
        ],
      },
      // The back wall: the window, the family's portrait over Mama's chair, the calendar, the clock, the door to the yard.
      {
        from: [-3.075, -4.275],
        to: [3.075, -4.275],
        height: 3.0,
        upper: "wallPeach",
        lower: "wallPeachWorn",
        dado: 1.0,
        openings: [
          { kind: "window", at: -2.05, width: 1.2, height: 2.1, sill: 0.9 },
          { kind: "door", at: 1.75, width: 0.95, height: 2.1, swing: -28, colour: "darkWood" },
        ],
        fittings: [
          { kind: "photo", at: -0.75, y: 1.75 },
          { kind: "calendar", at: 0.5, y: 1.3, colour: "green" },
          { kind: "clock", at: -2.05, y: 2.5 },
          { kind: "switch", at: 2.55, y: 1.25 },
        ],
      },
      { from: [3.075, -4.275], to: [3.075, 4.2], height: 0.8, upper: "wallPeach", lower: "wallPeachWorn", dado: 1.0 },
      {
        from: [-3.0, 1.8],
        to: [-0.4, 1.8],
        height: 2.5,
        upper: "wallCream",
        lower: "white",
        dado: 1.4,
        openings: [{ kind: "arch", at: 0, width: 1.3, height: 2.25 }],
      },
    ],
    curtain: { from: [3.0, 1.8], to: [1.95, 1.8], top: 2.15, colour: "teal", drawn: 0.75 },
  },
  "family-yard": {
    name: "bld_home-family-yard",
    cap: "wallPeachWorn",
    walls: [
      // The house's back wall, its back door open on the yard and the kitchen window.
      {
        from: [-3.075, 4.5],
        to: [-3.075, -4.5],
        height: 3.0,
        upper: "wallPeach",
        lower: "wallPeachWorn",
        dado: 0.7,
        outer: "wallPeachWorn",
        openings: [
          { kind: "door", at: -2.8, width: 0.95, height: 2.1, swing: -100, colour: "darkWood" },
          { kind: "window", at: 0.6, width: 1.2, height: 2.0, sill: 0.9 },
        ],
      },
      {
        from: [-3.075, -4.575],
        to: [3.075, -4.575],
        height: 2.1,
        upper: "concrete",
        lower: "concreteWorn",
        dado: 0.5,
        openings: [{ kind: "gate", at: 1.3, width: 2.7, height: 2.1, colour: "roofGreen" }],
      },
      { from: [3.075, -4.575], to: [3.075, 4.5], height: 2.1, upper: "concrete", lower: "concreteWorn", dado: 0.5 },
    ],
    // The generator's lead up the house wall to the meter.
    wires: [[[-3.0, 2.9, -1.0], [-2.6, 0.75, -1.4], 0.1]],
  },
  "room-room": {
    name: "bld_home-room-room",
    cap: "charcoal",
    walls: [
      {
        from: [-2.475, 2.1],
        to: [-2.475, -2.1],
        height: 3.0,
        upper: "wallSky",
        lower: "wallSkyWorn",
        dado: 1.0,
        openings: [{ kind: "window", at: 0.4, width: 1.2, height: 2.1, sill: 0.9 }],
        fittings: [{ kind: "posters", at: -1.9, y: 1.4 }],
      },
      // The back wall: the calendar, the switch, the shelf over the kitchenette, the door out to the compound.
      {
        from: [-2.475, -2.175],
        to: [2.475, -2.175],
        height: 3.0,
        upper: "wallSky",
        lower: "wallSkyWorn",
        dado: 1.0,
        openings: [{ kind: "door", at: 0.35, width: 0.95, height: 2.1, swing: -28, colour: "roofGreen" }],
        fittings: [
          { kind: "calendar", at: -0.7, y: 1.3, colour: "teal" },
          { kind: "switch", at: 1.05, y: 1.25 },
          { kind: "shelf", at: 1.65, y: 1.5 },
        ],
      },
      { from: [2.475, -2.175], to: [2.475, 2.1], height: 0.8, upper: "wallSky", lower: "wallSkyWorn", dado: 1.0 },
    ],
  },
  "room-yard": {
    name: "bld_home-room-yard",
    cap: "charcoal",
    walls: [
      // Your wing: your door open, your window, the next tenant's door.
      {
        from: [-3.075, 4.0],
        to: [-3.075, -4.0],
        height: 3.0,
        upper: "wallSky",
        lower: "wallSkyWorn",
        dado: 0.9,
        openings: [
          { kind: "door", at: -1.4, width: 0.95, height: 2.1, swing: -100, colour: "roofGreen" },
          { kind: "window", at: 0.6, width: 1.2, height: 2.0, sill: 0.9 },
          { kind: "door", at: 2.9, width: 0.9, height: 2.1, swing: 0, colour: "blue" },
        ],
        fittings: [
          { kind: "number", at: -1.4, y: 2.3 },
          { kind: "number", at: 2.9, y: 2.3, colour: "red" },
        ],
      },
      // The neighbours' wing across the yard.
      {
        from: [-3.075, -4.075],
        to: [3.075, -4.075],
        height: 3.0,
        upper: "wallCream",
        lower: "wallCreamWorn",
        dado: 0.9,
        openings: [
          { kind: "window", at: -1.4, width: 1.0, height: 2.0, sill: 0.9 },
          { kind: "door", at: 0.6, width: 0.9, height: 2.1, swing: 60, colour: "wine" },
          { kind: "door", at: 2.3, width: 0.9, height: 2.1, swing: 0, colour: "darkWood" },
        ],
        fittings: [
          { kind: "number", at: 0.6, y: 2.3 },
          { kind: "number", at: 2.3, y: 2.3, colour: "red" },
        ],
      },
      // The compound's fence and its gate to the street.
      {
        from: [3.075, -4.075],
        to: [3.075, 4.0],
        height: 2.1,
        upper: "concrete",
        lower: "concreteWorn",
        dado: 0.5,
        // The compound's way out to the street, an opening in the fence near your door.
        openings: [{ kind: "gap", at: 2.3, width: 2.6, height: 2.1 }],
      },
    ],
    wires: [[[-3.0, 2.95, -4.0], [3.0, 2.95, -4.0], 0.25]],
  },
  "hostel-room": {
    name: "bld_home-hostel-room",
    cap: "concreteWorn",
    walls: [
      {
        from: [-1.675, 1.75],
        to: [-1.675, -1.75],
        height: 3.0,
        upper: "wallMint",
        lower: "wallMintWorn",
        dado: 1.1,
        fittings: [{ kind: "switch", at: 1.25, y: 1.25 }],
      },
      // The back wall: the louvre window onto the corridor, a mirror on its nail, the door out.
      {
        from: [-1.675, -1.825],
        to: [1.675, -1.825],
        height: 3.0,
        upper: "wallMint",
        lower: "wallMintWorn",
        dado: 1.1,
        openings: [
          { kind: "window", at: -0.8, width: 1.0, height: 2.0, sill: 0.9 },
          { kind: "door", at: 0.9, width: 0.9, height: 2.1, swing: -28, colour: "charcoal" },
        ],
        fittings: [{ kind: "mirror", at: 0.07, y: 1.3 }],
      },
      { from: [1.675, -1.825], to: [1.675, 1.75], height: 0.8, upper: "wallMint", lower: "wallMintWorn", dado: 1.1 },
    ],
  },
  "hostel-yard": {
    name: "bld_home-hostel-yard",
    cap: "concreteWorn",
    walls: [
      // Your block: your door open, the next room's shut, the house rules painted between.
      {
        from: [-2.075, 3.0],
        to: [-2.075, -3.0],
        height: 2.8,
        upper: "wallMint",
        lower: "wallMintWorn",
        dado: 1.1,
        openings: [
          { kind: "door", at: -1.6, width: 0.9, height: 2.1, swing: -100, colour: "charcoal" },
          { kind: "door", at: 1.6, width: 0.9, height: 2.1, swing: 0, colour: "darkWood" },
        ],
        fittings: [
          { kind: "number", at: -1.6, y: 2.25 },
          { kind: "number", at: 1.6, y: 2.25, colour: "red" },
          { kind: "notice", at: 0.0, y: 1.4 },
        ],
      },
      // The block across.
      {
        from: [-2.075, -3.075],
        to: [2.075, -3.075],
        height: 3.0,
        upper: "wallMint",
        lower: "wallMintWorn",
        dado: 1.1,
        openings: [
          { kind: "door", at: -1.1, width: 0.9, height: 2.1, swing: 0, colour: "darkWood" },
          { kind: "door", at: 0.95, width: 0.9, height: 2.1, swing: 60, colour: "blue" },
        ],
        fittings: [
          { kind: "number", at: -1.1, y: 2.3 },
          { kind: "number", at: 0.95, y: 2.3, colour: "red" },
        ],
      },
      { from: [2.075, -3.075], to: [2.075, 3.0], height: 1.0, upper: "wallMint", lower: "wallMintWorn", dado: 1.1 },
    ],
  },
} as const satisfies Record<string, HomeSpec>;

export type Home2Name = keyof typeof HOMES2;
