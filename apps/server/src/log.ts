// R-SERVER-039: the server's one log line, written for each failure and for
// nothing else, as JSON so Workers Logs can index its fields. It names what
// failed (a request, a job, the auth library), the job's name, the method and
// the path's shape, the status answered, and the error's name, code and first
// line. It never carries a header, a cookie, a body, a session, an account id,
// an address, a query string or a secret: the path's ids and codes are
// replaced by `:id`, and the error's words lose anything that looks like an
// email, an address or a token.

/** What failed. */
export type FailureWhat = "request" | "job" | "auth" | "gate-count" | "close";

export interface Failure {
  what: FailureWhat;
  /** The job's name, for a scheduled job. */
  job?: string;
  method?: string;
  /** The request's path or URL; only its shape is kept. */
  path?: string;
  /** The status the request was answered with. */
  status?: number;
  error: unknown;
}

/** The line as it is written. */
export interface FailureLine {
  level: "error";
  what: FailureWhat;
  job?: string;
  method?: string;
  path?: string;
  status?: number;
  /** The error's name. */
  error: string;
  /** Its message's first line, scrubbed, at most `MESSAGE_MAX` characters. */
  message: string;
  /** The name of the error that caused it, when there is one: Drizzle wraps the driver's. */
  cause?: string;
  /** A Postgres SQLSTATE or a socket's error code, from the error or its causes. */
  code?: string;
}

export const MESSAGE_MAX = 200;
/** How deep the causes are followed. */
const CAUSE_DEPTH = 5;
/** A path segment kept as it is: a lower-case word of the route (`api`, `invite`, `socket`) or a content id (`place.ojuelegba`). */
const ROUTE_WORD = /^[a-z][a-z-]{0,15}$/;
const CONTENT_ID = /^[a-z]+\.[a-z0-9-]{1,40}$/;
/** A Postgres SQLSTATE (`08006`) or a socket's code (`ECONNREFUSED`). */
const ERROR_CODE = /^(?:[0-9A-Z]{5}|E[A-Z]{2,15})$/;

/** The path without its query string, each segment that is not a route word or a content id replaced by `:id`. */
export function pathShape(path: string): string {
  const bare = path.replace(/^[a-z]+:\/\/[^/]*/i, "").split(/[?#]/)[0] ?? "";
  return bare
    .split("/")
    .map((segment) => (segment === "" || ROUTE_WORD.test(segment) || CONTENT_ID.test(segment) ? segment : ":id"))
    .join("/");
}

/** An error's words with anything personal or secret taken out: emails, addresses, long runs that may be an id or a token, quoted values. */
export function scrubbed(message: string): string {
  const first = message.split("\n")[0] ?? "";
  return first
    .replace(/[^\s@"'()]+@[^\s@"'()]+/g, "<email>")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<address>")
    .replace(/\b[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}\b/gi, "<address>")
    .replace(/[A-Za-z0-9_+/=-]{20,}/g, "<id>")
    .replace(/'[^']*'/g, "'<value>'")
    .replace(/\(([^()]*)\)=\(([^()]*)\)/g, "($1)=(<value>)")
    .slice(0, MESSAGE_MAX);
}

function nameOf(error: unknown): string {
  if (error instanceof Error) return error.name;
  return typeof error;
}

function causeOf(error: unknown): unknown {
  return typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
}

/** The error and its causes, outermost first. */
export function causes(error: unknown): unknown[] {
  const chain: unknown[] = [];
  for (let link = error; link !== undefined && link !== null && chain.length < CAUSE_DEPTH && !chain.includes(link); link = causeOf(link)) chain.push(link);
  return chain;
}

/** The first SQLSTATE or socket code along the chain. */
export function errorCode(error: unknown): string | undefined {
  for (const link of causes(error)) {
    const code = typeof link === "object" && link !== null && "code" in link ? link.code : undefined;
    if (typeof code === "string" && ERROR_CODE.test(code)) return code;
  }
  return undefined;
}

/** R-SERVER-039: the line for a failure, every field checked. */
export function failureLine(failure: Failure): FailureLine {
  const { what, job, method, path, status, error } = failure;
  const cause = causeOf(error);
  const code = errorCode(error);
  return {
    level: "error",
    what,
    ...(job === undefined ? {} : { job }),
    ...(method === undefined ? {} : { method: method.toUpperCase().slice(0, 10) }),
    ...(path === undefined ? {} : { path: pathShape(path) }),
    ...(status === undefined ? {} : { status }),
    error: nameOf(error),
    message: scrubbed(error instanceof Error ? error.message : ""),
    ...(cause === undefined ? {} : { cause: nameOf(cause) }),
    ...(code === undefined ? {} : { code }),
  };
}

/** R-SERVER-039: writes the one line, at error level, as JSON. Never throws. */
export function logFailure(failure: Failure): void {
  try {
    console.error(JSON.stringify(failureLine(failure)));
  } catch {
    // A line that cannot be written is dropped; the reply never waits on the log.
  }
}
