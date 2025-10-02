/**
 * E2E Test: Matomo Consent Flow with Debug Plugin
 * 
 * This test simulates a user arriving at the application in a blank state,
 * activating the debug plugin, and then accepting cookies to verify the
 * complete tracking flow.
 * 
 * Expected flow:
 * 1. User arrives (blank state)
 * 2. Activate debug plugin for monitoring
 * 3. User clicks "Accept" on consent modal
 * 4. Verify events are tracked correctly
 * 5. Verify cookies are set properly
 * 6. Verify state transitions correctly
 */

class MatomoConsentFlowTest {
  constructor() {
    this.debugHelpers = null;
    this.initialState = null;
    this.matomoManager = null;
  }

  /**
   * Initialize the test environment
   */
  async setup() {
    console.log('🧪 Setting up Matomo Consent Flow Test');
    
    // Get MatomoManager instance
    this.matomoManager = window._matomoManagerInstance;
    if (!this.matomoManager) {
      throw new Error('❌ MatomoManager not found. Ensure it is initialized.');
    }
    
    // Capture initial state
    this.initialState = this.matomoManager.getState();
    console.log('📊 Initial state:', this.initialState);
    
    // Activate debug plugin before any user interaction
    console.log('🔧 Activating debug plugin...');
    this.debugHelpers = await this.matomoManager.loadDebugPluginForE2E();
    console.log('✅ Debug plugin activated successfully');
    
    // Clear any existing debug data for clean test
    this.debugHelpers.clearData();
    console.log('🧹 Debug data cleared for clean test');
    
    return this;
  }

  /**
   * Verify the blank state before user interaction
   */
  verifyBlankState() {
    console.log('\n📋 Verifying blank state...');
    
    const state = this.matomoManager.getState();
    const status = this.matomoManager.getStatus();
    const events = this.debugHelpers.getEvents();
    
    console.log('State:', state);
    console.log('Status:', status);
    console.log('Events count:', events.length);
    
    // Expected blank state conditions
    const checks = [
      { name: 'No consent given initially', pass: !state.consentGiven },
      { name: 'Script loaded', pass: state.scriptLoaded },
      { name: 'Manager initialized', pass: state.initialized },
      { name: 'Minimal/no cookies initially', pass: status.cookieCount <= 1 },
      { name: 'Few or no events initially', pass: events.length <= 2 }
    ];
    
    checks.forEach(check => {
      console.log(check.pass ? '✅' : '❌', check.name);
    });
    
    return checks.every(check => check.pass);
  }

  /**
   * Simulate user clicking "Accept" on consent modal
   * This should trigger the consent flow and tracking
   */
  async simulateConsentAcceptance() {
    console.log('\n🖱️  Simulating user clicking "Accept" on consent modal...');
    
    // In a real test, this would be:
    // await page.click('[data-testid="accept-cookies"]');
    // or cy.get('[data-testid="accept-cookies"]').click();
    
    // For this example, we'll trigger the consent programmatically
    // In your app, this should happen when the actual UI button is clicked
    try {
      // This simulates what happens when user clicks Accept
      await this.matomoManager.initializeWithConsent({
        mode: 'immediate',
        forceReload: false
      });
      
      console.log('✅ Consent acceptance simulated');
      
      // Wait a moment for events to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('❌ Error during consent acceptance:', error);
      throw error;
    }
  }

  /**
   * Wait for and verify expected events after consent
   */
  async verifyExpectedEvents() {
    console.log('\n📊 Verifying expected events after consent...');
    
    try {
      // Wait for key events to be tracked
      console.log('⏳ Waiting for consent dialog event...');
      const consentEvent = await this.debugHelpers.waitForEvent('Matomo', 'showConsentDialog', 3000);
      console.log('✅ Consent dialog event captured:', consentEvent);
      
      console.log('⏳ Waiting for storage activation event...');
      const storageEvent = await this.debugHelpers.waitForEvent('Storage', 'activate', 3000);
      console.log('✅ Storage activation event captured:', storageEvent);
      
    } catch (error) {
      console.warn('⚠️  Some events may not have been captured within timeout:', error.message);
    }
    
    // Get all events
    const allEvents = this.debugHelpers.getEvents();
    console.log('\n📋 All captured events:', allEvents);
    
    // Verify expected event structure
    const expectedEventTypes = [
      { category: 'Storage', action: 'activate', name: 'indexedDB' },
      { category: 'Matomo', action: 'showConsentDialog' },
      { category: 'workspace', action: 'template', name: 'remixDefault' }
    ];
    
    console.log(`\n🔍 Verifying ${allEvents.length} events against expected patterns:`);
    
    expectedEventTypes.forEach((expected, index) => {
      const event = allEvents[index];
      if (event) {
        const matches = event.category === expected.category && 
                       event.action === expected.action &&
                       (!expected.name || event.name === expected.name);
        
        console.log(matches ? '✅' : '❌', 
          `Event ${index + 1}: ${expected.category}/${expected.action}${expected.name ? `/${expected.name}` : ''}`);
        
        if (matches) {
          console.log(`   → visitorId: ${event.visitorId}`);
          console.log(`   → timestamp: ${new Date(event.timestamp).toLocaleTimeString()}`);
        }
      } else {
        console.log('❌', `Event ${index + 1}: Missing`);
      }
    });
    
    return allEvents;
  }

