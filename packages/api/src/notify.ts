// The bank-full notice's routes (clock.md R-CLOCK-031): the setting, the
// devices that agreed, and the deployment's public key.
import type { PushSubscriptionJson } from "@japacity/store";

import type { ServerRejection } from "./reply";

export type { PushSubscriptionJson };

/** `GET /api/notify` and every change: the setting, and the days before a dismissed ask comes again. */
export type NotifyReply = { ok: true; on: boolean; reaskDays: number } | ServerRejection;

/** The body of `PUT /api/notify`. */
export interface NotifySettingRequest {
  on: boolean;
}

/** The body of `POST /api/notify/subscribe`: the browser's subscription as `PushSubscription.toJSON()` gives it. */
export interface SubscribeRequest {
  subscription: PushSubscriptionJson;
}

/** `GET /api/notify/key`: the public key a browser subscribes with, null while the deployment has none. */
export interface NotifyKeyReply {
  ok: true;
  key: string | null;
}
