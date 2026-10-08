// wrangler dev leaves its bundles in apps/gate/.wrangler, which the lint would then read.
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

export default function cleanup(): void {
  rmSync(fileURLToPath(new URL("../.wrangler", import.meta.url)), { recursive: true, force: true });
}
