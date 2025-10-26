## Summary (TL;DR)

- Faster, cheaper CI: Nx Cloud remote cache (with local fallback) + builds/tests on medium(+).
- Timed vertical shards (no CircleCI parallelism): self-split using historical timings → balanced shards and predictable wall time.
- Rerun only failed + sticky PR HTML report: quick flake handling and easy triage in PRs.
- Auto-updated E2E keyword enum after build:e2e: select single tests by topic without manual updates.
- Deterministic bundles: Monaco externalized; solc assets injected post-build → stable hashes and higher cache hit rate.
- Dev flow: run only what you need (single file, keyword, PR tests, rerun_failed, build_only/lint_only/libs_only).

CI OPTIMIZE

## New CI helpers added in this PR (brief)

<img width="865" height="601" alt="Screenshot 2025-10-25 at 20 37 56" src="https://github.com/user-attachments/assets/1d8fe5a6-05bb-4602-8011-a8c92d6348ee" />

- Auto-update E2E keyword enum: after `build:e2e`, a script scans e2e tests and refreshes the `run_file_tests_keyword` enum in `.circleci/config.yml`. Why: zero manual maintenance and no drift—new tests are immediately selectable in CI by keyword.

- Rerun only failed tests: new `rerun_failed` workflow with `rerun-failed-e2e` job that fetches failures from recent runs (configurable history/mode) and re-executes just those tests with retries. Why: faster feedback, less noise, and targeted flake handling.

### reporting

- Automatic failed run report: `post-failed-report` job waits for E2E jobs, generates an HTML summary (stored as artifacts), and comments a link on the PR. Why: instant triage without digging through raw logs.

<img width="848" height="343" alt="Screenshot 2025-10-25 at 20 34 45" src="https://github.com/user-attachments/assets/f2854f29-c3c6-42a4-89be-b1fbf18f8eb2" />

<img width="901" height="260" alt="Screenshot 2025-10-25 at 20 32 03" src="https://github.com/user-attachments/assets/95857114-19aa-4f4b-be12-1be008ab2c8c" />

