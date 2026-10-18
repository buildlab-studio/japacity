import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { cronUrl, hyperdriveEnv, localStack, parseDotEnv, WORKER_KEYS, workerEnvFile, wranglerArgs } from "./env";
import { REPO_ROOT } from "../repo";

const EXAMPLE = parseDotEnv(readFileSync(`${REPO_ROOT}/.env.example`, "utf8"));

describe("the local stack's settings", () => {
  test("[R-SERVER-038] given the committed .env.example, when it is read, then the game is https on localhost:8787, the database and Mailpit are on this machine, the mail goes to Mailpit, and the bot check uses the always-pass test keys", () => {
    const stack = localStack(EXAMPLE, {});
    expect(stack.siteUrl).toBe("https://localhost:8787");
    expect(stack.port).toBe(8787);
    expect(new URL(stack.databaseUrl).hostname).toBe("127.0.0.1");
    expect(stack.mailpitUrl).toBe("http://localhost:8025");
    expect(stack.worker).toMatchObject({ SITE_URL: "https://localhost:8787", MAIL_TRANSPORT: "mailpit", TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" });
    expect(stack.client).toEqual({ VITE_SERVER_URL: "https://localhost:8787", VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA" });
    expect(Object.keys(stack.worker)).toEqual([...WORKER_KEYS]);
  });

  test("[R-SERVER-038] given a .env.local that also holds a Neon link's strings, when the stack is read, then only the example's names are taken and no Neon string reaches the Worker, the client or the migrations", () => {
    const neon = "postgres://owner:example@ep-example.eu-central-1.aws.neon.tech/neondb";
    const stack = localStack(EXAMPLE, { DATABASE_URL: neon, DATABASE_URL_UNPOOLED: neon, SITE_URL: "https://localhost:6592" });
    expect(stack.siteUrl).toBe("https://localhost:6592");
    expect(JSON.stringify(stack)).not.toContain("neon.tech");
    expect(workerEnvFile(stack)).not.toContain("DATABASE_URL");
  });

  test("[R-SERVER-038] given a database or a Mailpit that is not on this machine, when the stack is read, then it is refused before anything starts", () => {
    expect(() => localStack(EXAMPLE, { LOCAL_DATABASE_URL: "postgres://owner:example@ep-example.neon.tech/neondb" })).toThrow("LOCAL_DATABASE_URL must be on this machine");
    expect(() => localStack(EXAMPLE, { MAILPIT_URL: "http://mail.example.com:8025" })).toThrow("MAILPIT_URL must be on this machine");
  });

  test("[R-SERVER-038] [R-ACCOUNT-003] given a SITE_URL that is http, carries a path or names no port, when the stack is read, then it is refused: the auth library and the passkeys take only a bare https origin", () => {
    expect(() => localStack(EXAMPLE, { SITE_URL: "http://localhost:8787" })).toThrow("SITE_URL must start with https:");
    expect(() => localStack(EXAMPLE, { SITE_URL: "https://localhost:8787/" })).toThrow("bare origin");
    expect(() => localStack(EXAMPLE, { SITE_URL: "https://localhost" })).toThrow("must name its port");
    expect(() => localStack(EXAMPLE, { SITE_URL: "https://japacity.app:443" })).toThrow("must be on this machine");
  });

  test("[R-SERVER-038] given the stack, when wrangler dev's arguments are made, then they use no deployed environment, serve https on SITE_URL's port, keep SITE_URL's host as the upstream, and read the bindings from the env file; Hyperdrive's two bindings get the local string", () => {
    const stack = localStack(EXAMPLE, {});
    const args = wranglerArgs(stack, "/tmp/worker.env", "/tmp/client");
    expect(args).not.toContain("--env");
    expect(args).not.toContain("-e");
    expect(args).toEqual(["dev", "--port", "8787", "--local-protocol", "https", "--local-upstream", "localhost:8787", "--assets", "/tmp/client", "--env-file", "/tmp/worker.env"]);
    expect(hyperdriveEnv(stack)).toEqual({
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_GAME_DB: stack.databaseUrl,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_CACHED_DB: stack.databaseUrl,
    });
    expect(cronUrl(stack)).toBe("https://localhost:8787/cdn-cgi/local/explorer/api/local/scheduled?worker=japacity-server");
  });

  test("[R-SERVER-038] given the deployed config, when it is read, then no local value is in it: no local connection string and no localhost", () => {
    const config = readFileSync(`${REPO_ROOT}/apps/server/wrangler.jsonc`, "utf8");
    expect(config).not.toContain("localConnectionString");
    expect(config).not.toContain("localhost");
    expect(config).not.toContain("127.0.0.1");
  });

  test("[R-SERVER-038] given the Worker's name in wrangler.jsonc, when the local cron is sent, then it is the name the local explorer dispatches to", () => {
    const config = readFileSync(`${REPO_ROOT}/apps/server/wrangler.jsonc`, "utf8");
    expect(config).toContain('"name": "japacity-server"');
  });
});
