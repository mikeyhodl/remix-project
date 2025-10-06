# Bot Traffic Separation - Separate Matomo Sites

## Overview

To keep human analytics clean and uncluttered, bot traffic can be routed to separate Matomo site IDs. This prevents bots from polluting your human visitor statistics while still tracking them for analysis.

## How It Works

### Default Behavior (Current)
By default, bots are tracked in the **same site** as humans but tagged with the `isBot` custom dimension:

```
remix.ethereum.org → Site ID 3
  ├── Human visitors: isBot = 'human'
  └── Bot visitors: isBot = 'automation'
```

You can segment them using Matomo's built-in filters:
- **Human traffic**: `isBot = 'human'`
- **Bot traffic**: `isBot != 'human'`

### Separate Site Routing (Optional)
Enable separate bot tracking by configuring bot site IDs:

```
remix.ethereum.org (humans) → Site ID 3
remix.ethereum.org (bots)   → Site ID 12
```

Bot traffic is automatically routed to the bot site after detection completes (2-second delay).

## Configuration

### Step 1: Create Bot Tracking Sites in Matomo

In your Matomo admin panel:

1. Go to **Administration** → **Websites** → **Manage**
2. Click **Add a new website**
3. Create sites for bot tracking:
   - **Name**: `Remix IDE - Bots (alpha.remix.live)`
   - **URL**: `https://alpha.remix.live`
   - **Time zone**: Same as main site
   - **Currency**: Same as main site
   - Note the **Site ID** (e.g., 10)

Repeat for each domain you want to separate.

### Step 2: Configure Bot Site IDs

Edit `/apps/remix-ide/src/app/matomo/MatomoConfig.ts`:

```typescript
export const MATOMO_BOT_SITE_IDS = {
  'alpha.remix.live': 10,        // Bot tracking site ID
  'beta.remix.live': 11,         // Bot tracking site ID
  'remix.ethereum.org': 12,      // Bot tracking site ID
  'localhost': null,             // Keep bots with humans for testing
  '127.0.0.1': null              // Keep bots with humans for testing
};
```

**Set to `null` to disable separation** and keep bots in the same site (filtered by dimension).

### Step 3: Configure Custom Dimensions in Bot Sites

Each bot site needs custom dimensions configured. **Dimension IDs may differ** between human and bot sites.

#### Option A: Same Dimension IDs (Simpler)

Use the same dimension IDs as your human site:

| Dimension | Name | Scope | Active |
|-----------|------|-------|--------|
| 1 | Tracking Mode | Visit | Yes |
| 2 | Click Action | Action | Yes |
| 3 | Bot Detection | Visit | Yes |

No additional configuration needed - the system will use the same dimension IDs.

#### Option B: Different Dimension IDs (More Complex)

If your bot sites have different dimension IDs, configure them in `MatomoConfig.ts`:

```typescript
export const MATOMO_BOT_CUSTOM_DIMENSIONS = {
  'alpha.remix.live': {
    trackingMode: 1,  // Different ID for bot site
    clickAction: 2,   // Different ID for bot site
    isBot: 3          // Different ID for bot site
  },
  'beta.remix.live': {
    trackingMode: 1,
    clickAction: 2,
    isBot: 3
  },
  'remix.ethereum.org': {
    trackingMode: 1,
    clickAction: 2,
    isBot: 3
  },
  'localhost': null,  // Use same IDs as human site
  '127.0.0.1': null   // Use same IDs as human site
};
```

**Set to `null`** to use the same dimension IDs as the human site.

## Benefits

### ✅ Clean Human Analytics
- No bot visits in human reports
- Accurate page view counts
- Real conversion rates
- Clean user behavior flows

### ✅ Dedicated Bot Analysis
- Analyze crawler patterns separately
- Track CI/CD test runs
- Monitor automated health checks
- Identify scraping attempts

### ✅ Easy Switching
- Change one config line to enable/disable
- No code changes required
- Fallback to dimension filtering if needed

## Comparison

| Approach | Pros | Cons | Recommended For |
|----------|------|------|-----------------|
| **Same Site + Dimension** | Simple setup, no extra sites needed | Bots appear in visitor counts | Small projects, development |
| **Separate Sites** | Clean separation, no filtering needed | More sites to manage | Production, high traffic |

