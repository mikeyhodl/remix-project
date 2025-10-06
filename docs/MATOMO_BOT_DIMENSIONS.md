# Bot Site Custom Dimensions Configuration

## Overview

When routing bot traffic to separate Matomo site IDs, those bot tracking sites may have **different custom dimension IDs** than your human tracking sites. This document explains how to configure dimension mapping for bot sites.

## Problem

Each Matomo site can have its own custom dimension configuration:

```
remix.ethereum.org (Site ID 3) - Human Traffic
├── Dimension 1: Tracking Mode
├── Dimension 2: Click Action
└── Dimension 3: Bot Detection

remix.ethereum.org (Site ID 12) - Bot Traffic
├── Dimension 1: Tracking Mode  ← Might be different!
├── Dimension 2: Click Action   ← Might be different!
└── Dimension 3: Bot Detection  ← Might be different!
```

If the dimension IDs differ, we need to tell the system which IDs to use for each site.

## Solution

The system supports **two configuration maps**:

1. **`MATOMO_CUSTOM_DIMENSIONS`** - Dimension IDs for human traffic (default)
2. **`MATOMO_BOT_CUSTOM_DIMENSIONS`** - Dimension IDs for bot traffic (optional)

When a bot is detected and routed to a separate site ID, the system checks if bot-specific dimensions are configured. If so, it switches to those dimension IDs.

## Configuration

### Scenario 1: Same Dimension IDs (Most Common)

If your bot sites use the **same dimension IDs** as human sites, no additional configuration needed:

```typescript
// MatomoConfig.ts
export const MATOMO_BOT_CUSTOM_DIMENSIONS = {
  'alpha.remix.live': null,        // Use same IDs as human site
  'beta.remix.live': null,         // Use same IDs as human site
  'remix.ethereum.org': null,      // Use same IDs as human site
  'localhost': null,
  '127.0.0.1': null
};
```

### Scenario 2: Different Dimension IDs

If your bot sites have **different dimension IDs**, configure them:

```typescript
// MatomoConfig.ts

// Human site dimensions
export const MATOMO_CUSTOM_DIMENSIONS = {
  'remix.ethereum.org': {
    trackingMode: 1,  // Human site dimension IDs
    clickAction: 2,
    isBot: 3
  }
};

// Bot site dimensions (different IDs)
export const MATOMO_BOT_CUSTOM_DIMENSIONS = {
  'remix.ethereum.org': {
    trackingMode: 4,  // Bot site dimension IDs
    clickAction: 5,
    isBot: 6
  }
};
```

## How It Works

### Initialization Flow

1. User loads page
2. Mouse tracking starts (2-second delay)
3. Bot detection completes
4. System determines site ID:
   ```javascript
   const isBot = botDetectionResult.isBot;
   const siteId = getSiteIdForTracking(isBot);
   ```
5. If routed to bot site, system checks for bot dimensions:
   ```javascript
   if (siteId !== config.siteId) {
     const botDimensions = getDomainCustomDimensions(true);
     if (botDimensions !== this.customDimensions) {
       this.customDimensions = botDimensions;
     }
   }
   ```
6. Matomo initializes with correct site ID and dimension IDs

### Function Signature

```typescript
getDomainCustomDimensions(isBot: boolean = false): DomainCustomDimensions
```

- **`isBot = false`** (default): Returns human site dimensions
- **`isBot = true`**: Returns bot site dimensions if configured, else human dimensions

## Debug Logging

### Same Dimension IDs (No Update)

```
[MATOMO] 🤖 Bot detected - routing to bot tracking site ID: 12 (human site ID: 3)
[MATOMO] Setting tracker URL and site ID
```

### Different Dimension IDs (Update Required)

```
[MATOMO] 🤖 Bot detected - routing to bot tracking site ID: 12 (human site ID: 3)
[MATOMO] 🔄 Updated to bot-specific custom dimensions: { trackingMode: 4, clickAction: 5, isBot: 6 }
[MATOMO] Setting tracker URL and site ID
```

## Best Practices

### 1. Keep IDs Consistent (Recommended)

Create bot sites with the **same dimension IDs** as human sites:
- Simpler configuration
- No additional mapping needed
- Easier to maintain

### 2. Use Different IDs Only If Necessary

Use different dimension IDs only if:
- Bot sites were created before human sites (dimension IDs already taken)
- Different dimension structure is needed for bot analytics
- Separate admin teams manage human vs bot sites

### 3. Document Your Configuration

Add comments in `MatomoConfig.ts`:

```typescript
export const MATOMO_BOT_CUSTOM_DIMENSIONS = {
  'remix.ethereum.org': {
    // Bot site ID 12 has different dimension IDs due to...
    trackingMode: 4,
    clickAction: 5,
    isBot: 6
  }
};
```

## Testing

### Verify Dimension Mapping

```javascript
// In browser console
const { getDomainCustomDimensions } = require('./MatomoConfig');

// Get human dimensions
console.log('Human dims:', getDomainCustomDimensions(false));

// Get bot dimensions
console.log('Bot dims:', getDomainCustomDimensions(true));
```

### Check Bot Tracking

1. Trigger bot detection (e.g., run in automated browser)
2. Check console logs for dimension update message
3. Verify Matomo receives correct dimension values in bot site

## Common Issues

### Issue 1: Dimensions Not Recording

**Symptom**: Bot visits tracked but custom dimensions empty

**Solution**: Check dimension IDs match Matomo admin configuration:
1. Go to **Administration** → **Websites** → **[Bot Site]** → **Custom Dimensions**
2. Verify dimension IDs match `MATOMO_BOT_CUSTOM_DIMENSIONS`

### Issue 2: Wrong Dimension Values

**Symptom**: Dimension values appear in wrong dimensions

**Solution**: Dimension ID mismatch - update `MATOMO_BOT_CUSTOM_DIMENSIONS` to match Matomo admin

### Issue 3: Using Human Dimensions for Bots

**Symptom**: Bot tracking works but dimensions not correct

**Solution**: Add bot dimension configuration:
```typescript
export const MATOMO_BOT_CUSTOM_DIMENSIONS = {
  'your-domain.com': { trackingMode: X, clickAction: Y, isBot: Z }
};
```

## Migration Guide

### From Same IDs to Different IDs

If you need to change bot site dimension IDs after initial setup:

1. Update dimension IDs in Matomo admin for bot site
2. Add configuration to `MATOMO_BOT_CUSTOM_DIMENSIONS`
3. Deploy and test
4. Historical data will use old IDs (Matomo doesn't migrate dimension IDs)

### From Different IDs to Same IDs

If you want to standardize dimension IDs:

1. Delete bot tracking sites in Matomo
2. Recreate with same dimension IDs as human sites
3. Set `MATOMO_BOT_CUSTOM_DIMENSIONS` to `null` for all domains
4. Deploy

## See Also

- [Bot Site Separation Guide](./MATOMO_BOT_SITE_SEPARATION.md) - How to configure separate bot sites
- [Bot Detection Guide](./MATOMO_BOT_DETECTION.md) - How bot detection works
- [Custom Dimensions](https://matomo.org/docs/custom-dimensions/) - Official Matomo docs
