// The two lights over the start screen (account:two-lights-and-wink-lines) and the
// dedication's lights (server:dedication-routes, account:dedication-page-and-its-doors and
// account:name-a-light-for-yours).

/** account:two-lights-and-wink-lines: `GET /api/lights`, the same for everyone in the hour. Whole tens. */
export interface LightsReply {
  ok: true;
  home: number;
  abroad: number;
  back: number;
}

/** A dedication light's years as the routes send them: either may be null. */
export interface LightYears {
  from: number | null;
  to: number | null;
}

/** server:dedication-routes: a light as everyone sees it: the name and years only once approved. */
export interface SharedLight {
  id: string;
  name?: string;
  years?: LightYears;
}

/** server:dedication-routes: the asker's own light in full. */
export interface MyLight {
  id: string;
  name: string;
  years: LightYears;
  approved: boolean;
}

/** server:dedication-routes: `GET /api/dedication/lights`: every light counted, the most recent listed, and the asker's own. */
export interface DedicationReply {
  ok: true;
  count: number;
  lights: SharedLight[];
  mine?: MyLight;
}

/** account:name-a-light-for-yours: `PUT /api/dedication/light` taken: the light as kept. */
export interface LitReply {
  ok: true;
  mine: MyLight;
}
