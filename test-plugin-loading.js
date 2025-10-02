// Test script to demonstrate plugin loading functionality
// This would typically be used in the browser console or as part of initialization

// Example usage of the plugin loading system:
console.log('Testing Matomo Plugin Loading System');

// Get the MatomoManager instance (as defined in index.tsx)
if (window._matomoManagerInstance) {
  const manager = window._matomoManagerInstance;
  
  // Load the debug plugin
  manager.loadDebugPlugin()
    .then(() => {
      console.log('✅ Debug plugin loaded successfully');
      console.log('Loaded plugins:', manager.getLoadedPlugins());
      
      // Get diagnostics including plugin info
      const diagnostics = manager.getDiagnostics();
      console.log('📊 Current diagnostics:', diagnostics);
    })
    .catch((error) => {
      console.error('❌ Failed to load debug plugin:', error);
    });
    
  // Example of loading a custom plugin
  manager.loadPlugin('/assets/js/matomo-debug-plugin.js', {
    timeout: 10000,
    retryAttempts: 2,
    initFunction: 'CustomPlugin.init'
  }).then(() => {
    console.log('✅ Custom plugin loaded successfully');
  }).catch((error) => {
    console.error('❌ Failed to load custom plugin:', error);
  });
  
} else {
  console.error('❌ MatomoManager not found on window._matomoManagerInstance');
}