// Example E2E test using the enhanced debug plugin

// Usage in E2E tests (Jest, Playwright, Cypress, etc.)
async function setupMatomoE2ETesting() {
  // Get the MatomoManager instance
  const matomoManager = window._matomoManagerInstance;
  
  if (!matomoManager) {
    throw new Error('MatomoManager not found. Make sure it is initialized.');
  }
  
  // Load the debug plugin with E2E helpers
  const debugHelpers = await matomoManager.loadDebugPluginForE2E();
  
  console.log('✅ Matomo E2E Debug Plugin loaded successfully');
  
  return debugHelpers;
}

// Example test functions
async function testMatomoTracking() {
  const debug = await setupMatomoE2ETesting();
  
  // Clear any existing data
  debug.clearData();
  
  // Trigger some tracking (example)
  // trackingFunction('ai', 'button-click', 'ask-question');
  
  // Wait for the specific event
  try {
    const event = await debug.waitForEvent('ai', 'button-click', 3000);
    console.log('✅ Event tracked successfully:', event);
    
    // Verify event properties
    if (event.category === 'ai' && event.action === 'button-click') {
      console.log('✅ Event has correct category and action');
    }
    
    // Get all AI-related events
    const aiEvents = debug.getEventsByCategory('ai');
    console.log(`📊 Total AI events: ${aiEvents.length}`);
    
    // Get dimensions
    const dimensions = debug.getDimensions();
    console.log('📊 Current dimensions:', dimensions);
    
  } catch (error) {
    console.error('❌ Event not received within timeout:', error);
  }
}

// Example usage in different test frameworks:

// Cypress example:
// cy.window().then(async (win) => {
//   const debug = await setupMatomoE2ETesting();
//   cy.wrap(debug).as('matomoDebug');
// });

// Playwright example:
// const debugHelpers = await page.evaluate(setupMatomoE2ETesting);

// Jest/jsdom example:
// const debugHelpers = await setupMatomoE2ETesting();

export { setupMatomoE2ETesting, testMatomoTracking };