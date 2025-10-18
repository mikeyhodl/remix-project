# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the Remix IDE project.

## Workflows

### 1. Build and Cache (`build-and-cache.yml`)

**Purpose:** Automatically builds the project and caches artifacts to NX Cloud on every push.

**Triggers:**
- Push to `master`, `main`, `develop`, `feat/**`, `fix/**` branches
- Pull requests to `master`, `main`, `develop` branches

**What it does:**
- Checks out the code
- Installs Node.js (version from `.nvmrc`)
- Installs dependencies with Yarn
- Builds all projects using NX
- Uploads build artifacts to NX Cloud cache

**Benefits:**
- Free caching using GitHub Actions runners (public repos)
- Pre-warms the NX Cloud cache for CircleCI jobs
- Fast feedback on build status

---

### 2. E2E Chrome Tests - On Demand (`e2e-chrome-on-demand.yml`)

**Purpose:** Runs end-to-end Chrome browser tests manually when needed.

**Triggers:**
- Manual trigger via GitHub UI (Actions tab → E2E Tests - Chrome → Run workflow)

**Inputs:**
- `test_pattern` (optional): Glob pattern to filter tests
  - Example: `dist/apps/remix-ide-e2e/src/tests/*group1*.test.js`
  - Leave empty to run all tests

**What it does:**
1. Builds the project from NX Cloud cache
2. Injects E2E test configuration (localhost URLs)
3. Downloads Solidity compiler assets
4. Installs Chrome and ChromeDriver
5. Runs Nightwatch E2E tests
6. Uploads screenshots and reports on failure

**Usage:**
```bash
# Via GitHub CLI
gh workflow run "E2E Tests - Chrome (On Demand)" \
  -f test_pattern="dist/apps/remix-ide-e2e/src/tests/*group1*.test.js"

# Or use the GitHub web UI:
# 1. Go to Actions tab
# 2. Click "E2E Tests - Chrome (On Demand)"
# 3. Click "Run workflow"
# 4. Optionally enter a test pattern
# 5. Click "Run workflow"
```

---

## Setup Requirements

### GitHub Secrets

Ensure the following secret is set in your GitHub repository settings:

- `NX_CLOUD_ACCESS_TOKEN`: Your NX Cloud access token
  - Get it from: https://nx.app/orgs/your-org/settings
  - Or from environment: `echo $NX_CLOUD_ACCESS_TOKEN`
  - Set it at: Repository Settings → Secrets and variables → Actions → New repository secret

### .nvmrc File

The workflows use the Node.js version specified in `.nvmrc`. Ensure this file exists:

```bash
cat .nvmrc
# Should output: v20
```

---

## Comparison with CircleCI

| Feature | GitHub Actions | CircleCI |
|---------|---------------|----------|
| **Cost** | Free (public repos) | Paid minutes |
| **Speed** | Standard runners | Configurable resources |
| **Use Case** | Build caching | Full CI/CD pipeline |
| **Triggers** | Push, PR, manual | Push, scheduled |
| **E2E Tests** | On-demand only | Automated on every push |

**Strategy:**
- Use **GitHub Actions** for cheap build caching on every push
- Use **CircleCI** for comprehensive testing and deployment
- Both share the same NX Cloud cache for maximum efficiency

---

## Monitoring

### Build Status

Check workflow runs:
- GitHub UI: Repository → Actions tab
- Badge: Add to README:
  ```markdown
  ![Build](https://github.com/remix-project-org/remix-project/actions/workflows/build-and-cache.yml/badge.svg)
  ```

### NX Cloud Dashboard

View cache hit rates and performance:
- https://nx.app/

---

## Troubleshooting

### Workflow fails with "NX_CLOUD_ACCESS_TOKEN not found"

1. Check if the secret is set in repository settings
2. Verify the secret name matches exactly (case-sensitive)
3. Ensure you have repository admin access to view secrets

### E2E tests fail with "Cannot find ChromeDriver"

The `install_webdriver` script should handle this. If it fails:
1. Check if the script exists: `apps/remix-ide-e2e/install-webdriver.sh`
2. Manually specify ChromeDriver version in the workflow

### Build is not using NX Cloud cache

1. Verify `NX_CLOUD_ACCESS_TOKEN` is set correctly
2. Check NX Cloud dashboard for your organization
3. Ensure `nx.json` has the correct runner configuration

---

## Future Improvements

- [ ] Add workflow for running specific test groups (group1, group2, etc.)
- [ ] Matrix build for multiple Node.js versions
- [ ] Automatic retry on flaky tests
- [ ] Parallel test execution
- [ ] Integration with GitHub Checks API for better PR feedback
