# Load test results

Each run writes here:

- `plan.json`: the numbers the generator read;
- `k6-<scenario>.json`: k6's raw summary;
- `summary-<scenario>-<time>.md` and its `.json` (load:run-summary-recorded);
- `accounts.json`: the seeding's manifest.

Only this file and the `.gitignore` are committed. Paste the summary's Markdown into the description of the change that adds or alters the test.
