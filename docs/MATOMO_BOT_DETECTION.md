# Matomo Bot Detection

## Overview

The Remix IDE Matomo integration now includes comprehensive bot detection to filter and segment bot traffic from human users. This helps maintain accurate analytics by tagging automated visitors (CI/CD, crawlers, testing tools) with a custom dimension.

**Key Innovation:** Matomo initialization is delayed by 2 seconds to capture mouse movements, ensuring accurate human/bot classification before any data is sent.

## How It Works

### Initialization Flow

1. **Immediate Detection** (Constructor)
   - User agent analysis
   - Automation flag detection  
   - Headless browser detection
   - Missing feature detection
   - Behavioral signals analysis
   - **Mouse tracking starts** (but not analyzed yet)

2. **Delayed Analysis** (Before Matomo Init)
   - Waits **2 seconds** (configurable) for user to move mouse
   - Re-runs bot detection **with mouse movement data**
   - All events queued in `preInitQueue` during this time
   - Matomo initializes **only after** human/bot status determined

3. **Dimension Setting** (Matomo Initialization)
   - Sets `isBot` custom dimension with accurate value
   - Flushes pre-init queue with correct bot dimension
   - All subsequent events automatically tagged

### Why The Delay?

**Problem:** Bots are fast! They often trigger events before a human has time to move their mouse.

**Solution:** We delay Matomo initialization by 2 seconds to:
- ✅ Capture mouse movements from real humans
- ✅ Distinguish passive (headless) bots from humans
- ✅ Ensure accurate bot dimension on ALL events
- ✅ Prevent bot data from polluting human analytics

**Performance:** Events are queued during the 2-second window and sent immediately after with the correct bot status.

## Features

- **Multi-layered detection**: User agent patterns, automation flags, headless browser detection, and behavioral signals
- **High accuracy**: Detects Selenium, Puppeteer, Playwright, search engine crawlers, and more
- **Custom dimension**: Bot status sent to Matomo for segmentation
- **Non-intrusive**: Bots are still tracked, just tagged differently
- **TypeScript API**: Full type safety and IDE autocomplete

## Detection Methods

### 1. User Agent Patterns
Detects common bot signatures:
- Search engines: Googlebot, Bingbot, DuckDuckBot, etc.
- Social media: FacebookExternalHit, TwitterBot, LinkedInBot
- Monitoring: UptimeRobot, Pingdom, GTmetrix
- SEO tools: AhrefsBot, SemrushBot
- AI scrapers: GPTBot, ClaudeBot, ChatGPT-User
- Headless: HeadlessChrome, PhantomJS

### 2. Automation Flags
Checks for browser automation artifacts:
- `navigator.webdriver` (most reliable)
- Selenium/WebDriver properties on `window` and `document`
- PhantomJS artifacts
- Puppeteer/Playwright indicators

### 3. Headless Browser Detection
- HeadlessChrome user agent
- Missing plugins (Chrome with 0 plugins)
- SwiftShader renderer (software rendering)
- Incomplete `chrome` object

### 4. Missing Features
- No language preferences
- Missing plugins/mimeTypes
- Touch support mismatches on mobile
- Connection API absence

### 5. Behavioral Signals
- Zero or tiny screen dimensions
- Very fast page loads (< 100ms)
- Missing referrer on non-direct navigation

### 6. Mouse Movement Analysis ⭐ NEW
Analyzes cursor behavior patterns:
- **Speed & Acceleration**: Humans naturally speed up and slow down
- **Path Curvature**: Real users rarely move in straight lines
- **Click Timing**: Natural variance vs robotic precision
- **Suspicious Patterns**: Detects teleporting, grid snapping, constant speed

See [Mouse Movement Detection](./MOUSE_MOVEMENT_DETECTION.md) for detailed documentation.

## Configuration

### Adjusting the Delay

By default, Matomo waits **2 seconds** for mouse movements. You can adjust this:

```typescript
const matomoManager = new MatomoManager({
  trackerUrl: 'https://matomo.example.com/matomo.php',
  siteId: 1,
  mouseTrackingDelay: 3000, // Wait 3 seconds instead
  waitForMouseTracking: true, // Enable delay (default: true)
});
```

### Disabling Mouse Tracking Delay

For immediate initialization (not recommended for production):

