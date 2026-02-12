import { WalkthroughDefinition } from '@remix-api'

/**
 * Built-in walkthrough definitions for Remix IDE.
 * These are registered automatically when the walkthrough plugin activates.
 * Additional walkthroughs can be registered by any plugin via the API.
 */

export const builtinWalkthroughs: WalkthroughDefinition[] = [
  {
    id: 'remix-intro',
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
        targetSelector: '[data-id="terminalContainer"]',
        title: 'Terminal',
        content: 'The terminal shows transaction logs, compilation output, and lets you run JavaScript/Solidity scripts.',
        placement: 'top',
      },
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
        title: 'Step 1: Open a Contract',
        content: 'First, open a Solidity file from the File Explorer. You can use one of the default workspace templates.',
        placement: 'right',
        preAction: {
          plugin: 'menuicons',
          method: 'select',
          args: ['filePanel'],
        },
      },
      {
        targetSelector: '[plugin="solidity"]',
        title: 'Step 2: Open the Compiler',
        content: 'Click the Solidity Compiler icon to open the compilation panel.',
        placement: 'right',
      },
      {
        targetSelector: '#compileBtn',
        title: 'Step 3: Compile',
        content: 'Click "Compile" to compile your contract. Make sure the correct compiler version is selected.',
        placement: 'bottom',
        preAction: {
          plugin: 'menuicons',
          method: 'select',
          args: ['solidity'],
        },
      },
      {
        targetSelector: '[plugin="udapp"]',
        title: 'Step 4: Open Deploy Panel',
        content: 'Now switch to the Deploy & Run panel to deploy your compiled contract.',
        placement: 'right',
      },
      {
        targetSelector: '#Deploy',
        title: 'Step 5: Deploy',
        content: 'Select your contract and click "Deploy". By default, it deploys to the Remix VM — a simulated blockchain in your browser.',
        placement: 'bottom',
        preAction: {
          plugin: 'menuicons',
          method: 'select',
          args: ['udapp'],
        },
      },
    ],
  },
  {
    id: 'remix-recorder',
    name: 'Transaction Recorder',
    description: 'Learn how to record and replay transactions across different environments.',
    sourcePlugin: 'walkthrough',
    steps: [
      {
        targetSelector: '#udappRecorderCard',
        title: 'Transactions Recorder',
        content: 'Save transactions (deployed contracts and function executions) and replay them in another environment. Transactions created in Remix VM can be replayed with an Injected Provider.',
        placement: 'right',
        preAction: {
          plugin: 'menuicons',
          method: 'select',
          args: ['udapp'],
        },
      },
      {
        targetSelector: '#udappRecorderUseLatest',
        title: 'Use Latest Compilation',
        content: 'If selected, the recorder will run transactions using the latest compilation result.',
        placement: 'right',
      },
      {
        targetSelector: '#udappRecorderSave',
        title: 'Save Scenario',
        content: 'Once one or more transactions have been executed, click this button to save them as a scenario file.',
        placement: 'right',
      },
      {
        targetSelector: '#udappRecorderRun',
        title: 'Run Scenario',
        content: 'Open a scenario file and click this button to run it against the currently selected provider.',
        placement: 'right',
      },
    ],
  },
]
