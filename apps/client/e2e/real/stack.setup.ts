// Before the real tests: the local stack answers, the database is migrated, and the world has ticked
// once, so its draw is on sale. Nothing here starts the stack: `pnpm dev:full` does.
import { fileURLToPath } from "node:url";

import { request } from "@playwright/test";

import { cronUrl, readLocalStack } from "../../../../tools/local/env";

export default async function stackSetup(): Promise<void> {
  const stack = readLocalStack(fileURLToPath(new URL("../../../..", import.meta.url)));
  const http = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const health = await http.get(`${stack.siteUrl}/api/health`).catch(() => null);
    if (health === null || !health.ok()) throw new Error(`Nothing answers at ${stack.siteUrl}/api/health. Start the local stack first: pnpm dev:full`);
    const mail = await http.get(`${stack.mailpitUrl}/api/v1/info`).catch(() => null);
    if (mail === null || !mail.ok()) throw new Error(`Mailpit does not answer at ${stack.mailpitUrl}. Start the local stack first: pnpm dev:full`);
    // The world's five-minute job: the ticks and the Friday draw (R-CLOCK-012, R-LOTTERY-001).
    const cron = await http.post(cronUrl(stack), { data: { cron: "*/5 * * * *" } });
    if (!cron.ok()) throw new Error(`The world's cron did not run: ${String(cron.status())} ${await cron.text()}`);
  } finally {
    await http.dispose();
  }
}
