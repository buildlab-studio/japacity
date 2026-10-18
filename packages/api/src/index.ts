// The HTTP and socket contract between the client and the server (decision
// 0027): each route's request and reply, and the socket's messages. The
// client and the server import these one declarations, so a change to either
// side's use of the wire fails the type check.
export type * from "./reply";
export type * from "./game";
export type * from "./account";
export type * from "./pair";
export type * from "./lottery";
export type * from "./advert";
export type * from "./lights";
export type * from "./analytics";
export type * from "./boards";
export type * from "./admin";
export type * from "./admin.analytics";
export type * from "./admin.advert";
export * from "./socket";
export * from "./moderation";
export * from "./admin.moderation";
export * from "./admin.switches";
