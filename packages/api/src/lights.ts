// The two lights over the start screen (account.md R-ACCOUNT-031) and a
// dedication light's years (server.md R-SERVER-045).

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