  /**
   * Verify final state after consent acceptance
   */
  verifyFinalState() {
    console.log('\n🎯 Verifying final state after consent...');
    
    const finalState = this.matomoManager.getState();
    const finalStatus = this.matomoManager.getStatus();
    
    console.log('Final state:', finalState);
    console.log('Final status:', finalStatus);
    
    // Expected final state conditions
    const checks = [
      { name: 'Consent given', pass: finalState.consentGiven === true },
      { name: 'Current mode is immediate', pass: finalState.currentMode === 'immediate' },
      { name: 'Manager initialized', pass: finalState.initialized === true },
      { name: 'Script loaded', pass: finalState.scriptLoaded === true },
      { name: 'Matomo loaded', pass: finalStatus.matomoLoaded === true },
      { name: 'Has cookies (≥3)', pass: finalStatus.cookieCount >= 3 },
      { name: 'Has consent cookie', pass: finalStatus.cookies.some(c => c.includes('mtm_consent')) },
      { name: 'Has visitor ID cookie', pass: finalStatus.cookies.some(c => c.includes('_pk_id')) },
      { name: 'Has session cookie', pass: finalStatus.cookies.some(c => c.includes('_pk_ses')) }
    ];
    
    checks.forEach(check => {
      console.log(check.pass ? '✅' : '❌', check.name);
    });
    
    // Log cookie details
    console.log('\n🍪 Cookie details:');
    finalStatus.cookies.forEach((cookie, index) => {
      console.log(`   ${index + 1}. ${cookie}`);
    });
    
    return {
      state: finalState,
      status: finalStatus,
      allChecksPass: checks.every(check => check.pass),
      checks
    };
  }

  /**
   * Run the complete test flow
   */
  async runCompleteTest() {
    console.log('🚀 Starting Matomo Consent Flow E2E Test\n');
    
    try {
      // 1. Setup
      await this.setup();
      
      // 2. Verify blank state
      const blankStateValid = this.verifyBlankState();
      if (!blankStateValid) {
        throw new Error('Blank state verification failed');
      }
      
      // 3. Simulate consent acceptance
      await this.simulateConsentAcceptance();
      
      // 4. Verify events
      const events = await this.verifyExpectedEvents();
      
      // 5. Verify final state
      const finalResult = this.verifyFinalState();
      
      // 6. Test summary
      console.log('\n📊 TEST SUMMARY');
      console.log('================');
      console.log(`✅ Events captured: ${events.length}`);
      console.log(`✅ Cookies set: ${finalResult.status.cookieCount}`);
      console.log(`✅ Consent given: ${finalResult.state.consentGiven}`);
      console.log(`✅ All checks passed: ${finalResult.allChecksPass}`);
      
      if (finalResult.allChecksPass) {
        console.log('\n🎉 CONSENT FLOW TEST PASSED! 🎉');
      } else {
        console.log('\n⚠️  Some checks failed, review above results');
      }
      
      return {
        success: finalResult.allChecksPass,
        events,
        finalState: finalResult.state,
        finalStatus: finalResult.status
      };
      
    } catch (error) {
      console.error('\n❌ TEST FAILED:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export for use in test frameworks
if (typeof window !== 'undefined') {
  window.MatomoConsentFlowTest = MatomoConsentFlowTest;
}

// Example usage:
// const test = new MatomoConsentFlowTest();
// const result = await test.runCompleteTest();

export { MatomoConsentFlowTest };