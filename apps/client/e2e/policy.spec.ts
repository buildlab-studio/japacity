// server:csp-holds-every-page: the watch every browser test carries (support/policy.ts) sees a refusal when one happens,
// and a build served with the shipped headers carries both of the page's policies. Only under E2E_BUILD: the dev server
// sends no policy.
import { expect } from "@playwright/test";

import { test } from "./support/policy";

test.skip(process.env.E2E_BUILD === undefined || process.env.E2E_BUILD === "", "The dev server sends no content policy");

test("[server:csp-holds-every-page] given the page served as the platform serves it, when it loads, then it carries the enforced policy and the stricter one, with the build's style hashes written in", async ({ page }) => {
  const reply = await page.goto("/");
  const headers = reply?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy-report-only"]).toContain("require-trusted-types-for 'script'");
  expect(headers["content-security-policy-report-only"]).toMatch(/style-src 'self'( 'sha256-[A-Za-z0-9+/=]+')+;/);
  expect(headers["content-security-policy-report-only"]).not.toContain("{inline-style-hashes}");
});

test("[server:csp-holds-every-page] given the page under its policy, when something it does not allow is asked for, then the watch sees the refusal, enforced", async ({ page, policyWatch }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const image = document.createElement("img");
    image.src = "https://not-allowed.example.test/a.png";
    document.body.append(image);
  });
  // Seen twice: by the page's event and by the browser's console line, which can come a moment after.
  await expect.poll(() => [policyWatch.some((found) => found.disposition === "enforce" && found.directive === "img-src"), policyWatch.some((found) => found.disposition === "console")]).toEqual([true, true]);
  // This test's own refusal is taken off the list the watch fails on.
  policyWatch.length = 0;
});
