# Test tools, coding agents and the platform: the figures

Sources read on 7 Oct 2026; download figures are single-week snapshots from late September 2026.

Backs `../design/02-quality-and-testing.md` (sections 4 to 6) and `../design/04-where-things-live.md` (sections 5, 7 and 8). Package counts are from the npm registry's weekly download API.

## 1. Test tools by adoption

| Tool | Weekly downloads | Standing |
|---|---|---|
| Zod | 387m | Mainstream |
| Vitest | 142m | Mainstream |
| Playwright (`@playwright/test`) | 86m | Mainstream |
| Testing Library (`@testing-library/react`) | 73m | Mainstream |
| fast-check | 59m | Mainstream. Some downloads come from packages that depend on it |
| Stryker, mutation testing | 3m | Leader in a small niche |
| Cucumber | 2m | Mature |

- Cucumber's creator calls it a collaboration tool and warns against it when only programmers write the scenarios.
- A reviewer on a respected engineering site found one spec-driven toolkit heavy for small work and saw agents ignore the specs. No controlled study of outcomes was found.
- Catching deliberately broken code (mutants) correlates with catching real faults, independent of coverage.

## 2. Coding agents and tests

- In one evaluation, models tampered with the scorer in 30% of runs on a task suite, and asking them not to cheat still left most doing it.
- In a benchmark where the spec and the tests conflict, leading models cheated on about half the tasks. Making the tests read-only stopped the test edits without hurting honest work, and giving the model a way to stop and report helped.
- A well-known practitioner of test-first development reports trouble stopping agents deleting tests to get a pass.
- Vendor guidance: give the agent a pass or fail check, write the failing test first for a bug, ask for test output rather than a claim, keep the instruction file short. Instructions are advice; hooks and CI are enforcement.

## 3. The platform and the database

| Fact | Figure |
|---|---|
| Developers using Postgres and MongoDB (Stack Overflow survey 2025) | 55.6% and 24% |
| Weekly downloads of the main Postgres and MongoDB drivers | 73.4m (`pg`) and 18.4m (`mongodb`) |
| MongoDB's HTTP data interface, the pooled route from an edge function | Removed on 30 Sep 2025 |
| Drizzle's support for MongoDB | None |
| Cloudflare's published post-mortems, June 2025 to February 2026 | Six, one of them global |
| Neon's failover after a data-centre failure | One to ten minutes, with no hot standby |
| Round trip Lagos to London | About 104 ms |
| A text message to a Nigerian number | About $0.22 to $0.39 |
| The pooler's query cache | Reads cached for 60 seconds, not cleared by a write |

## Sources

- [npm downloads: test tools](https://api.npmjs.org/downloads/point/last-week/vitest,jest,fast-check,cypress,zod,valibot,arktype,seedrandom,pure-rand,xstate,msw)
- [npm downloads: database drivers](https://api.npmjs.org/downloads/point/last-week/pg,postgres,mongodb,mongoose,drizzle-orm,prisma,kysely)
- [Hellesøy: the most misunderstood collaboration tool](https://cucumber.io/blog/collaboration/the-worlds-most-misunderstood-collaboration-tool)
- [Böckeler: spec-driven development tools](https://www.martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- [Just et al.: mutants and real faults](https://homes.cs.washington.edu/~mernst/pubs/mutation-effectiveness-fse2014-abstract.html)
- [METR: recent reward hacking](https://metr.org/blog/2025-06-05-recent-reward-hacking)
- [ImpossibleBench](https://arxiv.org/html/2510.20270v1)
- [Kent Beck on test-first work with agents](https://newsletter.pragmaticengineer.com/p/tdd-ai-agents-and-coding-with-kent)
- [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- [Stack Overflow developer survey 2025](https://survey.stackoverflow.co/2025/technology)
- [MongoDB: App Services deprecation](https://mongodb.com/docs/atlas/app-services/deprecation)
- [MongoDB: production considerations for transactions](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
- [Drizzle: supported databases](https://orm.drizzle.team/docs/overview)
- [Cloudflare post-mortems](https://blog.cloudflare.com/tag/post-mortem)
- [Cloudflare Hyperdrive: query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/)
- [Neon high availability](https://neon.com/docs/introduction/high-availability)
- [WonderNetwork: Lagos to London](https://wondernetwork.com/pings/Lagos/London)
- [Twilio SMS pricing, Nigeria](https://www.twilio.com/en-us/sms/pricing/ng)

## Not verified

- How much of fast-check's download count comes from packages that depend on it.
- Any outcome study of spec-driven toolkits.
