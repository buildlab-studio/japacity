// Before the real tests: the local stack answers, the database is migrated, and the world has ticked
// once, so its draw is on sale. Nothing here starts the stack: `pnpm dev:full` does.
import { fileURLToPath } from "node:url";

import { request, test } from "@playwright/test";

import { realTarget } from "../../../../tools/local/access";
import { cronUrl, readLocalStack } from "../../../../tools/local/env";

async function stackSetup(): Promise<void> {
  const stack = readLocalStack(fileURLToPath(new URL("../../../..", import.meta.url)));
  const target = realTarget(process.env, stack.siteUrl);
  const http = await request.newContext({ ignoreHTTPSErrors: target.local, extraHTTPHeaders: target.headers });
  try {
    const health = await http.get(`${target.baseUrl}/api/health`, { maxRedirects: 0 }).catch(() => null);
    if (!target.local) {
      // Staging is behind Access: without the service token's headers it answers 302 to the sign-in page.
      if (health === null || health.status() !== 200) throw new Error(`${target.baseUrl}/api/health did not answer 200 (${String(health?.status() ?? "no answer")}). Set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET from your keychain or secret store.`);
      return;
    }
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

test("before the real tests, the stack answers and the world has ticked", async () => {
  await stackSetup();
});
