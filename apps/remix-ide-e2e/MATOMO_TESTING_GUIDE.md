# Matomo Dual-Mode E2E Testing Guide

This guide explains how to test the new dual-mode Matomo tracking system (cookie vs anonymous) in the Remix IDE web application.

## Overview

The new Matomo implementation supports two tracking modes:
- **Cookie Mode**: Full tracking with visitor persistence and cookies enabled
- **Anonymous Mode**: Privacy-focused tracking with cookies disabled and ephemeral visitor IDs

## Test Structure

### Existing Tests (Updated)
- `matomo.test.ts` - Original consent modal and basic functionality tests
- `matomo_group1.test.ts` to `matomo_group4.test.ts` - Grouped versions of existing tests

### New Test Files
- `matomo_dual_mode.test.ts` - Core dual-mode functionality tests
- `matomo_dual_mode_group1.test.ts` to `matomo_dual_mode_group4.test.ts` - Grouped versions
- `matomo_http_requests.test.ts` - HTTP request parameter validation tests
- `matomo_http_requests_group1.test.ts`, `matomo_http_requests_group2.test.ts` - Grouped versions

## Test Categories

### 1. Mode Setup and Configuration (`matomo_dual_mode.test.ts`)

#### Cookie Mode Tests (#group1)
- ✅ **test cookie mode tracking setup**: Verifies cookie consent and tracking dimension setup
- ✅ **test anon mode tracking setup**: Verifies cookie disabling and anon dimension setup

#### Mode Switching Tests (#group2)
- ✅ **test mode switching cookie to anon**: Tests cookie deletion and dimension updates
- ✅ **test mode switching anon to cookie**: Tests cookie consent and dimension updates

#### Event Tracking Tests (#group3)
- ✅ **test tracking events in cookie mode**: Validates event tracking with cookie dimension
- ✅ **test tracking events in anon mode**: Validates event tracking with anon dimension and disabled cookies

#### Development Features (#group4)
- ✅ **test localhost debug mode activation**: Tests localhost tracking enablement
- ✅ **test persistence across page reloads**: Verifies mode persistence

### 2. HTTP Request Validation (`matomo_http_requests.test.ts`)

#### Parameter Validation (#group1)
- ✅ **test Matomo HTTP requests contain correct parameters**: Validates cookie mode HTTP parameters
- ✅ **test anon mode HTTP parameters**: Validates anonymous mode HTTP parameters

#### Advanced Scenarios (#group2)
- ✅ **test mode switching generates correct HTTP requests**: Validates mode change events
- ✅ **test visitor ID consistency in cookie mode**: Tests visitor ID persistence

## Key Test Points

### Critical Parameters to Verify

1. **Tracking Mode Dimension (dimension1)**:
   - Cookie mode: `dimension1=cookie`
   - Anonymous mode: `dimension1=anon`

2. **Site ID**:
   - Localhost web dev: `idsite=5`
   - Production domains: Various (1-4)

3. **Cookie Management**:
   - Cookie mode: `setConsentGiven` called
   - Anon mode: `disableCookies` called

4. **Visitor ID**:
   - Cookie mode: Persistent across reloads
   - Anon mode: Fresh per session, 16-character hex

### Test Environment Setup

#### Prerequisites
```bash
# In CircleCI or local environment
cd /Users/filipmertens/projects/remix-project/apps/remix-ide-e2e
yarn install
```

#### Running Tests
```bash
# Run all new dual-mode tests
yarn nightwatch --test apps/remix-ide-e2e/src/tests/matomo_dual_mode_group1.test.ts
yarn nightwatch --test apps/remix-ide-e2e/src/tests/matomo_dual_mode_group2.test.ts
yarn nightwatch --test apps/remix-ide-e2e/src/tests/matomo_dual_mode_group3.test.ts
yarn nightwatch --test apps/remix-ide-e2e/src/tests/matomo_dual_mode_group4.test.ts

# Run HTTP request validation tests
yarn nightwatch --test apps/remix-ide-e2e/src/tests/matomo_http_requests_group1.test.ts
yarn nightwatch --test apps/remix-ide-e2e/src/tests/matomo_http_requests_group2.test.ts
```

