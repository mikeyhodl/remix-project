# Mouse Movement Analysis for Bot Detection

## Overview

The bot detection system now includes **mouse movement analysis** to identify bots based on how they move the cursor. Real humans have natural, unpredictable mouse patterns, while bots typically exhibit robotic, linear, or instantaneous movements.

## Why Mouse Movement Detection?

Traditional bot detection (user agent, navigator.webdriver) can be spoofed. Mouse behavior is much harder to fake because it requires:
- Natural acceleration/deceleration curves
- Curved paths (humans don't move in straight lines)
- Random micro-movements and jitter
- Variable click timing
- Realistic speeds

## Detection Metrics

### 1. **Movement Frequency**
- Tracks number of mouse movements over time
- Bots often have zero movement (headless) or sudden teleports

### 2. **Speed Analysis**
- **Average Speed**: Typical human range is 100-2000 px/s
- **Max Speed**: Humans rarely exceed 3000 px/s
- **Speed Variance**: Humans constantly change speed

**Bot indicators:**
- Constant speed (no variation)
- Unrealistic speed (> 5000 px/s = teleporting)

### 3. **Acceleration Patterns**
Humans naturally accelerate and decelerate:
- Start slow → speed up → slow down before target
- Bots move at constant velocity

**Detection:**
- Tracks speed changes between movements
- Looks for 20%+ variation in speeds
- No acceleration = likely bot

### 4. **Path Curvature**
Humans rarely move in perfectly straight lines:
- Natural hand tremor causes micro-curves
- Intentional arcs around obstacles
- Overshoot and correction

**Detection:**
- Calculates angle changes between movement segments
- Average > 5.7° = curved path (human)
- Perfectly straight = bot

### 5. **Click Patterns**
Human clicks have natural timing variation:
- Random intervals based on cognition
- Position accuracy varies slightly

**Bot indicators:**
- Perfectly timed clicks (e.g., exactly every 1000ms)
- Variance < 100ms² = too consistent

### 6. **Grid Alignment**
Bots sometimes snap to pixel grids:
- Coordinates always multiples of 10
- No sub-pixel positioning

**Detection:**
- Checks if > 50% of points are grid-aligned
- Suspicious if true

## Suspicious Patterns Detected

| Pattern | Description | Likelihood |
|---------|-------------|------------|
| `perfectly-straight-movements` | No curve in path | Bot |
| `constant-speed` | Speed never changes | Bot |
| `unrealistic-speed` | > 5000 px/s | Bot |
| `no-mouse-activity` | Zero movement after 5s | Headless |
| `robotic-click-timing` | Clicks perfectly spaced | Bot |
| `grid-aligned-movements` | Snapping to pixel grid | Bot |

## Human Likelihood Scoring

Based on collected data:

- **High**: Natural acceleration + curved paths + no suspicious patterns
- **Medium**: Some acceleration OR curves + ≤1 suspicious pattern
- **Low**: ≥2 suspicious patterns
- **Unknown**: Not enough data yet (< 5 movements)

## Data Structure

```typescript
interface MouseBehaviorAnalysis {
  hasMoved: boolean;              // Any movement detected
  movements: number;              // Total movements tracked
  averageSpeed: number;           // Pixels per second
  maxSpeed: number;               // Peak speed
  hasAcceleration: boolean;       // Natural speed changes
  hasCurvedPath: boolean;         // Non-linear movement
  suspiciousPatterns: string[];   // List of bot indicators
  humanLikelihood: 'high' | 'medium' | 'low' | 'unknown';
}
```

## Usage Examples

### Get Mouse Analysis

```typescript
// In browser console
const matomo = window._matomoManagerInstance;
const mouseData = matomo.getBotDetectionResult()?.mouseAnalysis;

console.log('Mouse Movements:', mouseData?.movements);
console.log('Human Likelihood:', mouseData?.humanLikelihood);
console.log('Suspicious Patterns:', mouseData?.suspiciousPatterns);
```

### Start/Stop Tracking

```typescript
import { BotDetector } from './BotDetector';

// Start tracking
BotDetector.startMouseTracking();

// Get current analysis
const analysis = BotDetector.getMouseAnalysis();

// Stop tracking
BotDetector.stopMouseTracking();
```

### Check in Real-Time

```typescript
// After user has moved mouse for a while
const result = matomo.getBotDetectionResult();

if (result.mouseAnalysis?.humanLikelihood === 'high') {
  console.log('✅ Confident this is a human');
} else if (result.mouseAnalysis?.suspiciousPatterns.length > 0) {
  console.log('⚠️ Suspicious patterns:', result.mouseAnalysis.suspiciousPatterns);
}
```

## Performance

- **Sampling Rate**: 50ms (20 Hz)
- **Max Storage**: Last 100 movements + 20 clicks
- **Memory**: ~5KB per session
- **CPU**: Negligible (< 0.1% even during rapid movement)

## Privacy & Data Collection

**What's collected:**
- Cursor X/Y coordinates (relative to viewport)
- Timestamps
- Click positions

**What's NOT collected:**
- Individual mouse paths (not sent to server)
- Screen recordings
- Personal information

**Data retention:**
- In-memory only during session
- Cleared on page refresh
- Never sent to Matomo server
- Only analysis results (boolean flags) included in dimension

## Integration with Bot Detection

Mouse analysis is automatically included in `BotDetector.detect()`:

```typescript
const result = BotDetector.detect(); // includeMouseTracking defaults to true

// Result includes mouseAnalysis property
result.mouseAnalysis?.humanLikelihood; // 'high' | 'medium' | 'low' | 'unknown'
```

### Impact on Bot Decision

Mouse analysis can:
1. **Confirm Human**: High likelihood + natural patterns → reduce bot confidence
2. **Confirm Bot**: Multiple suspicious patterns → increase bot confidence
3. **Be Neutral**: Not enough data or mixed signals → no change

**Priority**: High-confidence signals (navigator.webdriver, user agent) override mouse analysis.

## E2E Testing Considerations

**Selenium/WebDriver limitations:**
- Most E2E tools don't simulate realistic mouse movements
- Movements are instant teleports or linear paths
- No acceleration curves
- Grid-aligned coordinates common

**Expected behavior in tests:**
```javascript
// E2E test running in Selenium
const result = BotDetector.detect();

// Will detect bot from navigator.webdriver (high priority)
expect(result.isBot).toBe(true);

// Mouse analysis may show:
result.mouseAnalysis?.suspiciousPatterns
// ['perfectly-straight-movements', 'constant-speed', 'grid-aligned-movements']
```

## Advanced Techniques (Future)

Potential enhancements:

1. **Bézier Curve Fitting**
   - Fit movements to bezier curves
   - Humans naturally follow curves
   - Calculate deviation from straight line

2. **Reaction Time Analysis**
   - Measure time from element appearance to click
   - Humans: 200-400ms
   - Bots: < 50ms or exactly fixed

3. **Fitts's Law Validation**
   - Movement time = a + b × log₂(D/W + 1)
   - D = distance, W = target width
   - Humans follow this law, bots don't

4. **Machine Learning**
   - Train on real human vs bot data
   - Extract features: speed distribution, angle distribution, etc.
   - 95%+ accuracy possible

5. **Keyboard Timing**
   - Similar analysis for keyboard patterns
   - Humans have variable typing speed
   - Bots have constant intervals

## Debugging

Enable verbose logging:

```javascript
// In browser console
const detector = BotDetector;

// Start tracking with logging
detector.startMouseTracking();

// Move mouse around for 5 seconds

// Get analysis
const analysis = detector.getMouseAnalysis();
console.table({
  'Movements': analysis.movements,
  'Avg Speed': analysis.averageSpeed.toFixed(2) + ' px/s',
  'Max Speed': analysis.maxSpeed.toFixed(2) + ' px/s',
  'Acceleration': analysis.hasAcceleration ? 'Yes' : 'No',
  'Curved Path': analysis.hasCurvedPath ? 'Yes' : 'No',
  'Human Likelihood': analysis.humanLikelihood,
});

console.log('Suspicious patterns:', analysis.suspiciousPatterns);
```

## References

- [Fitts's Law](https://en.wikipedia.org/wiki/Fitts%27s_law)
- [Bot Detection via Mouse Movements (Research Paper)](https://ieeexplore.ieee.org/document/8424627)
- [Human vs Robot Mouse Patterns](https://www.usenix.org/conference/soups2019/presentation/schwartz)

## Example Output

### Human User
```json
{
  "hasMoved": true,
  "movements": 87,
  "averageSpeed": 842.3,
  "maxSpeed": 2134.7,
  "hasAcceleration": true,
  "hasCurvedPath": true,
  "suspiciousPatterns": [],
  "humanLikelihood": "high"
}
```

### Bot (E2E Test)
```json
{
  "hasMoved": true,
  "movements": 23,
  "averageSpeed": 1523.8,
  "maxSpeed": 1523.8,
  "hasAcceleration": false,
  "hasCurvedPath": false,
  "suspiciousPatterns": [
    "perfectly-straight-movements",
    "constant-speed",
    "grid-aligned-movements"
  ],
  "humanLikelihood": "low"
}
```

### Headless Browser
```json
{
  "hasMoved": false,
  "movements": 0,
  "averageSpeed": 0,
  "maxSpeed": 0,
  "hasAcceleration": false,
  "hasCurvedPath": false,
  "suspiciousPatterns": ["no-mouse-activity"],
  "humanLikelihood": "unknown"
}
```
