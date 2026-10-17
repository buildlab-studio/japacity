// The home as one wide floor plan: every room walled, one open roof.
// Turning the house: the house's and the yard's outer walls are given by side, each as it stands
// full with the home's wall things, and the builder makes every side twice, full and knee-high, so whichever quarter the
// view looks from, the far pair stands full and the near pair is cut to the knee. The partitions, and the wall between
// the house and its yard, stay at the knee with a door frame standing where a door is. Each home is a set of numbers for
// the one home builder (R-ASSET-014), centred on its own floor; at rest the camera stands at +z (the back and the left
// full), as the home wave built it.
import type { HomeSpec, WallSpec } from "./build";

/** A wall cut to the knee: a partition, or the wall between the house and its yard, which the view always looks over. */
function low(from: readonly [number, number], to: readonly [number, number], upper: WallSpec["upper"], lower: WallSpec["lower"], openings: WallSpec["openings"] = [], height = 1.0): WallSpec {
  return { from, to, height, upper, lower, dado: 1.2, openings };
}

/** A fence round a yard, full height: block walls a little over two metres, as a compound's are. */
function fence(from: readonly [number, number], to: readonly [number, number], openings: WallSpec["openings"] = []): WallSpec {
  return { from, to, height: 2.1, upper: "concrete", lower: "concreteWorn", dado: 0.5, openings };
}

const DOOR = { kind: "door", width: 0.9, height: 2.1 } as const;
/** A window as the kit sizes one (assets.md: 1.2 by 1.2, the sill at 0.9), its louvres open. */
const WINDOW = { kind: "window", width: 1.2, height: 2.1, sill: 0.9 } as const;

