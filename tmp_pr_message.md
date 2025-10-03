# Refactor: Comprehensive Matomo Tracking System Overhaul

## Overview
This PR introduces a new `MatomoManager` class that completely refactors Remix's analytics tracking system, providing better privacy controls, type safety, and developer experience.

## 🔧 Key Improvements

**Privacy & Mode Management:**
- ✅ **Custom dimension tracking** for anonymous vs cookie modes
- ✅ **Click dimension tracking** (dimension 3) for user interaction analytics
- ✅ **Seamless mode switching** without cookie persistence issues  
- ✅ **Proper initialization flow** for new users requiring consent
- ✅ **Pre-consent event queuing** - events collected before user choice, sent after consent
- ✅ **Enhanced anonymity** with `disableBrowserFeatureDetection` in anonymous mode

**Code Architecture:**
- ✅ **Centralized tracking** via MatomoManager and TrackingContext
- ✅ **Type-safe event definitions** in `@remix-api` 
- ✅ **Eliminated direct `window._paq` usage** across entire codebase
- ✅ **ESLint rules** preventing direct `_paq` access
- ✅ **Simplified settings tab** using plugin calls

**Developer Experience:**
- ✅ **Rich debugging methods** exposed by MatomoManager
- ✅ **Event-driven architecture** for UI state management
- ✅ **Comprehensive E2E tests** for consent workflows
- ✅ **Consistent tracking patterns** across all plugins

**Cleanup:**
- ✅ **Removed legacy `loader.js`**
- ✅ **Eliminated `_paq.push()` confusion**
- ✅ **Standardized all tracking calls**

## 📋 Usage Examples

**React Components (Context-based):**
```typescript
import TrackingContext from 'apps/remix-ide/src/app/contexts/TrackingContext'

const { track } = useContext(TrackingContext)
track?.(HomeTabEvents.featuredPluginsActionClick(pluginInfo.pluginTitle))
track?.(CompilerEvents.compiled('with_config_file_' + state.useFileConfiguration))
```

**Plugin Classes (Direct calls):**
```typescript
import { trackMatomoEvent, BlockchainEvents, UdappEvents } from '@remix-api'

trackMatomoEvent(this, BlockchainEvents.deployWithProxy('modal ok confirmation'))
await trackMatomoEventAsync(plugin, CompilerEvents.compiled(workspaceTemplateName))
```

## 🧪 Testing
- Added comprehensive E2E test suite covering consent flows, mode switching, and queue management
- All existing functionality preserved with improved reliability

## 📦 Files Added
- `MatomoManager.ts` - Core tracking manager
- `MatomoConfig.ts` - Configuration management  
- `MatomoAutoInit.ts` - Auto-initialization logic
- `TrackingContext.tsx` - React context provider
- `matomo-consent.test.ts` - E2E test suite

This refactor provides a solid foundation for privacy-compliant analytics while improving maintainability and developer experience across the entire Remix codebase.