// The painted map's drawing (docs/rules/world.md R-WORLD-015), authored in the thousandths of a degree content keeps
// positions in and laid on the paper through the one fit (fit.ts): the mainland with the lagoon along its east, the
// island and Ikoyi across the water, Victoria Island and Lekki along the Atlantic, the roads and the five bridges, the
// parks, the landmarks drawn as symbols, the district names lying on the ground, the boats and the stilt houses.
// Rough on purpose, as the positions are (city.md R-CITY-008, R-CITY-009): a stylised Lagos, not a survey.
import { at, type Point } from "./fit";

/** [lat, lon] in thousandths of a degree. */
type LatLon = readonly [number, number];

const ring = (points: readonly LatLon[]): Point[] => points.map(at);

/** The pieces of land, each a closed ring; everything else on the paper is water. */
export const LAND: Readonly<Record<string, readonly Point[]>> = {
  mainland: ring([
    [6760, 3150],
    [6760, 3440],
    [6625, 3442],
    [6606, 3430],
    [6586, 3419],
    [6569, 3411],
    [6556, 3404],
    [6540, 3401],
    [6525, 3400],
    [6513, 3398],
    [6504, 3392],
    [6497, 3386],
    [6488, 3385],
    [6478, 3386],
    [6471, 3384],
    [6468, 3379],
    [6468, 3372],
    [6464, 3367],
    [6457, 3364],
    [6449, 3364],
    [6443, 3360],
    [6440, 3352],
    [6445, 3343],
    [6452, 3336],
    [6455, 3320],
    [6452, 3300],
    [6450, 3150],
  ]),
  // The far shore of the lagoon, up past Ikorodu.
  farShore: ring([
    [6760, 3462],
    [6625, 3464],
    [6611, 3474],
    [6602, 3492],
    [6600, 3620],
    [6760, 3620],
  ]),
  // Lagos Island and Ikoyi, one piece as the eye reads it.
  island: ring([
    [6461, 3384],
    [6466, 3387],
    [6468, 3395],
    [6467, 3405],
    [6467, 3417],
    [6466, 3429],
    [6463, 3441],
    [6458, 3449],
    [6450, 3451],
    [6444, 3445],
    [6441, 3434],
    [6441, 3423],
    [6442, 3411],
    [6441, 3400],
    [6444, 3390],
    [6451, 3384],
  ]),
  // Victoria Island running on into Lekki, along the sea.
  coast: ring([
    [6436, 3399],
    [6437, 3411],
    [6437, 3424],
    [6438, 3436],
    [6440, 3447],
    [6446, 3455],
    [6451, 3463],
    [6454, 3480],
    [6456, 3620],
    [6418, 3620],
    [6419, 3480],
    [6416, 3460],
    [6413, 3440],
    [6411, 3425],
    [6411, 3410],
    [6415, 3401],
    [6424, 3396],
    [6430, 3397],
  ]),
  // The lighthouse beach across the harbour mouth.
  bar: ring([
    [6405, 3385],
    [6404, 3398],
    [6399, 3400],
    [6400, 3386],
  ]),
};

/** The open sea: everything south of this latitude is the Atlantic's darker blue (under the land). */
export const SEA_FROM = at([6417, 3290])[1];

/** The beach along the coast's sea side. */
export const BEACH: readonly Point[] = ring([
  [6415, 3401],
  [6411, 3410],
  [6411, 3425],
  [6413, 3440],
  [6416, 3460],
  [6419, 3480],
  [6418, 3520],
]);

/** A road: its points from end to end, whether it is a main road, and whether it is a bridge over the water. */
export interface Road {
  points: readonly Point[];
  main: boolean;
  bridge?: string;
}