![Screenshot_2025-10-22_at_09 54 51](https://github.com/user-attachments/assets/a86a7f1f-de57-4959-8c7c-054ad32d54d6)


### Other small CI improvements in this PR

- Single-test runner script tweaks (`apps/remix-ide/ci/singletest.sh`): prints build id, conditionally prepares Slither only when remixd tests are present. Why: less overhead, faster single-test runs.
- PR commenter update (`scripts/post-pr-report.js`): supports GitHub App auth (or PAT), sticky comment updates (no spam), optional commit statuses, and a clearer summary of top failing tests with a link to the HTML report. Why: reliable, concise signal in the PR.

## Cost savings (how this reduces credits)

- Smaller machines, same outcome:
	- Build on medium+ (≈15 credits/min) instead of xlarge (≈40 credits/min).
	- Tests run on medium where possible. Net: lower per-minute burn rate without compromising stability.
- Fewer minutes per pipeline:
	- Nx Cloud remote cache skips redundant builds across branches when nothing relevant changed → fewer build minutes billed.
	- Timed, self-split shards reduce idle time per node and often reduce shard count → fewer total test minutes.
- Targeted re-execution only:
	- `rerun_failed` re-runs just the failed tests (with retries) instead of the entire suite → big savings on flaky days.
- Less manual churn → fewer re-runs:
	- Auto-updated test keyword enum and the PR HTML report make it easy to select/triage the right tests fast, reducing accidental full-suite re-runs.

Rule of thumb: credits = (machine rate credits/min) × (wall minutes used). We lowered both the rate (smaller classes) and the minutes (cache hits, balanced shards, selective reruns).

## Recommended developer flow (run only what you need)

- Target a single test file by name: trigger `run_file_tests` with the exact filename (e.g., `editor_group1.test.js`) when you need that one file.
- Target by keyword/topic: trigger `run_file_keyword` using the auto-maintained enum (e.g., `editor`, `fileExplorer`) to run the main test of that topic without fiddling paths.
- PR-only tests: use `run_pr_tests` to execute the small `.pr` suite tied to your change.
- On failures: use `rerun_failed` to re-execute only the failing tests (with retries) instead of the entire suite.
- Quick checks without tests: `build_only` or `lint_only` to get signal fast when you only changed build config or TS/JS.
- Libs-only work: `libs_only` to build and test libraries in isolation.

Goal: keep the feedback loop tight—start with the smallest targeted job, and only scale up when needed.

## Docker images

- BAD: xlarge 40 credits per minute
- GOOD: build will always run on medium+ ... we can't go lower due to memory restrictions: 15 credits per minute
- GOOD: tests can easily run on medium

## Smarter shards

Our previous matrix was large with brute force approach, throw all the servers at the problem, 
but not optimized. There was basically a lot of extra idle time per machine on paralel runs. 
And also the balance between the other steps in the machine and the test run was off balance.
BAD:
<img width="2215" height="1105" alt=" " src="https://github.com/user-attachments/assets/79b22bf9-0f5a-47a5-8090-834ba4440672" />

Shards need to be optimize using the timing of the tests that we can fetch from the CI API so we can use less shards, less machines with idle time and fewer machines.

How it works (brief):
- We fetch historical test timings from CircleCI (branch, with fallback to master) and write timings-current.json.
- We no longer use CircleCI's horizontal parallelism. Instead, we run "vertical" single-machine jobs (parallelism=1) and assign each job a shard_index with vertical_mode=true.
- The E2E jobs run in self-split mode (SELF_SPLIT=1) with TIMINGS_JSON so each vertical job gets a balanced slice of tests by predicted duration.
- We can pre-plan splits with the plan_e2e_shards workflow to generate overview.txt/json and per-shard files-<i>.txt for visibility.

Why it’s good:
- Better balance across machines → less idle time and fewer machines/shards needed for the same throughput.
- More predictable total wall time and simpler scaling (increase/decrease shard_index count without CircleCI node coordination quirks).
- Deterministic, debuggable shards (each job = one shard), simpler retries or ad‑hoc reruns per shard.

Example artifact (overview.txt):

```
#0	count=18	total=312.40s
#1	count=17	total=305.12s
#2	count=17	total=303.85s
#3	count=18	total=309.07s
```




## NX CLOUD

Because we now control the remix-project org github, we could install the NX cloud app!! even on nx 15.7

This commit sets up Nx Cloud in the Nx workspace, enabling distributed caching and the Nx Cloud GitHub integration for fast CI and improved developer experience.

### what it does and what it does NOT :)

- Nx cloud provides a build target cache, remotely
- So when a build runs, it will either get the cache from the remote and run really quickly, OR it will build again, with normal speed. 
- This means that most of the time, plugins ( like solhint, etc ) won't be rebuilt at all during the CI build step, making it faster overall, saves minutes.
- The cache applies across all branches! so if another one builds you benefit ... if there is no change 
- What it does NOT do is cache builds from your local dev, that wouldn't work because the build hashes are different. You work with local cache, that's just fine.

You can access the orgs Nx Cloud workspace by going to
[NX cloud](https://cloud.nx.app/orgs/68f3785bee8dae2b4d02842a/workspaces/68f3787fc0580a5ddf2ba4b0)

- had to do some things different with the solc assets and version.txt and Inject E2E test configuration to avoid cache de-validation of the IDE 

When nothing needs to be built! fun fun fun

<img width="987" height="70" alt="Screenshot 2025-10-19 at 10 20 01" src="https://github.com/user-attachments/assets/0f195728-3367-4167-894a-a9855d128da6" />

<img width="952" height="644" alt="Screenshot 2025-10-19 at 09 53 26" src="https://github.com/user-attachments/assets/8c4960a1-8388-4ad9-94e5-b7a4ef7685f3" />

## PEFORMANCE IMPROVEMENTS

- Remove Monaco from the bundle: we now load Monaco from a JS source instead of bundling it, reducing bundle size and keeping build outputs stable.
- Some pipeline optimization.



## CONFIG STUFF

- all of this relies on the NX_CLOUD_ACCESS_TOKEN which is set in CI config and can be generated fetched from the NX cloud settings

### Deterministic caches for Nx Cloud

- Webpack/cache hygiene: avoid bundling volatile assets (e.g., Monaco) so build artifacts are deterministic across runs.
- Solc assets separated from build: we download solc/wasm assets in CI (downloadsolc_assets_e2e) and inject URLs post-build (inject-e2e-config), so asset availability doesn’t invalidate the Nx cache for the IDE bundle.
- Result: more cache hits across branches and PRs, faster CI with fewer rebuilds.

## TODO

- add the NX token to netlify to allow cached builds
- to have full concurrency in CIRCLE so no more waiting in queue we need a new plan