```typescript
const matomoManager = new MatomoManager({
  trackerUrl: 'https://matomo.example.com/matomo.php',
  siteId: 1,
  waitForMouseTracking: false, // No delay
});
```

**Note:** Disabling the delay may result in less accurate bot detection, as passive bots won't have mouse movement data.

## Custom Dimensions IDs

The bot detection dimension IDs are configured per domain in `MatomoConfig.ts`:

| Domain | isBot Dimension ID |
|--------|-------------------|
| alpha.remix.live | 3 |
| beta.remix.live | 3 |
| remix.ethereum.org | 3 |
| localhost | 4 |
| 127.0.0.1 | 4 |

### Dimension Values

- `human` - Real user detected
- `automation-*` - Browser automation (Selenium, Puppeteer, etc.)
- `googlebot`, `bingbot`, etc. - Named crawlers
- `unknown-bot` - Generic bot detection

## Usage

### Check Bot Status

```typescript
// In any plugin with access to Matomo
const isBot = await this.call('matomo', 'isBot');
const botType = await this.call('matomo', 'getBotType');
const confidence = await this.call('matomo', 'getBotConfidence');

if (isBot) {
  console.log(`Bot detected: ${botType} (confidence: ${confidence})`);
}
```

### Get Full Detection Result

```typescript
const result = await this.call('matomo', 'getBotDetectionResult');

console.log(result);
// {
//   isBot: true,
//   botType: 'automation-selenium',
//   confidence: 'high',
//   reasons: ['Browser automation detected (navigator.webdriver or similar)'],
//   userAgent: 'Mozilla/5.0 ...'
// }
```

### Filter Bot Traffic (Optional)

```typescript
// Example: Don't track certain events for bots
const isBot = await this.call('matomo', 'isBot');

if (!isBot) {
  // Track only for humans
  trackMatomoEvent(this, UserEvents.FEATURE_USED('advanced-feature'));
}
```

## Matomo Configuration

To use the bot detection dimension in Matomo:

1. **Create Custom Dimension in Matomo Admin**:
   - Go to Administration → Custom Dimensions
   - Add new dimension: "Bot Detection"
   - Scope: Visit
   - Active: Yes
   - Note the dimension ID (should match config)

2. **Create Segments**:
   - Human traffic: `Bot Detection = human`
   - Bot traffic: `Bot Detection != human`
   - Automation only: `Bot Detection =@ automation`
   - Crawlers only: `Bot Detection =@ bot`

3. **Apply Segments to Reports**:
   - Create separate dashboards for human vs bot traffic
   - Compare conversion rates
   - Identify bot patterns

## E2E Testing

Bot detection is automatically tested in E2E runs:

```bash
yarn run build:e2e
yarn run nightwatch_local --test=matomo-bot-detection.test
```

Since E2E tests run in Selenium/WebDriver, they should always detect as bots with high confidence.

## CI/CD Considerations

- **CircleCI**: Tests run in headless Chrome with Selenium → detected as bots ✅
- **Localhost**: Bot detection respects `ENABLE_MATOMO_LOCALHOST` flag
- **Production**: All visitors get bot detection automatically

## Confidence Levels

- **High**: `navigator.webdriver` or known bot user agent
- **Medium**: Headless browser + missing features
- **Low**: Only behavioral signals

## Debugging

Enable debug mode to see detection details:

```typescript
// In browser console
const matomoManager = window._matomoManagerInstance;
const result = matomoManager.getBotDetectionResult();

console.log('Bot Detection:', result);
console.log('Reasons:', result.reasons);
```

## Performance

- Detection runs once at MatomoManager initialization
- Result is cached in memory
- Negligible performance impact (< 1ms)

## Future Improvements

Potential enhancements:
- [ ] Machine learning-based detection
- [ ] Behavioral analysis over time
- [ ] IP reputation checking
- [ ] Challenge-response for suspicious visitors
- [ ] Configurable filtering (block vs tag)

## References

- Bot detection code: `/apps/remix-ide/src/app/matomo/BotDetector.ts`
- Matomo config: `/apps/remix-ide/src/app/matomo/MatomoConfig.ts`
- E2E tests: `/apps/remix-ide-e2e/src/tests/matomo-bot-detection.test.ts`
