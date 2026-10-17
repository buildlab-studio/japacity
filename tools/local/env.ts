// The local stack's settings (server.md R-SERVER-038): the names in .env.example, each overridden
// by the same name in .env.local. Nothing else in .env.local is read, so a Neon link's strings there
// are never used, and every address is checked to be on this machine before anything starts.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** What the Worker is given, as `wrangler secret put` gives a deployment its values. */
export const WORKER_KEYS = [
  "SITE_URL",
  "MAIL_TRANSPORT",
  "MAILPIT_URL",
  "TURNSTILE_SECRET_KEY",
  "BETTER_AUTH_SECRET",
  "WORLD_SEED",
  "BAN_SALT",
  "DRAW_TOKEN_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

/** What the Worker is given only when it has a value: the admin accounts (R-SERVER-012), empty in .env.example. */
const OPTIONAL_WORKER_KEYS = ["ADMIN_ACCOUNTS"] as const;

/** The Worker's name in wrangler.jsonc, which wrangler's local explorer dispatches a cron to. */
const WORKER_NAME = "japacity-server";

/** The client built for the local Worker, kept with wrangler's own local files (git and the lint skip .wrangler), never in the deployable dist. */
export const LOCAL_DIST = "apps/server/.wrangler/local/client";

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface LocalStack {
  /** The game's one address: the page and /api. */
  siteUrl: string;
  /** The port wrangler listens on, from SITE_URL. */
  port: number;
  databaseUrl: string;
  mailpitUrl: string;
  /** The Worker's bindings, by name. */
  worker: Record<string, string>;
  /** What Vite builds the client with. */
  client: Record<string, string>;
}

/** KEY=value lines; blank lines and lines starting with # are skipped. Values are taken as written. */
export function parseDotEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at <= 0) continue;
    values[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return values;
}

function localAddress(name: string, value: string, protocols: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not an address: ${value}`);
  }
  if (!protocols.includes(url.protocol)) throw new Error(`${name} must start with ${protocols.join(" or ")}: ${value}`);
  if (!LOCAL_HOSTS.has(url.hostname)) throw new Error(`${name} must be on this machine (localhost or 127.0.0.1): ${value}`);
  return url;
}

/** The settings from the example's names, each overridden by .env.local's; refused unless every address is local. */
export function localStack(example: Record<string, string>, local: Record<string, string>): LocalStack {
  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(example)) values[name] = local[name] ?? value;
  const need = (name: string): string => {
    const value = values[name];
    if (value === undefined || value === "") throw new Error(`${name} is missing from .env.example`);
    return value;
  };

  const siteUrl = need("SITE_URL");
  // account.md R-ACCOUNT-003: the auth library and the passkeys take only a bare https origin.
  const site = localAddress("SITE_URL", siteUrl, ["https:"]);
  if (site.origin !== siteUrl) throw new Error(`SITE_URL must be a bare origin, with no path or trailing slash: ${siteUrl}`);
  if (site.port === "") throw new Error(`SITE_URL must name its port, the one wrangler listens on: ${siteUrl}`);
  const databaseUrl = need("LOCAL_DATABASE_URL");
  localAddress("LOCAL_DATABASE_URL", databaseUrl, ["postgres:", "postgresql:"]);
  const mailpitUrl = need("MAILPIT_URL");
  localAddress("MAILPIT_URL", mailpitUrl, ["http:"]);

  const worker: Record<string, string> = {};
  for (const name of WORKER_KEYS) worker[name] = need(name);
  // server.md R-SERVER-012: the admin accounts reach the Worker only when .env.local names some; empty, nobody is an admin.
  for (const name of OPTIONAL_WORKER_KEYS) {
    const value = values[name];
    if (value !== undefined && value !== "") worker[name] = value;
  }
  return {
    siteUrl,
    port: Number(site.port),
    databaseUrl,
    mailpitUrl,
    worker,
    client: { VITE_SERVER_URL: siteUrl, VITE_TURNSTILE_SITE_KEY: need("VITE_TURNSTILE_SITE_KEY") },
  };
}

/** Reads .env.example and .env.local (if there is one) at the repository's root. */
export function readLocalStack(root: string): LocalStack {
  const example = parseDotEnv(readFileSync(join(root, ".env.example"), "utf8"));
  const localPath = join(root, ".env.local");
  const local = existsSync(localPath) ? parseDotEnv(readFileSync(localPath, "utf8")) : {};
  return localStack(example, local);
}

/** The Worker's bindings as the env file `wrangler dev --env-file` reads. */
export function workerEnvFile(stack: LocalStack): string {
  return `${Object.entries(stack.worker)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n")}\n`;
}

/** wrangler 4.149 reads a Hyperdrive binding's local string from this variable (CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<binding>). */
export function hyperdriveEnv(stack: LocalStack): Record<string, string> {
  return {
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_GAME_DB: stack.databaseUrl,
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_CACHED_DB: stack.databaseUrl,
  };
}

/**
 * `wrangler dev`'s arguments, from apps/server: the top-level config and no `--env`, so no deployed
 * environment is used; https on SITE_URL's port; the local upstream set to SITE_URL's host, since
 * wrangler otherwise rewrites each request's address and origin to the config's route (japacity.app)
 * and the auth library refuses every write; and the local build of the client as the assets.
 */
export function wranglerArgs(stack: LocalStack, envFile: string, assets: string): string[] {
  const site = new URL(stack.siteUrl);
  return ["dev", "--port", String(stack.port), "--local-protocol", "https", "--local-upstream", site.host, "--assets", assets, "--env-file", envFile];
}

/** The local explorer's address that runs the Worker's scheduled handler with one cron (wrangler's own __scheduled page is answered by the assets). */
export function cronUrl(stack: LocalStack): string {
  return `${stack.siteUrl}/cdn-cgi/local/explorer/api/local/scheduled?worker=${WORKER_NAME}`;
}
