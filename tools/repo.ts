// What the tools and the root guard tests share about the repository.
import { join } from "node:path";

/** The repository's root folder, without a trailing slash. */
export const REPO_ROOT = join(import.meta.dirname, "..");
