// A way for a screen outside the world to open the phone at one of its apps (moderation:admin-view-for-admin-list: the
// admin's no-passkey sheet sends the admin to Settings, where a passkey is added). The world listens while it stands; an
// ask made before it listens waits for it, and is heard once.
type Listener = (app: string) => void;

let listener: Listener | null = null;
let waiting: string | null = null;

/** Opens the phone at `app` in the world, now or as soon as the world stands. */
export function askPhoneApp(app: string): void {
  if (listener === null) {
    waiting = app;
    return;
  }
  listener(app);
}

/** The world listens for asks; returns how to stop. An ask that waited is heard at once. */
export function onPhoneAppAsked(next: Listener): () => void {
  listener = next;
  if (waiting !== null) {
    const app = waiting;
    waiting = null;
    next(app);
  }
  return () => {
    if (listener === next) listener = null;
  };
}