/** The junctions the roads share, by name; a route turns only at a point two roads share. */
const J = {
  oju: [6511, 3362],
  yaba: [6507, 3376],
  tej: [6504, 3370],
  jib: [6517, 3367],
  mushin: [6525, 3352],
  oshodi: [6556, 3351],
  ikeja: [6596, 3350],
  cv: [6594, 3341],
  maryland: [6577, 3366],
  stad: [6497, 3366],
  costain: [6480, 3369],
  ekoN: [6472, 3373],
  ekoS: [6463, 3385],
  iddo: [6468, 3381],
  carterS: [6464, 3388],
  oyingbo: [6484, 3382],
  ramp: [6507, 3394],
  tmbN: [6556, 3405],
  tmbMid: [6506, 3402],
  tmbS: [6467, 3397],
  cms: [6450, 3392],
  obalende: [6450, 3406],
  ikoyi: [6453, 3427],
  linkW: [6452, 3445],
  linkE: [6448, 3454],
  falomoN: [6443, 3426],
  falomoS: [6435, 3424],
  vi: [6428, 3420],
  toll: [6438, 3444],
  lekki: [6447, 3458],
  bode: [6490, 3355],
  adeniran: [6495, 3358],
  lawanson: [6506, 3346],
  akoka: [6527, 3392],
  airport: [6574, 3322],
  apapa: [6450, 3352],
} as const satisfies Record<string, LatLon>;

const road = (points: readonly LatLon[], main: boolean, bridge?: string): Road => ({
  points: points.map(at),
  main,
  ...(bridge === undefined ? {} : { bridge }),
});

export const ROADS: readonly Road[] = [
  // Agege Motor Road, from Ojuelegba up through Mushin and Oshodi to Ikeja and on.
  road([J.oju, [6518, 3357], J.mushin, [6540, 3350], J.oshodi, [6575, 3350], J.ikeja, [6610, 3346], [6640, 3334]], true),
  // Ikorodu Road, from Jibowu up past Maryland.
  road([J.oju, J.jib, [6531, 3367], [6548, 3368], J.maryland, [6600, 3373], [6640, 3381]], true),
  // Herbert Macaulay Way, Yaba down to Ebute Metta and Iddo.
  road([J.jib, [6512, 3373], J.yaba, [6496, 3380], J.oyingbo, [6476, 3383], J.iddo], true),
  // Western Avenue, Ojuelegba down past the stadium to Costain.
  road([J.oju, [6504, 3364], J.stad, [6488, 3368], J.costain, J.ekoN], true),
  // Ojuelegba to Yaba.
  road([J.oju, [6509, 3369], J.yaba], true),
  // Yaba out to the Third Mainland Bridge's ramp.
  road([J.yaba, [6508, 3386], J.ramp, J.tmbMid], true),
  // Gbagada's way from Maryland round to the bridge's north end.
  road([J.maryland, [6566, 3384], [6560, 3396], J.tmbN], true),
  // The island: Idumota to Obalende and Ikoyi, on over the link bridge to Lekki.
  road([J.carterS, [6460, 3392], J.cms, J.obalende, [6452, 3416], J.ikoyi, J.linkW], true),
  road([J.ekoS, [6458, 3386], J.cms], false),
  road([J.tmbS, [6460, 3399], J.obalende], true),
  road([J.ikoyi, [6448, 3426], J.falomoN], true),
  // Victoria Island along to the toll gate and the Lekki road east.
  road([[6424, 3402], [6427, 3412], J.vi, [6431, 3432], J.toll, [6442, 3451], J.lekki, [6450, 3480], [6452, 3520]], true),
  road([J.falomoS, J.vi], true),
  road([J.linkE, J.lekki], true),
  // Surulere: Ojuelegba to Adeniran Ogunsanya and Bode Thomas, and on toward Apapa.
  road([J.oju, [6503, 3359], J.adeniran, J.bode, [6480, 3351], [6466, 3352], J.apapa], true),
  // Lawanson Road across to Ojuelegba.
  road([[6506, 3300], [6506, 3330], J.lawanson, [6509, 3356], J.oju], false),
  // Akoka from Yaba.
  road([J.yaba, [6515, 3384], J.akoka, [6540, 3394]], false),
  // The airport road from Oshodi, and Ikeja's own streets.
  road([J.oshodi, [6566, 3337], J.airport], true),
  road([J.ikeja, [6595, 3345], J.cv, [6590, 3330], [6575, 3324], J.airport], false),
  road([[6612, 3352], [6600, 3355], J.ikeja], false),
  // Minor streets for the grain of the city.
  road([J.lawanson, [6498, 3344], [6490, 3340], [6478, 3338]], false),
  road([J.adeniran, [6499, 3352], [6501, 3340]], false),
  road([J.tej, [6500, 3374], [6497, 3380]], false),
  road([J.tej, [6508, 3369]], false),
  road([J.stad, [6494, 3376], [6488, 3378], J.oyingbo], false),
  road([J.mushin, [6533, 3343], [6545, 3332], [6560, 3322]], false),
  road([[6545, 3368], [6545, 3382], [6550, 3395]], false),
  road([[6520, 3340], [6522, 3330], [6530, 3318]], false),
  road([[6580, 3366], [6585, 3352], J.ikeja], false),
  road([[6444, 3388], [6446, 3400], [6447, 3412]], false),
  road([[6460, 3410], [6461, 3430], [6458, 3440]], false),
  road([J.costain, [6474, 3362], [6462, 3360]], false),
  road([[6421, 3430], [6427, 3440], [6433, 3452]], false),
  // The bridges.
  road([J.tmbN, [6540, 3407], [6522, 3405], J.tmbMid, [6490, 3402], [6476, 3399], J.tmbS], true, "third-mainland"),
  road([J.ekoN, J.ekoS], true, "eko"),
  road([J.iddo, J.carterS], true, "carter"),
  road([J.falomoN, J.falomoS], true, "falomo"),
  road([J.linkW, J.linkE], true, "link"),
];

