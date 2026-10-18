// The two lights over the start screen (account.md R-ACCOUNT-031) and the
// dedication's lights (server.md R-SERVER-045, account.md R-ACCOUNT-032 and
// R-ACCOUNT-033).

/** R-ACCOUNT-031: `GET /api/lights`, the same for everyone in the hour. Whole tens. */
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

/** R-SERVER-045: a light as everyone sees it: the name and years only once approved. */
export interface SharedLight {
  id: string;
  name?: string;
  years?: LightYears;
}

/** R-SERVER-045: the asker's own light in full. */
export interface MyLight {
  id: string;
  name: string;
  years: LightYears;
  approved: boolean;
}

/** R-SERVER-045: `GET /api/dedication/lights`: every light counted, the most recent listed, and the asker's own. */
export interface DedicationReply {
  ok: true;
  count: number;
  lights: SharedLight[];
  mine?: MyLight;
}

/** R-ACCOUNT-033: `PUT /api/dedication/light` taken: the light as kept. */
export interface LitReply {
  ok: true;
  mine: MyLight;
}
