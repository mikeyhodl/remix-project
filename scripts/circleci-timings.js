#!/usr/bin/env node
/*
  CircleCI Timings Fetcher

  What it does
  - Queries CircleCI API v2 for recent workflow runs
  - Finds jobs within each workflow (e.g., remix-ide-browser)
  - Pulls per-test results for those jobs
  - Aggregates run_time by "file" and prints a summary + JSON

  Requirements
  - env CIRCLECI_TOKEN must be set (personal or project API token with read permissions)
  - project slug in the form: gh/<org>/<repo> (works for GitHub; use bb/ or gh/ etc. per CircleCI docs)

  Quick examples
    node scripts/circleci-timings.js --slug gh/remix-project-org/remix-project --workflow web --branch master --jobs "remix-ide-browser" --limit 10
    CIRCLECI_TOKEN=... yarn ci:timings --slug gh/remix-project-org/remix-project --workflow run_pr_tests --branch feat/my-branch --jobs "remix-ide-browser" --limit 5 --json timings.json

  Notes
  - The endpoint /project/{project-slug}/{job-number}/tests returns JUnit-parsed tests with fields {name, file, run_time, result}
  - We aggregate by "file" and compute total, avg, count, min, max
*/

const axios = require('axios');
const { program } = require('commander');
const fs = require('fs');

const BASE = 'https://circleci.com/api/v2';

function getToken() {
  const token = process.env.CIRCLECI_TOKEN || process.env.CIRCLE_TOKEN || '';
  if (!token) {
    throw new Error('CIRCLECI_TOKEN env var is required.');
  }
  return token;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function getJson(url, token, params = {}, retries = 3) {
  const headers = { 'Circle-Token': token };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await axios.get(url, { headers, params, timeout: 20000 });
      return resp.data;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(500 * (attempt + 1));
    }
  }
}

async function listWorkflowRuns({ slug, workflowName, branch, limit = 10, token }) {
  // GET /insights/{project-slug}/workflows/{workflow-name}
  const runs = [];
  let pageToken = undefined;
  while (runs.length < limit) {
    const params = { branch };
    if (pageToken) params['page-token'] = pageToken;
    const url = `${BASE}/insights/${slug}/workflows/${workflowName}`;
    const data = await getJson(url, token, params);
    const items = data.items || data.workflow_runs || [];
    for (const it of items) {
      if (runs.length >= limit) break;
      // it.id is the workflow id in modern responses; fallback to workflow-id
      runs.push({ id: it.id || it.workflow_id || it.workflow_job_id || it['workflow-id'], created_at: it.created_at, status: it.status, duration: it.duration });
    }
    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }
  return runs;
}

async function listWorkflowJobs({ workflowId, token }) {
  // GET /workflow/{id}/jobs
  const url = `${BASE}/workflow/${workflowId}/jobs`;
  const data = await getJson(url, token);
  return data.items || [];
}

async function getJobTests({ slug, jobNumber, token }) {
  // GET /project/{project-slug}/{job-number}/tests (paginated)
  const url = `${BASE}/project/${slug}/${jobNumber}/tests`;
  let items = [];
  let pageToken = undefined;
  while (true) {
    const params = pageToken ? { 'page-token': pageToken } : {};
    const data = await getJson(url, token, params);
    items = items.concat(data.items || []);
    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }
  return items;
}

function addToAgg(agg, file, sec) {
  if (!file) return;
  const key = file;
  const e = agg.get(key) || { file: key, total: 0, count: 0, min: Number.POSITIVE_INFINITY, max: 0 };
  e.total += sec || 0;
  e.count += 1;
  e.min = Math.min(e.min, sec || 0);
  e.max = Math.max(e.max, sec || 0);
  agg.set(key, e);
}

function toSortedArray(agg) {
  const arr = Array.from(agg.values()).map((e) => ({ ...e, avg: e.count ? e.total / e.count : 0 }));
  arr.sort((a, b) => b.avg - a.avg);
  return arr;
}

function human(sec) {
  if (sec >= 3600) return `${(sec / 3600).toFixed(2)}h`;
  if (sec >= 60) return `${(sec / 60).toFixed(2)}m`;
  return `${sec.toFixed(2)}s`;
}

