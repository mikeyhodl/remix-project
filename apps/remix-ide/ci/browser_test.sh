#!/usr/bin/env bash

set -e



BUILD_ID=${CIRCLE_BUILD_NUM:-${TRAVIS_JOB_NUMBER}}
echo "$BUILD_ID"
TEST_EXITCODE=0
npx ganache > /dev/null 2>&1 &
npx http-server -p 9090 --cors='*' ./node_modules > /dev/null 2>&1 &
yarn run serve:production > /dev/null 2>&1 &
sleep 5

# Build the list of enabled test files and let CircleCI split them by historical timings across parallel workers.
# Produces basenames without the trailing .js so nightwatch invocation can append it.
TESTFILES=$(find dist/apps/remix-ide-e2e/src/tests -type f \( -name "*.test.js" -o -name "*.spec.js" \) -print0 \
  | xargs -0 grep -IL "@disabled" \
  | xargs -I {} basename {} \
  | sed 's/\.js$//' \
  | grep -v 'metamask' \
  | circleci tests split --split-by=timings)

# If this batch includes remixd (slither) tests, prepare pip3/slither toolchain on-demand
if echo "$TESTFILES" | grep -q "remixd"; then
  echo "Preparing pip3/slither for remixd tests"
  if ! command -v pip3 >/dev/null 2>&1; then
    echo "Installing python3 and pip3..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip
  fi
  pip3 --version || true
  # Ensure user installs are on PATH
  mkdir -p "$HOME/.local/bin"
  export PATH="$HOME/.local/bin:$PATH"
  pip3 install --user slither-analyzer solc-select || true
  slither --version || true
fi
for TESTFILE in $TESTFILES; do
    if ! npx nightwatch --config dist/apps/remix-ide-e2e/nightwatch-${1}.js dist/apps/remix-ide-e2e/src/tests/${TESTFILE}.js --env=$1; then
      if ! npx nightwatch --config dist/apps/remix-ide-e2e/nightwatch-${1}.js dist/apps/remix-ide-e2e/src/tests/${TESTFILE}.js --env=$1; then
        TEST_EXITCODE=1
        break
      fi
    fi
done

echo "$TEST_EXITCODE"
# Fail the test early and cancel the workflow
if [ "$TEST_EXITCODE" -eq 1 ]; then
  echo "❌ Test failed. Attempting to cancel the workflow..."
  curl -s -X POST \
    -H "Authorization: Basic $FAIL_FAST_TOKEN" \
    -H "Content-Type: application/json" \
    "https://circleci.com/api/v2/workflow/${CIRCLE_WORKFLOW_ID}/cancel"
  exit 1
fi