## Debug Logging

When a bot is detected and routed to a separate site, you'll see:

```
[MATOMO] ✅ Bot detection complete with mouse data: {...}
[MATOMO] 🤖 Bot detected - routing to bot tracking site ID: 12 (human site ID: 3)
[MATOMO] 🔄 Updated to bot-specific custom dimensions: { trackingMode: 1, clickAction: 2, isBot: 3 }
[MATOMO] Setting tracker URL and site ID
```

If dimension IDs are the same, you won't see the "Updated to bot-specific custom dimensions" message.

## Testing

### Test Bot Routing

```javascript
// 1. Enable localhost Matomo
localStorage.setItem('showMatomo', 'true');

// 2. Reload page

// 3. Check which site ID was used
window._matomoManagerInstance.getState();
// If bot detected, should show bot site ID

// 4. Check bot detection
window._matomoManagerInstance.getBotDetectionResult();
```

### E2E Tests

The bot detection test automatically verifies routing:

```bash
yarn build:e2e && yarn nightwatch --env=chromeDesktop \
  --config dist/apps/remix-ide-e2e/nightwatch-chrome.js \
  dist/apps/remix-ide-e2e/src/tests/matomo-bot-detection.test.js
```

You should see:
```
🤖 Bot detected - routing to bot tracking site ID: X
```

## Migration Guide

### Option 1: Enable Separation (Clean Start)

1. Create bot sites in Matomo
2. Update `MATOMO_BOT_SITE_IDS` with new IDs
3. Deploy
4. All new bot traffic goes to bot sites

**Note**: Historical bot data stays in human sites (filter with `isBot` dimension).

### Option 2: Keep Current Setup

1. Leave `MATOMO_BOT_SITE_IDS` as `null`
2. Continue using dimension-based filtering
3. Use Matomo segments: `isBot = 'human'`

No changes required!

## Matomo Segments

### Human Traffic Only
```
Custom Dimension 3 (Bot Detection) is exactly "human"
```

### Bot Traffic Only
```
Custom Dimension 3 (Bot Detection) is not "human"
```

### Specific Bot Types
```
Custom Dimension 3 (Bot Detection) contains "automation"
Custom Dimension 3 (Bot Detection) contains "googlebot"
```

## Performance Impact

**Zero performance impact** - site ID is determined once during initialization (after 2-second delay).

## Rollback

To disable bot site separation:

```typescript
export const MATOMO_BOT_SITE_IDS = {
  'alpha.remix.live': null,  // Back to same site
  'beta.remix.live': null,
  'remix.ethereum.org': null,
  'localhost': null,
  '127.0.0.1': null
};
```

Redeploy. All traffic goes to human sites with `isBot` dimension filtering.

## FAQ

**Q: What happens if bot site ID is not configured in Matomo?**  
A: Matomo will reject the tracking request. Always create the site before configuring the ID.

**Q: Can I analyze bot patterns?**  
A: Yes! Bot sites have full analytics - page views, events, flows, etc.

**Q: Do bots count toward my Matomo usage limits?**  
A: Yes, both human and bot sites count toward pageview limits.

**Q: Can I delete old bot data from human sites?**  
A: Yes, but it's complex. Better to use segments to exclude bots from reports.

**Q: What about localhost/development?**  
A: Recommend keeping bots with humans on localhost (set to `null`) for easier testing.

## Related Documentation

- [Bot Detection Overview](./MATOMO_BOT_DETECTION.md)
- [Mouse Movement Detection](./MOUSE_MOVEMENT_DETECTION.md)
- [Delayed Initialization](./MATOMO_DELAYED_INIT.md)

## Example Matomo Dashboard

### Human Site (remix.ethereum.org - Site ID 3)
```
Visitors: 12,543 (100% human)
Bounce Rate: 42%
Avg. Time: 5:23
Top Pages: /editor, /compile, /deploy
```

### Bot Site (remix.ethereum.org - Bots - Site ID 12)
```
Visitors: 1,834 (100% bots)
Bot Types:
  - automation: 823 (45%)
  - googlebot: 412 (22%)
  - monitoring: 599 (33%)
Top Pages: /, /health, /api
```

Clean separation = Better insights! 🎯
