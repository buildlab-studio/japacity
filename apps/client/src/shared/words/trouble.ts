// R-ENGINE-015: a failed request in the player's words, by its kind (`ui.trouble.*`): never the error's own text,
// which may be a browser's ("Load failed") or the request function's class string. A fault that is no request's is
// said as ours.
import { failureOf } from "../net/http";
import { say } from "./text";

export function troubleWords(error: unknown): string {
  return say(`ui.trouble.${failureOf(error) ?? "server"}`);
}
