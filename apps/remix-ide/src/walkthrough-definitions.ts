import { WalkthroughDefinition } from '@remix-api'

/**
 * Built-in walkthrough definitions for Remix IDE.
 * These are registered automatically when the walkthrough plugin activates.
 * Additional walkthroughs can be registered by any plugin via the API.
 */

export const builtinWalkthroughs: WalkthroughDefinition[] = [
  {
    id: 'remix-intro-basics',
    name: 'Getting Started with Remix',
    description: 'A quick tour of the Remix IDE interface and basic features.',
    sourcePlugin: 'walkthrough',
    steps: [
      {
        targetSelector: '[data-id="verticalIconsHomeIcon"]',
        title: 'Welcome to Remix IDE',
        content: 'This is your home button. Click it anytime to return to the landing page with quick links and resources.',
        placement: 'right',
      },
      {
        targetSelector: '[plugin="filePanel"]',
        title: 'File Explorer',
        content: 'The File Explorer lets you create, open, and manage your Solidity files and workspaces.',
        placement: 'right',
        preAction: {
          plugin: 'menuicons',
          method: 'select',
          args: ['filePanel'],
        },
      },
      {
        targetSelector: '[plugin="solidity"]',
        title: 'Solidity Compiler',
        content: 'Compile your contracts here. You can configure compiler versions, optimization, and more.',
        placement: 'right',
        preAction: {
          plugin: 'menuicons',
          method: 'select',
          args: ['solidity'],
        },
      },
      {
        targetSelector: '[plugin="udapp"]',
        title: 'Deploy & Run',
        content: 'Deploy your compiled contracts and interact with them. Choose between Remix VM, injected providers (MetaMask), or external providers.',
        placement: 'right',
        preAction: {
          plugin: 'menuicons',
          method: 'select',
          args: ['udapp'],
        },
      },
      {
        targetSelector: '[plugin="remixaiassistant"]',
        title: 'AI Assistant',
        content: 'Remix has a built-in <b>AI assistant</b> that can explain code, find bugs, suggest fixes, and even generate contracts from a prompt. Open it anytime to chat with AI about your Solidity code.',
        placement: 'right',
        preAction: {
          plugin: 'menuicons',
          method: 'select',
          args: ['remixaiassistant'],
        },
      },
      {
        targetSelector: '[plugin="dgit"]',
        title: 'Git Integration',
        content: 'The <b>Git plugin</b> lets you initialize repos, commit changes, push/pull to GitHub, and manage branches — all without leaving the IDE.',
        placement: 'right',
        preAction: {
          plugin: 'menuicons',
          method: 'select',
          args: ['dgit'],
        },
      },
      {
        targetSelector: '[data-id="github-dropdown-toggle-login"]',
        title: 'GitHub Login',
        content: 'Click here to <b>sign in with GitHub</b>. Once connected you can clone private repos, push changes, and publish Gists directly from Remix.',
        placement: 'bottom',
      }
    ],
  },
  {
    id: 'remix-compile-deploy',
    name: 'Compile & Deploy a Contract',
    description: 'Step-by-step guide to compiling and deploying your first smart contract.',
    sourcePlugin: 'walkthrough',
    steps: [
      {
        targetSelector: '[plugin="filePanel"]',
        title: 'Step 1: Create a Workspace',
        content: 'We\'ll create a fresh workspace with a sample contract for you. A new <b>"LearnDeploy"</b> workspace is being set up with the default Remix template.',
        placement: 'right',
        preAction: [
          { plugin: 'filePanel', method: 'createWorkspace', args: ['LearnDeploy', 'remixDefault', false] },
          { plugin: 'menuicons', method: 'select', args: ['filePanel'] },
        ],
      },
      {
        targetSelector: '#editor-container',
        title: 'Step 2: Open the Contract',
        content: 'Here is <b>1_Storage.sol</b> — a simple contract that stores and retrieves a number. Take a look at the code!',
        placement: 'left',
        preAction: {
          plugin: 'fileManager',
          method: 'open',
          args: ['contracts/1_Storage.sol'],
        },
      },
      {
        targetSelector: '[plugin="solidity"]',
        title: 'Step 3: Open the Compiler',
        content: 'Click the <b>Solidity Compiler</b> icon in the side panel to open the compilation view.',
        placement: 'right',
        preAction: {
          plugin: 'menuicons',
          method: 'select',
          args: ['solidity'],
        },
      },
      {
        targetSelector: '#compileBtn',
        title: 'Step 4: Compile the Contract',
        content: 'We\'re compiling <b>1_Storage.sol</b> for you now. Watch the compiler panel — when it succeeds you\'ll see a green check mark.',
        placement: 'bottom',
        preAction: {
          plugin: 'solidity',
          method: 'compile',
          args: ['contracts/1_Storage.sol'],
        },
        clickDelay: 1000,
      },
      {
        targetSelector: '[plugin="udapp"]',
        title: 'Step 5: Open the Deploy Panel',
        content: 'Now switch to <b>Deploy & Run Transactions</b>. This is where you deploy compiled contracts and interact with them.',
        placement: 'right',
        preAction: {
          plugin: 'menuicons',
          method: 'select',
          args: ['udapp'],
        },
      },
      {
        targetSelector: '[data-id="Deploy - transact (not payable)"]',
        title: 'Step 6: Deploy!',
        content: 'We\'re deploying the Storage contract to the <b>Remix VM</b> for you — a simulated blockchain running in your browser. No real funds needed!',
        placement: 'bottom',
        clickSelector: '[data-id="deployAndRunClearInstances"]',
        clickDelay: 500,
      },
      {
        targetSelector: '*[data-shared="universalDappUiInstance"]',
        title: 'Step 7: Interact with Your Contract',
        content: 'Your contract is now deployed! The instance appears here. You can call <b>store()</b> to save a number and <b>retrieve()</b> to read it back. Try it out!',
        placement: 'top',
        clickSelector: '[data-id="Deploy - transact (not payable)"]',
        clickDelay: 2000,
      },
      {
        targetSelector: '*[data-id="universalDappUiContractActionWrapper"]',
        title: 'Step 8: Contract Functions',
        content: 'Here are all the functions of your contract. <b>Orange</b> buttons are write functions (transactions) and <b>blue</b> buttons are read-only (free calls). Try calling <b>store()</b> with a number and then <b>retrieve()</b> to read it back! 🎉',
        placement: 'top',
        clickSelector: '[data-id="universalDappUiTitleExpander0"]',
        clickDelay: 500,
      },
    ],
  },
  ]
