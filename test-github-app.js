const { createAppAuth } = require('@octokit/auth-app');

const appId = process.env.CI_PR_BOT_APP_ID || process.env.APP_ID;
const installationId = process.env.CI_PR_BOT_INSTALLATION_ID || process.env.INSTALLATION_ID;
let privateKey = process.env.CI_PR_BOT_PRIVATE_KEY || process.env.APP_PRIVATE_KEY;

// Handle escaped newlines
if (privateKey && privateKey.includes('\\n')) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

console.log('Testing GitHub App authentication...\n');
console.log('App ID:', appId);
console.log('Installation ID:', installationId);
console.log('Private key configured:', !!privateKey);
console.log('Private key length:', privateKey?.length);

const auth = createAppAuth({
  appId,
  privateKey,
  installationId,
});

auth({ type: 'installation' })
  .then(async ({ token }) => {
    console.log('\n✓ Installation token obtained');
    console.log('Token preview:', token.substring(0, 20) + '...');
    
    // Try to get repositories accessible to this installation
    const reposResponse = await fetch('https://api.github.com/installation/repositories', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    
    if (!reposResponse.ok) {
      console.log('\nRepos API error:', reposResponse.status, await reposResponse.text());
    } else {
      const repos = await reposResponse.json();
      console.log('\n=== Installation Access ===');
      console.log('Total repositories:', repos.total_count);
      console.log('Repositories:');
      repos.repositories?.forEach(repo => {
        console.log(`  - ${repo.full_name}`);
      });
    }
    
    // Try to comment on a PR (the actual use case)
    const prNumber = process.env.CIRCLE_PR_NUMBER || process.env.PR_NUMBER;
    if (prNumber) {
      console.log(`\nTesting comment on PR #${prNumber}...`);
      const commentResponse = await fetch(
        `https://api.github.com/repos/remix-project-org/remix-project/issues/${prNumber}/comments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: '🤖 Test comment from GitHub App (will be deleted)',
          }),
        }
      );
      
      if (!commentResponse.ok) {
        console.log('Comment error:', commentResponse.status, await commentResponse.text());
      } else {
        const comment = await commentResponse.json();
        console.log('✓ Comment posted as:', comment.user.login, `(type: ${comment.user.type})`);
        console.log('Comment ID:', comment.id);
      }
    }
  })
  .catch(err => {
    console.error('\n✗ Auth failed:', err.message);
    process.exit(1);
  });
