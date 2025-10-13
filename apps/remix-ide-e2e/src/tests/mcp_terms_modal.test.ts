'use strict'

import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
  '@disabled': true,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },

  'Should clear localStorage for MCP terms before tests': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        // Clear any existing MCP terms acceptance
        localStorage.removeItem('remix_mcp_terms_accepted');
        return true;
      })
  },

  'Should show MCP terms modal on first loadMCPServersFromSettings call': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;

        // Clear terms acceptance to simulate first use
        localStorage.removeItem('remix_mcp_terms_accepted');

        // Call loadMCPServersFromSettings which should trigger the modal
        const loadPromise = aiPlugin.loadMCPServersFromSettings();

        // Wait a bit for the modal to appear
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if modal is visible
        const modal = document.querySelector('[data-id="mcp-terms-modal"]') || document.querySelector('.modal-content');
        const modalVisible = modal !== null;

        return {
          modalVisible,
          modalTitle: modal?.querySelector('.modal-title')?.textContent || '',
          hasAcceptButton: modal?.querySelector('.modal-ok-btn') !== null ||
                          document.querySelector('button')?.textContent.includes('I Accept'),
          hasDeclineButton: modal?.querySelector('.modal-cancel-btn') !== null ||
                           document.querySelector('button')?.textContent.includes('I Decline')
        };
      }, [], function (result) {
        browser.assert.strictEqual(result.value.modalVisible, true, 'MCP terms modal should be visible');
        browser.assert.ok(result.value.modalTitle.includes('MCP'), 'Modal title should mention MCP');
        browser.assert.strictEqual(result.value.hasAcceptButton, true, 'Modal should have Accept button');
        browser.assert.strictEqual(result.value.hasDeclineButton, true, 'Modal should have Decline button');
      });
  },

  'Should display comprehensive terms content': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;

        // Trigger the terms modal
        const termsPromise = aiPlugin.checkMCPTermsAcceptance();

        // Wait for modal to appear
        await new Promise(resolve => setTimeout(resolve, 500));

        // Extract modal content
        const modalContent = document.querySelector('.modal-body')?.textContent ||
                           document.querySelector('.modal-content')?.textContent || '';

        return {
          hasOverview: modalContent.includes('Overview'),
          hasDataCollection: modalContent.includes('Data Collection'),
          hasDataSharing: modalContent.includes('Data Sharing'),
          hasDataSecurity: modalContent.includes('Data Security'),
          hasDataRetention: modalContent.includes('Data Retention'),
          hasUserRights: modalContent.includes('Your Rights'),
          hasConsent: modalContent.includes('Consent'),
          mentionsWorkspaceData: modalContent.includes('Workspace Data') || modalContent.includes('workspace'),
          mentionsExternalServers: modalContent.includes('external servers') || modalContent.includes('External Servers'),
          mentionsPrivateKeys: modalContent.includes('private keys') || modalContent.includes('Sensitive data'),
          hasDisableWarning: modalContent.includes('disabled') || modalContent.includes('disable'),
          contentLength: modalContent.length
        };
      }, [], function (result) {
        const content = result.value;
        browser.assert.ok(content.hasOverview, 'Terms should include Overview section');
        browser.assert.ok(content.hasDataCollection, 'Terms should include Data Collection section');
        browser.assert.ok(content.hasDataSharing, 'Terms should include Data Sharing section');
        browser.assert.ok(content.hasDataSecurity, 'Terms should include Data Security section');
        browser.assert.ok(content.hasDataRetention, 'Terms should include Data Retention section');
        browser.assert.ok(content.hasUserRights, 'Terms should include User Rights section');
        browser.assert.ok(content.hasConsent, 'Terms should include Consent section');
        browser.assert.ok(content.mentionsWorkspaceData, 'Terms should mention workspace data');
        browser.assert.ok(content.mentionsExternalServers, 'Terms should mention external servers');
        browser.assert.ok(content.mentionsPrivateKeys, 'Terms should warn about sensitive data');
        browser.assert.ok(content.hasDisableWarning, 'Terms should explain MCP will be disabled if declined');
        browser.assert.ok(content.contentLength > 500, 'Terms content should be comprehensive (>500 chars)');
      });
  },

  'Should save acceptance to localStorage when user accepts': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;

        // Clear localStorage first
        localStorage.removeItem('remix_mcp_terms_accepted');

        // Start the terms check
        const termsPromise = aiPlugin.checkMCPTermsAcceptance();

        // Wait for modal to appear
        await new Promise(resolve => setTimeout(resolve, 500));

        // Simulate clicking Accept button
        const acceptBtn = document.querySelector('.modal-ok-btn') as HTMLButtonElement ||
                         Array.from(document.querySelectorAll('button')).find(btn =>
                           btn.textContent?.includes('I Accept')
                         ) as HTMLButtonElement;

        if (acceptBtn) {
          acceptBtn.click();
        }

        // Wait for modal to process
        await new Promise(resolve => setTimeout(resolve, 300));

        // Check localStorage
        const accepted = localStorage.getItem('remix_mcp_terms_accepted');

        // Wait for promise to resolve
        const result = await termsPromise;

        return {
          localStorageValue: accepted,
          checkResult: result,
          acceptBtnFound: acceptBtn !== null
        };
      }, [], function (result) {
        browser.assert.ok(result.value.acceptBtnFound, 'Accept button should be found');
        browser.assert.strictEqual(result.value.localStorageValue, 'true', 'Acceptance should be saved to localStorage');
        browser.assert.strictEqual(result.value.checkResult, true, 'checkMCPTermsAcceptance should return true');
      });
  },

  'Should not show modal again after acceptance': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;

        // Ensure terms are accepted
        localStorage.setItem('remix_mcp_terms_accepted', 'true');

        // Call checkMCPTermsAcceptance again
        const result = await aiPlugin.checkMCPTermsAcceptance();

        // Wait a bit to see if modal appears
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if modal is visible
        const modal = document.querySelector('[data-id="mcp-terms-modal"]') ||
                     document.querySelector('.modal-content');

        return {
          modalVisible: modal !== null,
          checkResult: result,
          localStorageValue: localStorage.getItem('remix_mcp_terms_accepted')
        };
      }, [], function (result) {
        browser.assert.strictEqual(result.value.localStorageValue, 'true', 'Terms acceptance should persist');
        browser.assert.strictEqual(result.value.checkResult, true, 'Should return true when already accepted');
        browser.assert.strictEqual(result.value.modalVisible, false, 'Modal should not appear when already accepted');
      });
  },

  'Should save decline to localStorage when user declines': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;

        // Clear localStorage first
        localStorage.removeItem('remix_mcp_terms_accepted');

        // Start the terms check
        const termsPromise = aiPlugin.checkMCPTermsAcceptance();

        // Wait for modal to appear
        await new Promise(resolve => setTimeout(resolve, 500));

        // Simulate clicking Decline button
        const declineBtn = document.querySelector('.modal-cancel-btn') as HTMLButtonElement ||
                          Array.from(document.querySelectorAll('button')).find(btn =>
                            btn.textContent?.includes('I Decline')
                          ) as HTMLButtonElement;

        if (declineBtn) {
          declineBtn.click();
        }

        // Wait for modal to process
        await new Promise(resolve => setTimeout(resolve, 300));

        // Check localStorage
        const accepted = localStorage.getItem('remix_mcp_terms_accepted');

        // Wait for promise to resolve
        const result = await termsPromise;

        return {
          localStorageValue: accepted,
          checkResult: result,
          declineBtnFound: declineBtn !== null
        };
      }, [], function (result) {
        browser.assert.ok(result.value.declineBtnFound, 'Decline button should be found');
        browser.assert.strictEqual(result.value.localStorageValue, 'false', 'Decline should be saved to localStorage');
        browser.assert.strictEqual(result.value.checkResult, false, 'checkMCPTermsAcceptance should return false');
      });
  },

  'Should disable MCP when terms are declined': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;

        // Clear localStorage and decline terms
        localStorage.removeItem('remix_mcp_terms_accepted');

        // Start loading MCP servers (which checks terms)
        await aiPlugin.loadMCPServersFromSettings();

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 500));

        // Decline the modal if it appeared
        const declineBtn = document.querySelector('.modal-cancel-btn') as HTMLButtonElement ||
                          Array.from(document.querySelectorAll('button')).find(btn =>
                            btn.textContent?.includes('I Decline')
                          ) as HTMLButtonElement;

        if (declineBtn) {
          declineBtn.click();
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        return {
          mcpEnabled: aiPlugin.isMCPEnabled(),
          mcpServersLength: aiPlugin.mcpServers.length,
          localStorageValue: localStorage.getItem('remix_mcp_terms_accepted')
        };
      }, [], function (result) {
        browser.assert.strictEqual(result.value.mcpEnabled, false, 'MCP should be disabled when terms declined');
        browser.assert.strictEqual(result.value.mcpServersLength, 0, 'MCP servers should be empty when terms declined');
      });
  },

  'Should allow MCP when terms are accepted': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;

        // Accept terms
        localStorage.setItem('remix_mcp_terms_accepted', 'true');

        // Load MCP servers
        await aiPlugin.loadMCPServersFromSettings();

        return {
          mcpEnabled: aiPlugin.isMCPEnabled(),
          mcpServersLength: aiPlugin.mcpServers.length,
          hasBuiltInServer: aiPlugin.mcpServers.some(s => s.name === 'Remix IDE Server')
        };
      }, [], function (result) {
        browser.assert.ok(result.value.mcpServersLength > 0, 'MCP servers should be loaded when terms accepted');
        browser.assert.strictEqual(result.value.hasBuiltInServer, true, 'Built-in Remix IDE Server should be present');
      });
  },

  'Should check terms when calling enableMCPEnhancement': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;

        // Decline terms
        localStorage.setItem('remix_mcp_terms_accepted', 'false');

        // Try to enable MCP enhancement
        await aiPlugin.enableMCPEnhancement();

        return {
          mcpEnabled: aiPlugin.isMCPEnabled()
        };
      }, [], function (result) {
        browser.assert.strictEqual(result.value.mcpEnabled, false, 'MCP should not be enabled when terms not accepted');
      });
  },

  'Should enable MCP enhancement when terms are accepted': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;

        // Accept terms and load servers
        localStorage.setItem('remix_mcp_terms_accepted', 'true');
        await aiPlugin.loadMCPServersFromSettings();

        // Enable MCP enhancement
        await aiPlugin.enableMCPEnhancement();

        return {
          mcpEnabled: aiPlugin.isMCPEnabled(),
          mcpInferencerExists: aiPlugin.mcpInferencer !== null
        };
      }, [], function (result) {
        browser.assert.strictEqual(result.value.mcpEnabled, true, 'MCP should be enabled when terms accepted');
        browser.assert.strictEqual(result.value.mcpInferencerExists, true, 'MCP inferencer should be initialized');
      });
  },

  'Should persist terms acceptance across page refreshes': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        // Set acceptance
        localStorage.setItem('remix_mcp_terms_accepted', 'true');
        return localStorage.getItem('remix_mcp_terms_accepted');
      }, [], function (result) {
        browser.assert.strictEqual(result.value, 'true', 'Terms acceptance should be stored');
      })
      .refresh()
      .pause(2000)
      .execute(async function () {
        // After refresh, check if acceptance is still there
        const accepted = localStorage.getItem('remix_mcp_terms_accepted');

        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin) {
          return { error: 'AI Plugin not available after refresh' };
        }

        // Check terms without showing modal
        const termsAccepted = await aiPlugin.checkMCPTermsAcceptance();

        return {
          localStorageValue: accepted,
          checkResult: termsAccepted
        };
      }, [], function (result) {
        if (result.value.error) {
          browser.assert.fail(result.value.error);
        } else {
          browser.assert.strictEqual(result.value.localStorageValue, 'true', 'Terms acceptance should persist after refresh');
          browser.assert.strictEqual(result.value.checkResult, true, 'Terms check should return true after refresh');
        }
      });
  },

  'Should handle modal close (hideFn) as decline': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;

        // Clear localStorage
        localStorage.removeItem('remix_mcp_terms_accepted');

        // Start terms check
        const termsPromise = aiPlugin.checkMCPTermsAcceptance();

        // Wait for modal
        await new Promise(resolve => setTimeout(resolve, 500));

        // Try to close modal (simulate X button or Escape)
        const closeBtn = document.querySelector('.modal-close') as HTMLButtonElement ||
                        document.querySelector('[data-dismiss="modal"]') as HTMLButtonElement;

        if (closeBtn) {
          closeBtn.click();
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        const result = await termsPromise;
        const localStorageValue = localStorage.getItem('remix_mcp_terms_accepted');

        return {
          checkResult: result,
          localStorageValue: localStorageValue,
          closeBtnFound: closeBtn !== null
        };
      }, [], function (result) {
        // Modal close should be treated as decline
        browser.assert.strictEqual(result.value.checkResult, false, 'Closing modal should return false');
        browser.assert.strictEqual(result.value.localStorageValue, 'false', 'Closing modal should save false to localStorage');
      });
  },

  'Cleanup - Reset MCP terms acceptance': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        // Clean up
        localStorage.removeItem('remix_mcp_terms_accepted');
        return true;
      })
      .end();
  }
}
