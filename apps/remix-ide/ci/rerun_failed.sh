#!/usr/bin/env bash

set -e

BUILD_ID=${CIRCLE_BUILD_NUM:-${TRAVIS_JOB_NUMBER}}
echo "$BUILD_ID"
TEST_EXITCODE=0

# Start required services
npx ganache > /dev/null 2>&1 &
npx http-server -p 9090 --cors='*' ./node_modules > /dev/null 2>&1 &
yarn run serve:production > /dev/null 2>&1 &
sleep 5

mkdir -p reports/failed

# Compile tests if dist is missing
if [ ! -d "dist/apps/remix-ide-e2e/src/tests" ]; then
  echo "dist not found; compiling E2E tests..."
  yarn inject-e2e-config
  yarn run build:e2e
fi

# Fetch failing test basenames from last workflow run
FAILED_BASENAMES=""
if [ -n "${CIRCLECI_TOKEN:-}" ]; then
  echo "Fetching last run failing tests for branch ${CIRCLE_BRANCH:-all}..."
  FAILED_BASENAMES=$(node scripts/circleci-failed-tests.js --slug ${CIRCLECI_PROJECT_SLUG:-gh/remix-project-org/remix-project} --workflow web --branch "${CIRCLE_BRANCH:-}" --jobs "remix-ide-browser" --limit 1 || true)
else
  echo "CIRCLECI_TOKEN not set; cannot fetch failed tests. Exiting without running."
  exit 0
fi

# Build file list from basenames
TESTFILES=""
if [ -n "$FAILED_BASENAMES" ]; then
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    TESTFILES+="$name\n"
  done <<< "$FAILED_BASENAMES"
fi

echo -e "$TESTFILES" | sed '/^$/d' > reports/failed/files.txt
COUNT=$(wc -l < reports/failed/files.txt | awk '{print $1}')

if [ "$COUNT" -eq 0 ]; then
  echo "No failing tests found in last run."
  exit 0
fi

echo "Will rerun $COUNT failing test(s):"
cat reports/failed/files.txt

# Default to single attempt for clean measurement unless overridden
E2E_RETRIES=${E2E_RETRIES:-0}

for TESTFILE in $(cat reports/failed/files.txt); do
  echo "Running failed test: ${TESTFILE}.js"
  attempt=0
  while true; do
    if npx nightwatch --config dist/apps/remix-ide-e2e/nightwatch-${1}.js dist/apps/remix-ide-e2e/src/tests/${TESTFILE}.js --env=$1; then
      break
    fi
    if [ "$attempt" -lt "$E2E_RETRIES" ]; then
      attempt=$((attempt+1))
      echo "Retrying ${TESTFILE}.js (attempt $attempt of $E2E_RETRIES)"
      continue
    else
      TEST_EXITCODE=1
      break
    fi
  done
  [ "$TEST_EXITCODE" -eq 1 ] && break
done

# Exit with failure if any test failed again
if [ "$TEST_EXITCODE" -eq 1 ]; then
  exit 1
fi
