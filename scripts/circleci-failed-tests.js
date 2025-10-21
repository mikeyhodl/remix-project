#!/usr/bin/env node
/*
  CircleCI Failed Tests Fetcher

  Usage:
    CIRCLECI_TOKEN=... node scripts/circleci-failed-tests.js --slug gh/org/repo --workflow web --branch feat/x --jobs "remix-ide-browser" --limit 1

  Prints failing E2E test basenames (no .js) from the most recent workflow run on the given branch.
*/

const axios = require('axios');
const { program } = require('commander');

const BASE = 'https://circleci.com/api/v2';

function normalizeSlug(slug) {
  if (!slug) return slug;
  if (slug.startsWith('github/')) return slug.replace(/^github\//, 'gh/');
  if (slug.startsWith('bitbucket/')) return slug.replace(/^bitbucket\//, 'bb/');
  return slug;
}

function getToken() {
  const token = process.env.CIRCLECI_TOKEN || process.env.CIRCLE_TOKEN || '';
  if (!token) throw new Error('CIRCLECI_TOKEN env var is required.');
  return token;
}

async function getJson(url, token, params = {}, retries = 3) {
  const headers = { 'Circle-Token': token };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await axios.get(url, { headers, params, timeout: 20000 });
      return resp.data;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

async function listWorkflowRuns({ slug, workflowName, branch, limit = 1, token }) {
  let pageToken;
  const params = {};
  if (branch) params.branch = branch;
  const url = `${BASE}/insights/${slug}/workflows/${workflowName}/runs`;
  const data = await getJson(url, token, params);
  const items = (data.items || []).filter(Boolean);
  return items.slice(0, limit).map((it) => ({ id: it.id, status: it.status, created_at: it.created_at }));
}

async function listWorkflowJobs({ workflowId, token }) {
  const url = `${BASE}/workflow/${workflowId}/job`;
  const data = await getJson(url, token);
  return data.items || [];
}

async function getJobTests({ slug, jobNumber, token }) {
  const url = `${BASE}/project/${slug}/${jobNumber}/tests`;
  let items = [];
  let pageToken;
  while (true) {
    const params = pageToken ? { 'page-token': pageToken } : {};
    const data = await getJson(url, token, params);
    items = items.concat(data.items || []);
    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }
  return items;
}

function baseNameNoJs(p) {
  const x = String(p || '').trim().split(/[\\/]/).pop();
  return x.replace(/\.js$/i, '');
}

async function main() {
  program
    .option('--slug <projectSlug>', 'CircleCI project slug, e.g., gh/org/repo')
    .option('--workflow <name>', 'Workflow name, e.g., web')
    .option('--branch <name>', 'Branch to filter by (optional)')
    .option('--jobs <substr>', 'Include only jobs whose name contains this substring', 'remix-ide-browser')
    .option('--limit <n>', 'Number of workflow runs to check (default 1)', (v) => parseInt(v, 10), 1)
    .option('--verbose', 'Verbose logging', false)
    .parse(process.argv);

  const opts = program.opts();
  const token = getToken();
  let slug = normalizeSlug(opts.slug || process.env.CIRCLECI_PROJECT_SLUG || '');
  if (!slug) throw new Error('Missing --slug or CIRCLECI_PROJECT_SLUG');
  if (!opts.workflow) throw new Error('Missing --workflow');

  const runs = await listWorkflowRuns({ slug, workflowName: opts.workflow, branch: opts.branch, limit: opts.limit, token });
  if (!runs.length) return;

  const failing = new Set();
  for (const run of runs) {
    const jobs = await listWorkflowJobs({ workflowId: run.id, token });
    for (const job of jobs) {
      const name = job.name || '';
      const jobNumber = job.job_number || job.number;
      if (!name.includes(opts.jobs) || !jobNumber) continue;
      const tests = await getJobTests({ slug, jobNumber, token });
      for (const t of tests) {
        const result = (t.result || '').toLowerCase();
        if (result && result !== 'success' && result !== 'passed') {
          const file = t.file || t.classname || null;
          if (!file) continue;
          failing.add(baseNameNoJs(file));
        }
      }
    }
    // only last run by default
    break;
  }

  for (const name of failing) {
    process.stdout.write(name + '\n');
  }
}

main().catch((e) => {
  console.error('Failed to fetch failed tests:', e.response?.data || e.message || e);
  process.exit(1);
});
