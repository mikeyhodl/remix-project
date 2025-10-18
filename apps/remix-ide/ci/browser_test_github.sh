#!/usr/bin/env bash

set -e

BUILD_ID=${GITHUB_RUN_NUMBER:-0}
echo "$BUILD_ID"
TEST_EXITCODE=0
npx ganache > /dev/null 2>&1 &
npx http-server -p 9090 --cors='*' ./node_modules > /dev/null 2>&1 &
yarn run serve:production > /dev/null 2>&1 &
sleep 5

TESTFILES=$(node apps/remix-ide/ci/splice_tests.js $2 $3 | grep -v 'metamask')
echo "Running tests: $TESTFILES"
for TESTFILE in $TESTFILES; do
    npx nightwatch@2.3 --config dist/apps/remix-ide-e2e/nightwatch-${1}.js dist/apps/remix-ide-e2e/src/tests/${TESTFILE}.js --env=$1 || npx nightwatch@2.3 --config dist/apps/remix-ide-e2e/nightwatch-${1}.js dist/apps/remix-ide-e2e/src/tests/${TESTFILE}.js --env=$1 || TEST_EXITCODE=1
done

echo "$TEST_EXITCODE"
if [ "$TEST_EXITCODE" -eq 1 ]
then
  exit 1
fi