/** The parks, as [x, y, rx, ry] on the paper. */
export const PARKS: readonly (readonly [number, number, number, number])[] = [
  [...at([6497, 3365]), 30, 18],
  [...at([6447, 3401]), 16, 10],
  [...at([6457, 3436]), 20, 12],
  [...at([6518, 3396]), 18, 12],
  [...at([6588, 3335]), 22, 14],
  [...at([6425, 3432]), 18, 8],
  [...at([6630, 3500]), 30, 18],
];

/** A district's name lying on the ground: the words key, where, the tilt in degrees and the size. */
export interface Label {
  key: string;
  at: Point;
  tilt: number;
  size: number;
}

const label = (key: string, where: LatLon, tilt: number, size: number): Label => ({ key, at: at(where), tilt, size });

export const LABELS: readonly Label[] = [
  label("map.area.ikeja", [6606, 3334], -4, 13),
  label("map.area.oshodi", [6553, 3338], 2, 11),
  label("map.area.mushin", [6531, 3342], -6, 11),
  label("map.area.gbagada", [6567, 3393], -4, 11),
  label("map.area.yaba", [6513, 3381], -4, 12),
  label("map.area.akoka", [6533, 3388], 4, 10),
  label("map.area.ojuelegba", [6516, 3354], 8, 11),
  label("map.area.surulere", [6500, 3346], -4, 12),
  label("map.area.bode-thomas", [6485, 3346], 4, 10),
  label("map.area.ebute-metta", [6489, 3376], -70, 10),
  label("map.area.iganmu", [6477, 3362], -8, 10),
  label("map.area.apapa", [6446, 3347], 0, 11),
  label("map.area.makoko", [6489, 3393], 0, 10),
  label("map.area.lagos-island", [6458, 3392], -2, 11),
  label("map.area.ikoyi", [6457, 3437], -3, 12),
  label("map.area.victoria-island", [6420, 3418], -2, 11),
  label("map.area.lekki", [6440, 3468], -4, 12),
];

/** The water's own names. */
export const WATER_LABELS: readonly Label[] = [label("map.water.lagoon", [6530, 3445], -8, 18), label("map.water.atlantic", [6402, 3448], 0, 14)];

/** The line the bridge's name runs along, a little west of the Third Mainland Bridge. */
export const BRIDGE_NAME_PATH: readonly Point[] = ring([
  [6552, 3410],
  [6535, 3411],
  [6520, 3410],
]);

