#!/bin/sh
# The load test's entry (load:arrival-rate-generator, load:connection-errors-counted-apart): raises the
# open file limit for this shell and what it starts, then runs one scenario.
# k6 is a standalone tool installed apart (brew install k6); run.ts says so
# when it is missing. Arguments pass through to run.ts.
set -eu
ulimit -n 65536 2>/dev/null || ulimit -n "$(ulimit -Hn)"
cd "$(dirname "$0")/../.."
exec pnpm --silent tsx tools/load/run.ts "$@"
