/**
 * Simple E2E Test - Matomo Consent Acceptance Flow
 * 
 * This test recreates the exact scenario described:
 * 1. User arrives in blank state  
 * 2. Activate debug plugin before consent
 * 3. User clicks Accept on modal
 * 4. Verify expected events and cookies
 */

async function testMatomoConsentFlow() {
  console.log('🧪 Testing Matomo Consent Flow');
  
  // Step 1: Verify MatomoManager is available
  const matomoManager = window._matomoManagerInstance;
  if (!matomoManager) {
    console.error('❌ MatomoManager not found');
    return false;
  }
  
  console.log('✅ MatomoManager found');
  
  // Step 2: Activate debug plugin BEFORE user accepts cookies
  console.log('🔧 Activating debug plugin before consent...');
  const debugHelpers = await window._matomoManagerInstance.loadDebugPluginForE2E();
  console.log('✅ Debug plugin activated');
  
  // Clear any existing data for clean test
  debugHelpers.clearData();
  console.log('🧹 Debug data cleared');
  
  // Step 3: Check initial state (before consent)
  console.log('\n📊 Initial State (before consent):');
  const initialState = matomoManager.getState();
  const initialStatus = matomoManager.getStatus();
  console.log('State:', initialState);
  console.log('Status:', initialStatus);
  console.log('Initial events:', debugHelpers.getEvents());
  
  // Step 4: Simulate user clicking "Accept" on consent modal
  console.log('\n🖱️  Simulating user clicking "Accept" on consent modal...');
  
  // ** THIS IS WHERE THE ACTUAL UI CLICK WOULD HAPPEN **
  // In real E2E test: await page.click('[data-testid="accept-cookies"]')
  // For now, we'll trigger it programmatically
  try {
    await matomoManager.initializeWithConsent({
      mode: 'immediate'
    });
    console.log('✅ Consent accepted programmatically');
  } catch (error) {
    console.error('❌ Error accepting consent:', error);
    return false;
  }
  
  // Step 5: Wait a moment for events to process
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 6: Verify expected events (should match your example)
  console.log('\n📋 Events after consent acceptance:');
  const events = debugHelpers.getEvents();
  console.log('debugHelpers.getEvents():', events);
  console.log(`Event count: ${events.length}`);
  
  // Log each event in detail
  events.forEach((event, index) => {
    console.log(`${index}: {category: '${event.category}', action: '${event.action}', name: '${event.name}', value: ${event.value}, visitorId: '${event.visitorId}', ...}`);
  });
  
  // Step 7: Verify state after consent (should match your example)
  console.log('\n🎯 State after consent acceptance:');
  const finalState = matomoManager.getState();
  const finalStatus = matomoManager.getStatus();
  
  console.log('window._matomoManagerInstance.getState():', finalState);
  console.log('window._matomoManagerInstance.getStatus():', finalStatus);
  
  // Step 8: Verify expected conditions
  console.log('\n✅ Verification:');
  
  const verifications = [
    {
      name: 'Consent given',
      actual: finalState.consentGiven,
      expected: true,
      pass: finalState.consentGiven === true
    },
    {
      name: 'Current mode is immediate',
      actual: finalState.currentMode,
      expected: 'immediate',
      pass: finalState.currentMode === 'immediate'
    },
    {
      name: 'Has 3+ cookies',
      actual: finalStatus.cookieCount,
      expected: '≥3',
      pass: finalStatus.cookieCount >= 3
    },
    {
      name: 'Has consent cookie',
      actual: finalStatus.cookies.filter(c => c.includes('mtm_consent')).length,
      expected: '≥1',
      pass: finalStatus.cookies.some(c => c.includes('mtm_consent'))
    },
    {
      name: 'Has visitor ID cookie',
      actual: finalStatus.cookies.filter(c => c.includes('_pk_id')).length,
      expected: '≥1',
      pass: finalStatus.cookies.some(c => c.includes('_pk_id'))
    },
    {
      name: 'Has session cookie',
      actual: finalStatus.cookies.filter(c => c.includes('_pk_ses')).length,
      expected: '≥1',
      pass: finalStatus.cookies.some(c => c.includes('_pk_ses'))
    },
    {
      name: 'Has expected events',
      actual: events.length,
      expected: '≥3',
      pass: events.length >= 3
    }
  ];
  
  verifications.forEach(v => {
    const icon = v.pass ? '✅' : '❌';
    console.log(`${icon} ${v.name}: ${v.actual} (expected: ${v.expected})`);
  });
  
  const allPass = verifications.every(v => v.pass);
  
  // Step 9: Expected events breakdown
  console.log('\n🔍 Expected Event Pattern Analysis:');
  const expectedEvents = [
    { category: 'Storage', action: 'activate', name: 'indexedDB' },
    { category: 'Matomo', action: 'showConsentDialog', name: '' },
    { category: 'workspace', action: 'template', name: 'remixDefault' }
  ];
  
  expectedEvents.forEach((expected, i) => {
    const actual = events[i];
    if (actual) {
      const match = actual.category === expected.category && actual.action === expected.action;
      console.log(`${match ? '✅' : '❌'} Event ${i}: ${expected.category}/${expected.action} - ${match ? 'FOUND' : 'MISMATCH'}`);
      if (!match) {
        console.log(`   Expected: ${expected.category}/${expected.action}`);
        console.log(`   Actual:   ${actual.category}/${actual.action}`);
      }
    } else {
      console.log(`❌ Event ${i}: ${expected.category}/${expected.action} - MISSING`);
    }
  });
  
  // Step 10: Summary
  console.log('\n🎯 TEST RESULT:');
  if (allPass) {
    console.log('🎉 ALL VERIFICATIONS PASSED!');
    console.log('The consent flow is working as expected.');
  } else {
    console.log('⚠️  Some verifications failed. Check the details above.');
  }
  
  return {
    success: allPass,
    events,
    finalState,
    finalStatus,
    verifications
  };
}

// Make available globally for manual testing
if (typeof window !== 'undefined') {
  window.testMatomoConsentFlow = testMatomoConsentFlow;
}

// Usage:
// await testMatomoConsentFlow();

export { testMatomoConsentFlow };