#### Test Activation
Currently tests are disabled (`@disabled: true`). To activate:

1. **Remove @disabled flag** in test files when ready - tests automatically set required localStorage flags:
   ```javascript
   // Automatically set in all tests:
   localStorage.setItem('matomo-localhost-enabled', 'true');
   localStorage.setItem('showMatomo', 'true');
   localStorage.setItem('matomo-debug', 'true');
   ```

2. **Manual testing** (if needed outside of automated tests):
   ```javascript
   localStorage.setItem('matomo-localhost-enabled', 'true');
   localStorage.setItem('showMatomo', 'true');
   localStorage.setItem('matomo-debug', 'true');
   ```

## Testing Strategy

### 1. Modal and Consent Flow
- Verify consent modal appearance and behavior
- Test "Accept All" (cookie mode) vs "Manage Preferences" (anon mode)
- Validate consent timestamp persistence

### 2. Settings Integration
- Test performance analytics toggle in settings panel
- Verify mode derivation from performance analytics flag
- Validate real-time mode switching

### 3. HTTP Request Interception
Tests use fetch mocking to capture actual Matomo HTTP requests:

```javascript
// Mock setup
const originalFetch = window.fetch;
(window as any).__matomoRequests = [];

window.fetch = function(url: RequestInfo | URL, options?: RequestInit) {
  const urlString = typeof url === 'string' ? url : url.toString();
  if (urlString.includes('matomo.php')) {
    (window as any).__matomoRequests.push({
      url: urlString,
      options: options,
      timestamp: Date.now()
    });
  }
  return originalFetch.apply(this, arguments as any);
};
```

### 4. _paq Array Validation
Tests inspect the `window._paq` array to verify:
- Correct Matomo API calls
- Proper dimension settings
- Cookie consent flow
- Event tracking calls

## Expected Behaviors

### Cookie Mode Flow
1. User accepts "All Analytics" → `setConsentGiven()` called
2. Performance analytics toggle ON → `dimension1=cookie`
3. Visitor ID persists across reloads
4. All tracking features enabled

### Anonymous Mode Flow
1. User disables performance analytics → `disableCookies()` called
2. Performance analytics toggle OFF → `dimension1=anon`
3. Fresh visitor ID per session
4. No cookies stored, but events still tracked

### Mode Switching
1. Toggle triggers → `deleteCookies()` if switching to anon
2. New dimension value sent → `dimension1=anon|cookie`
3. Mode change event tracked → `trackEvent('tracking_mode_change', newMode)`
4. Settings persist in localStorage

## Debugging Tips

### Enable Debug Logging
```javascript
// In browser console or test setup
localStorage.setItem('matomo-debug', 'true');
```

### Check _paq Array
```javascript
// In browser console
console.log('_paq contents:', window._paq);
```

### Monitor Network Requests
```javascript
// Check captured requests in tests
console.log('Captured Matomo requests:', (window as any).__matomoRequests);
```

### Validate Configuration
```javascript
// Check stored config
console.log('Config:', JSON.parse(localStorage.getItem('config-v0.8:.remix.config') || '{}'));
console.log('Consent timestamp:', localStorage.getItem('matomo-analytics-consent'));
```

## Integration with CircleCI

The tests are designed to run in CircleCI's Nightwatch environment:

1. **Parallel execution**: Tests are split into groups for parallel runs
2. **Headless browser**: Tests work in headless Chrome/Firefox
3. **Localhost testing**: Uses site ID 5 for localhost isolation
4. **Mock-friendly**: HTTP interception works in test environment

## Next Steps

1. **Enable tests** by removing `@disabled: true`
2. **Run initial test suite** to establish baseline
3. **Add to CI pipeline** for automated dual-mode validation
4. **Extend coverage** for desktop Electron testing (future)
5. **Monitor production** metrics to validate dual-mode behavior

This comprehensive testing approach ensures the dual-mode Matomo system works correctly across all user scenarios while maintaining privacy compliance and tracking accuracy.