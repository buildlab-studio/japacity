import { afterEach, describe, expect, test } from "vitest";

import { askPhoneApp, onPhoneAppAsked } from "./ask";

let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
});

describe("asking the phone for an app (moderation:admin-view-for-admin-list)", () => {
  test("[moderation:admin-view-for-admin-list] given the world listening, when an app is asked for, then the world hears it at once", () => {
    const heard: string[] = [];
    stop = onPhoneAppAsked((app) => heard.push(app));
    askPhoneApp("settings");
    expect(heard).toEqual(["settings"]);
  });

  test("[moderation:admin-view-for-admin-list] given no world listening yet, when an app is asked for, then the world hears it once it listens, and only once", () => {
    askPhoneApp("settings");
    const heard: string[] = [];
    stop = onPhoneAppAsked((app) => heard.push(app));
    expect(heard).toEqual(["settings"]);
    stop();
    stop = onPhoneAppAsked((app) => heard.push(app));
    expect(heard).toEqual(["settings"]);
  });

  test("[moderation:admin-view-for-admin-list] given a world that stopped listening, when an app is asked for, then the old listener hears nothing", () => {
    const heard: string[] = [];
    onPhoneAppAsked((app) => heard.push(app))();
    askPhoneApp("settings");
    expect(heard).toEqual([]);
    stop = onPhoneAppAsked(() => undefined);
  });
});
