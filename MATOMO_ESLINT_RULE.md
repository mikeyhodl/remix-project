# ESLint Rule: No Direct window._paq Usage

## Overview

This project includes a custom ESLint rule that prevents direct usage of `window._paq` in favor of the MatomoManager abstraction layer.

## Rule Details

**Rule**: `no-restricted-syntax` with custom selectors for `window._paq`

### ❌ Examples of incorrect code:

```typescript
// Direct usage of window._paq
window._paq.push(['trackEvent', 'category', 'action']);

// Assigning window._paq to a variable
const paq = window._paq;
paq.push(['trackEvent', 'category', 'action']);

// Any other direct access
window._paq.length;
```

### ✅ Examples of correct code:

```typescript
// Using TrackingContext (recommended for components)
import { useTrackingContext } from '../contexts/TrackingContext';

function MyComponent() {
  const track = useTrackingContext();
  
  const handleClick = () => {
    track?.('category', 'action', 'name', 'value');
  };
}

// Using MatomoManager directly (for non-React code)
import { getMatomoManager } from '../plugins/matomo';

function trackingSomething() {
  const matomoManager = getMatomoManager();
  matomoManager.trackEvent('category', 'action', 'name', 'value');
}
```

## Exempted Files

The following files are exempted from this rule as they legitimately need direct `window._paq` access:

- `src/app/matomo/*.ts` - MatomoManager and related infrastructure
- `src/assets/js/**/*.js` - Legacy loader scripts

## Why This Rule Exists

1. **Centralized Tracking Logic**: All tracking should go through MatomoManager for consistency
2. **Queue Management**: MatomoManager handles pre-initialization queuing properly
3. **Mode Switching**: Automatic handling of anonymous vs cookie modes
4. **Error Prevention**: Prevents bypassing the consent and initialization flow
5. **Maintainability**: Single source of truth for tracking configuration

## Disabling the Rule (Not Recommended)

If you absolutely need to disable this rule for a specific line:

```typescript
// eslint-disable-next-line no-restricted-syntax
window._paq.push(['trackEvent', 'category', 'action']);
```

However, consider using the proper abstraction instead:

```typescript
// Better approach
const track = useTrackingContext();
track?.('category', 'action');
```

## Migration Guide

If you encounter this ESLint error in existing code:

1. **For React Components**: Use `useTrackingContext()` hook
2. **For Non-React Code**: Import and use MatomoManager
3. **For Plugin Code**: Use the matomo plugin's tracking methods
4. **For App-Level Code**: Access `window._matomoManagerInstance`

## Configuration

The rule is configured project-wide in `.eslintrc.json` and applies to all apps and libraries:

```json
{
  "overrides": [
    {
      "files": ["**/src/app/matomo/*.ts", "**/src/assets/js/**/*.js"],
      "rules": {
        "no-restricted-syntax": "off"
      }
    },
    {
      "files": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
      "excludedFiles": ["**/src/app/matomo/*.ts", "**/src/assets/js/**/*.js"],
      "rules": {
        "no-restricted-syntax": [
          "error",
          {
            "selector": "MemberExpression[object.type='Identifier'][object.name='window'][property.type='Identifier'][property.name='_paq']",
            "message": "Direct usage of window._paq is not allowed. Use MatomoManager.trackEvent() or TrackingContext instead."
          }
        ]
      }
    }
  ]
}
```

## Project-Wide Scope

This rule applies to all apps and libraries in the monorepo:
- `apps/remix-ide/` - Main IDE application
- `apps/remix-dapp/` - DApp interface
- `apps/solidity-compiler/` - Solidity compiler app
- `libs/remix-ui/` - UI component libraries
- And all other apps and libraries