/** The landmarks drawn as symbols on the paper, each where it stands. */
export const LANDMARKS = {
  theatre: at([6475, 3369]),
  towers: at([6449, 3394]),
  towersVi: at([6427, 3411]),
  tower: at([6431, 3432]),
  toll: at([6438, 3444]),
  pylon: at([6450, 3449]),
  cranes: at([6446, 3356]),
  ferry: at([6482, 3428]),
} as const;

/** The ferry's dashed way across the lagoon. */
export const FERRY_LINE: readonly Point[] = ring([
  [6467, 3420],
  [6488, 3436],
  [6515, 3462],
  [6545, 3500],
]);

/** A small picture standing on the map that is not a place: Makoko's huts and boats, the lagoon's canoes, the danfos. */
export interface Decor {
  model: string;
  at: Point;
  size: number;
  tilt: number;
  /** A boat drifts; a vehicle stands on its road. */
  kind: "ground" | "boat" | "car";
}

const decor = (model: string, where: LatLon, size: number, tilt: number, kind: Decor["kind"] = "ground"): Decor => ({ model, at: at(where), size, tilt, kind });

export const DECOR: readonly Decor[] = [
  decor("bld_makoko-house_a", [6498, 3388], 15, -6),
  decor("bld_stilt-house", [6492, 3388], 14, 3),
  decor("bld_makoko-house_b", [6493, 3393], 16, 5),
  decor("bld_stilt-house", [6498, 3394], 13, 8),
  decor("bld_makoko-house_a", [6490, 3391], 13, -4),
  decor("prop_fish-racks", [6501, 3389], 12, 4),
  decor("prop_canoe", [6488, 3395], 13, -12, "boat"),
  decor("prop_canoe", [6530, 3420], 18, 18, "boat"),
  decor("prop_canoe", [6505, 3430], 17, -10, "boat"),
  decor("prop_canoe", [6548, 3445], 16, 14, "boat"),
  decor("prop_canoe", [6475, 3452], 15, -18, "boat"),
  decor("prop_canoe", [6565, 3428], 15, 10, "boat"),
  decor("prop_canoe", [6452, 3372], 14, -8, "boat"),
  decor("prop_canoe", [6580, 3445], 14, 22, "boat"),
  decor("veh_danfo", [6532, 3367], 14, 6, "car"),
  decor("veh_danfo", [6509, 3368], 13, -14, "car"),
  decor("veh_danfo", [6520, 3405], 13, 84, "car"),
  decor("veh_danfo", [6492, 3367], 12, 70, "car"),
  decor("veh_keke", [6451, 3418], 11, 4, "car"),
  decor("veh_danfo", [6432, 3436], 13, -4, "car"),
  decor("veh_okada", [6514, 3359], 9, -10, "car"),
  decor("veh_danfo", [6585, 3350], 12, 80, "car"),
];

/**
 * The lantern canoe (docs/rules/world.md R-WORLD-036): one canoe moored on the open lagoon north-east of the Third
 * Mainland Bridge, where nothing is staged and no ride goes, water on every side at the open zoom, well clear of the
 * ferry's line, the bridges and every stop. Not a stop and not decor: drawn by the open map alone, with its lantern.
 */
export const LANTERN_CANOE = { at: at([6515, 3425]) } as const;

/** How far the scatter's waves keep from the lantern canoe, in paper units. */
export const LANTERN_CANOE_CLEAR = 22;

/** Palms along the beach and here and there inland, as [x, y, size in hundredths, facing]. */
export const PALMS: readonly (readonly [number, number, number, 1 | -1])[] = [
  ...[3404, 3414, 3424, 3434, 3446, 3458, 3470, 3484, 3498, 3512].map((lon, index): readonly [number, number, number, 1 | -1] => {
    const [x, y] = at([index % 2 === 0 ? 6415 : 6417, lon]);
    return [x, y - 2, index % 3 === 0 ? 110 : 95, index % 2 === 0 ? 1 : -1];
  }),
  [...at([6469, 3378]), 90, 1],
  [...at([6466, 3398]), 85, -1],
  [...at([6448, 3446]), 90, 1],
  [...at([6437, 3402]), 85, -1],
  [...at([6503, 3389]), 80, 1],
  [...at([6455, 3335]), 85, -1],
];