function printTable(arr, top = 25) {
  const n = Math.min(top, arr.length);
  console.log(`\nTop ${n} files by avg duration:`);
  console.log('avg\tcount\tmin\tmax\tfile');
  for (let i = 0; i < n; i++) {
    const e = arr[i];
    console.log(`${human(e.avg)}\t${e.count}\t${human(e.min)}\t${human(e.max)}\t${e.file}`);
  }
}

function proposeSplits(arr, shards = 20) {
  // Greedy bin packing based on avg times
  const bins = Array.from({ length: shards }, () => ({ total: 0, files: [] }));
  for (const e of arr) {
    let best = 0;
    for (let i = 1; i < bins.length; i++) if (bins[i].total < bins[best].total) best = i;
    bins[best].files.push({ file: e.file, weight: e.avg });
    bins[best].total += e.avg;
  }
  return bins.map((b, i) => ({ shard: i, total_sec: b.total, total_h: human(b.total), count: b.files.length }));
}

async function main() {
  program
    .requiredOption('--slug <projectSlug>', 'CircleCI project slug, e.g., gh/org/repo')
    .requiredOption('--workflow <name>', 'Workflow name, e.g., web or run_pr_tests')
    .option('--branch <name>', 'Branch to filter by (optional)')
    .option('--jobs <name>', 'Only include job names matching this substring (default: remix-ide-browser)', 'remix-ide-browser')
    .option('--limit <n>', 'Max workflow runs to scan (default: 10)', (v) => parseInt(v, 10), 10)
    .option('--top <n>', 'How many rows to print (default: 25)', (v) => parseInt(v, 10), 25)
    .option('--shards <n>', 'Print a shard proposal for N shards', (v) => parseInt(v, 10), 0)
    .option('--json <path>', 'Path to write full JSON results (optional)')
    .parse(process.argv);

  const opts = program.opts();
  const token = getToken();

  console.log(`Fetching timings from CircleCI: slug=${opts.slug} workflow=${opts.workflow} branch=${opts.branch || 'all'} limit=${opts.limit}`);
  const runs = await listWorkflowRuns({ slug: opts.slug, workflowName: opts.workflow, branch: opts.branch, limit: opts.limit, token });
  if (!runs.length) {
    console.error('No workflow runs found.');
    process.exit(2);
  }

  const agg = new Map();
  let scannedJobs = 0;
  for (const run of runs) {
    if (!run || !run.id) continue;
    const jobs = await listWorkflowJobs({ workflowId: run.id, token });
    for (const job of jobs) {
      const name = job.name || '';
      const status = job.status || '';
      const jobNumber = job.job_number || job.jobNumber || job.number;
      if (!name.includes(opts.jobs)) continue;
      if (status && status !== 'success') continue; // only successful jobs contribute timings
      if (!jobNumber) continue;

      const tests = await getJobTests({ slug: opts.slug, jobNumber, token });
      scannedJobs++;
      for (const t of tests) {
        // t.file may be null if the reporter didn't provide it; fallback to classname
        const file = t.file || t.classname || null;
        const rt = typeof t.run_time === 'number' ? t.run_time : (typeof t.time === 'number' ? t.time : 0);
        addToAgg(agg, file, rt);
      }
    }
  }

  const arr = toSortedArray(agg);
  console.log(`\nAggregated ${arr.length} files from ${scannedJobs} successful job(s).`);
  if (!arr.length) {
    console.log('No test timing data found.');
  } else {
    printTable(arr, opts.top);
  }

  if (opts.shards && arr.length) {
    const shardPlan = proposeSplits(arr, opts.shards);
    console.log(`\nShard balance proposal for ${opts.shards} shards:`);
    shardPlan.forEach((b) => console.log(`#${b.shard}: ${human(b.total_sec)} across ${b.count} files`));
  }

  if (opts.json) {
    const out = {
      meta: { slug: opts.slug, workflow: opts.workflow, branch: opts.branch || null, limit: opts.limit, jobsFilter: opts.jobs },
      files: arr,
    };
    fs.writeFileSync(opts.json, JSON.stringify(out, null, 2));
    console.log(`\nWrote JSON to ${opts.json}`);
  }
}

main().catch((err) => {
  console.error('Failed to fetch timings:', err.response?.data || err.message || err);
  process.exit(1);
});
