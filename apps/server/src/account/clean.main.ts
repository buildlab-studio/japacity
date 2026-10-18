/// <reference types="node" />
// The guest clean-up's entry (account:idle-guests-cleaned-by-hand), run by Node through tsx as
// `pnpm guests:clean` and never part of the Worker. It reads the database at
// `DATABASE_URL` and touches nothing but the auth library's tables and the
// stores the deletion job removes from.
import { content } from "@japacity/content";
import { connect, pgStores } from "@japacity/db";

import { makeAuth } from "../auth/auth";
import { drizzleAuthAdapter } from "../auth/drizzle";
import { productionConfig } from "../config";
import { memoryStores, openLimiters, webRandomBytes } from "../deps";
import type { ServerDeps } from "../deps";
import { cleanCli } from "./clean";

const url = process.env["DATABASE_URL"];
if (url === undefined || url === "") {
  console.log("Set DATABASE_URL to the game's database first.");
  process.exitCode = 2;
} else {
  const { handle, db, close } = await connect(url);
  try {
    const deps: ServerDeps = {
      config: productionConfig,
      stores: { ...memoryStores(), ...pgStores(handle) },
      contents: { current: content, previous: null },
      secrets: { worldSeed: "", banSalt: "", drawTokenKey: "" },
      limits: openLimiters,
      session: () => Promise.resolve(null),
      now: () => Date.now(),
      randomBytes: webRandomBytes,
    };
    // Only the library's tables are used here: no cookie is signed and nothing is sent.
    const auth = makeAuth(deps, drizzleAuthAdapter(db), {
      secret: process.env["BETTER_AUTH_SECRET"] ?? "the-clean-up-signs-no-cookie-and-needs-no-secret",
      siteUrl: process.env["SITE_URL"] ?? "https://japacity.app",
      google: { clientId: "", clientSecret: "" },
      turnstile: { secretKey: "" },
      sendOtp: () => Promise.reject(new Error("The clean-up sends no email.")),
      sendNotice: () => Promise.reject(new Error("The clean-up sends no email.")),
      background: () => undefined,
    });
    const result = await cleanCli(deps, auth, process.argv.slice(2));
    for (const line of result.lines) console.log(line);
    process.exitCode = result.exit;
  } finally {
    await close();
  }
}
