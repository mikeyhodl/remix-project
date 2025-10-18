#!/usr/bin/env bash

set -e

BUILD_ID=${GITHUB_RUN_NUMBER:-0}
echo "$BUILD_ID"
TEST_EXITCODE=0

# Start services
npx ganache &
npx http-server -p 9090 --cors='*' ./node_modules &
yarn run serve:production &
sleep 5

# Get test files using splice_tests.js and split across jobs
TESTFILES=$(node apps/remix-ide/ci/splice_tests.js $2 $3 | grep -v 'metamask')
echo "Running tests: $TESTFILES"

for TESTFILE in $TESTFILES; do
    echo "Running test: $TESTFILE"
    if ! npx nightwatch --config dist/apps/remix-ide-e2e/nightwatch-${1}.js dist/apps/remix-ide-e2e/src/tests/${TESTFILE}.js --env=$1; then
        echo "Test failed, retrying once..."
        if ! npx nightwatch --config dist/apps/remix-ide-e2e/nightwatch-${1}.js dist/apps/remix-ide-e2e/src/tests/${TESTFILE}.js --env=$1; then
            TEST_EXITCODE=1
            break
        fi
    fi
done

echo "$TEST_EXITCODE"
if [ "$TEST_EXITCODE" -eq 1 ]; then
  echo "❌ Test failed"
  exit 1
fi
