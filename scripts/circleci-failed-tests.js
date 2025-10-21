#!/usr/bin/env node
/*
  CircleCI Failed Tests Fetcher

  Usage:
    CIRCLECI_TOKEN=... node scripts/circleci-failed-tests.js --slug gh/org/repo --workflow web --branch feat/x --jobs "remix-ide-browser" --limit 1

  Prints failing E2E test basenames (no .js) from the most recent workflow run on the given branch.
*/

const axios = require('axios');
const { program } = require('commander');
const fs = require('fs');
const child_process = require('child_process');

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
  const results = [];
  let pageToken;
  while (results.length < limit) {
    const params = {};
    if (branch) params.branch = branch;
    if (pageToken) params['page-token'] = pageToken;
    const url = `${BASE}/insights/${slug}/workflows/${workflowName}/runs`;
    const data = await getJson(url, token, params);
    const items = (data.items || []).filter(Boolean);
    for (const it of items) {
      if (results.length >= limit) break;
      results.push({ id: it.id, status: it.status, created_at: it.created_at });
    }
    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }
  return results;
}

async function listPipelines({ slug, branch, limit = 10, token }) {
  const results = [];
  let pageToken;
  while (results.length < limit) {
    const params = {};
    if (branch) params.branch = branch;
    if (pageToken) params['page-token'] = pageToken;
    const url = `${BASE}/project/${slug}/pipeline`;
    const data = await getJson(url, token, params);
    const items = data.items || [];
    for (const it of items) {
      if (results.length >= limit) break;
      results.push({ id: it.id, number: it.number, created_at: it.created_at, state: it.state, trigger: it.trigger });
    }
    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }
  return results;
}

async function listPipelineWorkflows({ pipelineId, token }) {
  const url = `${BASE}/pipeline/${pipelineId}/workflow`;
  const data = await getJson(url, token);
  return data.items || [];
}

function parseRepoUrl(url) {
  if (!url) return null;
  const httpsMatch = url.match(/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/);
  if (httpsMatch) {
    const parts = httpsMatch[0].split('/');
    const org = parts[1];
    const repo = parts[2].replace(/\.git$/, '');
    return { org, repo };
  }
  const sshMatch = url.match(/github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git/);
  if (sshMatch) return { org: sshMatch[1], repo: sshMatch[2] };
  return null;
}

function getGitOriginUrlCwd() {
  try {
    const out = child_process.execSync('git config --get remote.origin.url', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return out || null;
  } catch (_) { return null; }
}

function deriveSlugCandidates({ providedSlug, repoUrl, pkgRepoUrl }) {
  const cands = new Set();
  if (providedSlug) cands.add(normalizeSlug(providedSlug));
  const add = (org, repo) => { if (org && repo) cands.add(`gh/${org}/${repo}`); };
  const fromGit = parseRepoUrl(repoUrl || '');
  const fromPkg = parseRepoUrl(pkgRepoUrl || '');
  if (fromGit) add(fromGit.org, fromGit.repo);
  if (fromPkg) add(fromPkg.org, fromPkg.repo);
  return Array.from(cands);
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
    .option('--mode <m>', "Selection mode: 'first-failed' (default) or 'union' across runs", 'first-failed')
    .option('--verbose', 'Verbose logging', false)
    .parse(process.argv);

  const opts = program.opts();
  const token = getToken();
  const pkgRepoUrl = (() => { try { const p = JSON.parse(fs.readFileSync('package.json','utf-8')); return p?.repository?.url || null; } catch { return null; } })();
  const candSlugs = deriveSlugCandidates({ providedSlug: opts.slug || process.env.CIRCLECI_PROJECT_SLUG || '', repoUrl: getGitOriginUrlCwd(), pkgRepoUrl });
  if (!candSlugs.length) throw new Error('Missing --slug and unable to derive CIRCLECI project slug');
  if (!opts.workflow) throw new Error('Missing --workflow');

  let slug = null;
  let runs = [];
  let lastErr = null;
  for (const s of candSlugs) {
    try {
      runs = await listWorkflowRuns({ slug: s, workflowName: opts.workflow, branch: opts.branch, limit: opts.limit, token });
      slug = s;
      break;
    } catch (e) {
      lastErr = e;
      // try pipelines fallback
      try {
        const pipes = await listPipelines({ slug: s, branch: opts.branch, limit: Math.max(50, opts.limit * 5), token });
        const wf = [];
        for (const p of pipes) {
          const wfs = await listPipelineWorkflows({ pipelineId: p.id, token });
          for (const w of wfs) {
            if (w.name === opts.workflow) wf.push({ id: w.id, status: w.status, created_at: p.created_at });
            if (wf.length >= opts.limit) break;
          }
          if (wf.length >= opts.limit) break;
        }
        if (wf.length) { runs = wf; slug = s; break; }
      } catch (e2) {
        lastErr = e2;
      }
    }
  }

  if (!slug || !runs.length) {
    throw lastErr || new Error('Unable to find workflow runs via Insights or Pipelines for any candidate slug');
  }

  const failing = new Set();
  for (const run of runs) {
    const jobs = await listWorkflowJobs({ workflowId: run.id, token });
    const targetJobs = jobs.filter((j) => (j.name || '').includes(opts.jobs));
    const failingJobs = targetJobs.filter((j) => (j.status || '') !== 'success');
    if (opts.mode === 'first-failed') {
      if (!failingJobs.length) {
        if (opts.verbose) console.error(`Run ${run.id} has no failing jobs; moving to older run.`);
        continue; // check older runs until we find failing ones
      }
      for (const job of failingJobs) {
        const jobNumber = job.job_number || job.number;
        if (!jobNumber) continue;
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
      break; // stop at the first run with failures
    } else {
      // union mode: collect across up to N runs, only from failing jobs
      for (const job of failingJobs) {
        const jobNumber = job.job_number || job.number;
        if (!jobNumber) continue;
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
    }
  }

  for (const name of failing) {
    process.stdout.write(name + '\n');
  }
}

main().catch((e) => {
  console.error('Failed to fetch failed tests:', e.response?.data || e.message || e);
  process.exit(1);
});