export const HOMES3 = {
  // The family house: the parlour at the back left, the bathroom and the kitchen at the back right, your corner and the
  // dining part at the front, the yard down the right side with its carport by the gate.
  family: {
    name: "bld_home-family-house",
    cap: "wallPeachWorn",
    walls: [
      // The house's wall to the yard, with its side door.
      low([2.675, -6.475], [2.675, 6.475], "wallPeach", "wallPeachWorn", [{ ...DOOR, at: 4.6 }]),
      // The partitions: the parlour from the kitchen and the bathroom, the bathroom from the kitchen, your corner, the hall.
      low([-0.6, -6.4], [-0.6, 1.6], "wallPeach", "wallPeachWorn", [{ ...DOOR, at: 1.4, width: 1.0 }]),
      low([-0.6, -3.6], [2.6, -3.6], "white", "wallSky", [{ ...DOOR, at: 0, width: 0.8 }]),
      low([-6.4, 1.6], [-3.2, 1.6], "wallPeach", "wallPeachWorn"),
      low([-3.2, 6.4], [-3.2, 1.6], "wallPeach", "wallPeachWorn", [{ ...DOOR, at: 1.0, width: 0.8 }]),
      low([-0.6, 1.6], [2.6, 1.6], "wallPeach", "wallPeachWorn", [{ ...DOOR, at: 0, width: 1.0 }]),
    ],
    sides: {
      back: [
        {
          from: [-6.475, -6.475],
          to: [2.675, -6.475],
          height: 3.0,
          upper: "wallPeach",
          lower: "wallPeachWorn",
          dado: 1.0,
          fittings: [
            { kind: "clock", at: -3.7, y: 2.4 },
            { kind: "photo", at: -2.2, y: 1.75 },
            { kind: "calendar", at: -0.4, y: 1.3, colour: "green" },
            { kind: "switch", at: 0.7, y: 1.25 },
            { kind: "mirror", at: 2.2, y: 1.2 },
          ],
        },
        // The yard's fence and its gate behind the carport.
        fence([2.675, -6.475], [6.475, -6.475], [{ kind: "gate", at: -0.025, width: 2.7, height: 2.1, colour: "roofGreen" }]),
      ],
      left: [
        {
          from: [-6.475, 6.475],
          to: [-6.475, -6.475],
          height: 3.0,
          upper: "wallPeach",
          lower: "wallPeachWorn",
          dado: 1.0,
          fittings: [
            { kind: "posters", at: -4.6, y: 1.3 },
            { kind: "switch", at: -1.0, y: 1.25 },
          ],
        },
      ],
      front: [
        // The front wall: the front door into the hall, a window onto your corner.
        {
          from: [2.675, 6.475],
          to: [-6.475, 6.475],
          height: 3.0,
          upper: "wallPeach",
          lower: "wallPeachWorn",
          dado: 1.0,
          openings: [
            { ...DOOR, at: -1.5, width: 1.0 },
            { ...WINDOW, at: 2.9 },
          ],
          fittings: [{ kind: "switch", at: -2.3, y: 1.25 }],
        },
        fence([6.475, 6.475], [2.675, 6.475]),
      ],
      right: [fence([6.475, -6.475], [6.475, 6.475])],
    },
  },
  // The self-contain: your room, its bathroom and its kitchenette nook, the compound's yard with your spot and a
  // neighbour's wing across it.
  room: {
    name: "bld_home-room-house",
    cap: "charcoal",
    walls: [
      // Your room's wall to the yard, with its door.
      low([0.475, -3.875], [0.475, 3.875], "wallSky", "wallSkyWorn", [{ ...DOOR, at: 1.6 }]),
      low([-4.6, -1.0], [0.4, -1.0], "wallSky", "wallSkyWorn", [
        { ...DOOR, at: -1.3, width: 0.8 },
        { kind: "gap", at: 1.3, width: 1.6, height: 1.0 },
      ]),
      low([-2.2, -3.8], [-2.2, -1.0], "white", "wallSky"),
    ],
    sides: {
      back: [
        {
          from: [-4.675, -3.875],
          to: [0.475, -3.875],
          height: 3.0,
          upper: "wallSky",
          lower: "wallSkyWorn",
          dado: 1.0,
          fittings: [
            { kind: "mirror", at: -1.3, y: 1.2 },
            { kind: "shelf", at: 1.2, y: 1.5 },
          ],
        },
        // The neighbour's wing across the compound: their door and window, their number over the door.
        {
          from: [0.475, -3.875],
          to: [4.675, -3.875],
          height: 3.0,
          upper: "wallCream",
          lower: "wallCreamWorn",
          dado: 0.9,
          openings: [
            { kind: "door", at: -0.975, width: 0.9, height: 2.1, swing: 60, colour: "wine" },
            { kind: "window", at: 0.925, width: 1.0, height: 2.0, sill: 0.9 },
          ],
          fittings: [{ kind: "number", at: -0.975, y: 2.3, colour: "red" }],
        },
      ],
      left: [
        {
          from: [-4.675, 3.875],
          to: [-4.675, -3.875],
          height: 3.0,
          upper: "wallSky",
          lower: "wallSkyWorn",
          dado: 1.0,
          openings: [{ kind: "window", at: 2.4, width: 1.0, height: 2.1, sill: 1.1 }],
          fittings: [
            { kind: "calendar", at: 0.1, y: 1.4, colour: "teal" },
            { kind: "posters", at: -2.2, y: 1.35 },
          ],
        },
      ],
      front: [
        // Your room's front wall with its window, and the compound's front fence with the gateway by your spot.
        {
          from: [0.475, 3.875],
          to: [-4.675, 3.875],
          height: 3.0,
          upper: "wallSky",
          lower: "wallSkyWorn",
          dado: 1.0,
          openings: [{ ...WINDOW, at: 0.4 }],
          fittings: [{ kind: "switch", at: -1.4, y: 1.25 }],
        },
        fence([4.675, 3.875], [0.475, 3.875], [{ kind: "gap", at: -0.925, width: 2.4, height: 2.1 }]),
      ],
      right: [fence([4.675, -3.875], [4.675, 3.875])],
    },
  },
  // The hostel: the corridor down the left with two other rooms' doors and its line of buckets, the shared cooking nook
  // at its end, and your room.
  hostel: {
    name: "bld_home-hostel-house",
    cap: "concreteWorn",
    walls: [low([-0.9, 2.5], [-0.9, -1.1], "wallMint", "wallMintWorn", [{ ...DOOR, at: 0 }]), low([-0.9, -1.1], [2.5, -1.1], "wallMint", "wallMintWorn")],
    sides: {
      back: [
        {
          from: [-2.575, -2.575],
          to: [2.575, -2.575],
          height: 3.0,
          upper: "wallMint",
          lower: "wallMintWorn",
          dado: 1.1,
          fittings: [{ kind: "notice", at: -1.7, y: 1.5 }],
        },
      ],
      left: [
        {
          from: [-2.575, 2.575],
          to: [-2.575, -2.575],
          height: 3.0,
          upper: "wallMint",
          lower: "wallMintWorn",
          dado: 1.1,
          openings: [
            { kind: "door", at: 0.6, width: 0.9, height: 2.1, swing: 0, colour: "darkWood" },
            { kind: "door", at: -1.6, width: 0.9, height: 2.1, swing: 0, colour: "blue" },
          ],
          fittings: [
            { kind: "number", at: 0.6, y: 2.3 },
            { kind: "number", at: -1.6, y: 2.3, colour: "red" },
          ],
        },
      ],
      front: [
        // The corridor's open end, and your room's window.
        {
          from: [2.575, 2.575],
          to: [-2.575, 2.575],
          height: 3.0,
          upper: "wallMint",
          lower: "wallMintWorn",
          dado: 1.1,
          openings: [
            { kind: "gap", at: 1.7, width: 1.4, height: 2.1 },
            { ...WINDOW, at: -0.9 },
          ],
        },
      ],
      right: [
        // Your room's side wall with its window, the nook's switch.
        {
          from: [2.575, -2.575],
          to: [2.575, 2.575],
          height: 3.0,
          upper: "wallMint",
          lower: "wallMintWorn",
          dado: 1.1,
          openings: [{ ...WINDOW, at: 0.7 }],
          fittings: [{ kind: "switch", at: -1.8, y: 1.25 }],
        },
      ],
    },
  },
} as const satisfies Record<string, HomeSpec>;

export type Home3Name = keyof typeof HOMES3;
