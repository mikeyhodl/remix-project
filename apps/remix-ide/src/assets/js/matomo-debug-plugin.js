/**
 * Matomo Debug Plugin
 * 
 * Always available debugging plugin for Matomo tracking.
 * Activated via localStorage flags:
 * - 'matomo-debug': Enable debug logging
 * - 'matomo-test-mode': Enable test data capture
 */

// Check if matomoDebugEnabled is available globally, otherwise define it
function isDebugEnabled() {
  // ALWAYS ENABLE DEBUG FOR TESTING
  console.log('[MatomoDebugPlugin] Debug is ALWAYS enabled for testing');
  return true;
}


// Main plugin initialization function
function initMatomoDebugPlugin() {
  console.log('[MatomoDebugPlugin] === INITIALIZATION STARTING ===');
  
  // Check activation flags
  const debugEnabled = isDebugEnabled();
  const testModeEnabled = window.localStorage.getItem('matomo-test-mode') === 'true';
  
  console.log('[MatomoDebugPlugin] Flags - debug:', debugEnabled, 'test:', testModeEnabled);

  // Initialize data storage
  if (!window.__matomoDebugData) {
    window.__matomoDebugData = {
      requests: [],
      events: [],
      pageViews: [],
      dimensions: {},
      visitorIds: []
    };
  }

  console.log('[MatomoDebugPlugin] Initializing with debug:', debugEnabled, 'test:', testModeEnabled);

  // Helper functions - always available globally
  window.__getMatomoDebugData = function() {
    return window.__matomoDebugData || {
      requests: [],
      events: [],
      pageViews: [],
      dimensions: {},
      visitorIds: []
    };
  };

  window.__getLatestVisitorId = function() {
    const data = window.__matomoDebugData;
    if (!data || !data.visitorIds.length) return null;
    
    const latest = data.visitorIds[data.visitorIds.length - 1];
    return {
      visitorId: latest.visitorId,
      isNull: latest.isNull,
      timestamp: latest.timestamp
    };
  };

  window.__getMatomoDimensions = function() {
    const data = window.__matomoDebugData;
    return data ? data.dimensions : {};
  };

  window.__clearMatomoDebugData = function() {
    window.__matomoDebugData = {
      requests: [],
      events: [],
      pageViews: [],
      dimensions: {},
      visitorIds: []
    };
    console.log('[MatomoDebugPlugin] Data cleared');
  };



  // Helper functions to get parsed data
  window.__getMatomoEvents = function() {
    const data = window.__matomoDebugData;
    const events = data ? data.events : [];
    console.log('[MatomoDebugPlugin] __getMatomoEvents called, returning', events.length, 'events:', events);
    return events;
  };

  window.__getMatomoPageViews = function() {
    const data = window.__matomoDebugData;
    return data ? data.pageViews : [];
  };

  window.__getLatestMatomoEvent = function() {
    console.log('[MatomoDebugPlugin] __getLatestMatomoEvent called');
    const events = window.__getMatomoEvents();
    const latest = events.length > 0 ? events[events.length - 1] : null;
    console.log('[MatomoDebugPlugin] __getLatestMatomoEvent returning:', latest);
    return latest;
  };

  window.__getMatomoEventsByCategory = function(category) {
    const events = window.__getMatomoEvents();
    return events.filter(event => event.category === category);
  };

  window.__getMatomoEventsByAction = function(action) {
    const events = window.__getMatomoEvents();
    return events.filter(event => event.action === action);
  };

  // Helper function to parse visitor ID from request
  function parseVisitorId(request) {
    if (!request) return null;
    
    // Try to extract visitor ID from various possible parameters
    const patterns = [
      /_id=([^&]+)/,      // Standard visitor ID
      /uid=([^&]+)/,      // User ID
      /cid=([^&]+)/,      // Custom ID
      /vid=([^&]+)/       // Visitor ID variant
    ];
    
    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match && match[1] && match[1] !== 'null' && match[1] !== 'undefined') {
        return decodeURIComponent(match[1]);
      }
    }
    
    return null;
  }

  // Helper function to parse event data from request string
  function parseEventData(request) {
    console.log('[MatomoDebugPlugin] parseEventData called with:', request);
    if (!request) {
      console.log('[MatomoDebugPlugin] parseEventData: No request provided');
      return null;
    }
    
    try {
      const params = new URLSearchParams(request);
      console.log('[MatomoDebugPlugin] parseEventData: URLSearchParams entries:', Array.from(params.entries()));
      
      // Check if this is an event (has e_c parameter)
      const eventCategory = params.get('e_c');
      if (!eventCategory) {
        console.log('[MatomoDebugPlugin] parseEventData: Not an event (no e_c parameter)');
        return null;
      }
      
      console.log('[MatomoDebugPlugin] parseEventData: Event detected with category:', eventCategory);
      
      const eventData = {
        category: decodeURIComponent(eventCategory || ''),
        action: decodeURIComponent(params.get('e_a') || ''),
        name: decodeURIComponent(params.get('e_n') || ''),
        value: params.get('e_v') ? parseFloat(params.get('e_v')) : null,
        visitorId: parseVisitorId(request),
        userId: params.get('uid') ? decodeURIComponent(params.get('uid')) : null,
        sessionId: params.get('pv_id') ? decodeURIComponent(params.get('pv_id')) : null,
        dimension1: params.get('dimension1') ? decodeURIComponent(params.get('dimension1')) : null, // tracking mode
        dimension2: params.get('dimension2') ? decodeURIComponent(params.get('dimension2')) : null,
        dimension3: params.get('dimension3') ? decodeURIComponent(params.get('dimension3')) : null,
        url: params.get('url') ? decodeURIComponent(params.get('url')) : null,
        referrer: params.get('urlref') ? decodeURIComponent(params.get('urlref')) : null,
        timestamp: Date.now()
      };
      
      console.log('[MatomoDebugPlugin] parseEventData: Parsed event data:', eventData);
      return eventData;
      
    } catch (e) {
      console.error('[MatomoDebugPlugin] parseEventData: Failed to parse event data:', e);
      return null;
    }
  }

  // Helper function to parse page view data from request string
  function parsePageViewData(request) {
    if (!request) return null;
    
    try {
      const params = new URLSearchParams(request);
      
      // Check if this is a page view (has url parameter but no e_c)
      if (params.get('e_c') || !params.get('url')) return null;
      
      return {
        url: decodeURIComponent(params.get('url') || ''),
        title: params.get('action_name') ? decodeURIComponent(params.get('action_name')) : null,
        visitorId: parseVisitorId(request),
        userId: params.get('uid') ? decodeURIComponent(params.get('uid')) : null,
        sessionId: params.get('pv_id') ? decodeURIComponent(params.get('pv_id')) : null,
        dimension1: params.get('dimension1') ? decodeURIComponent(params.get('dimension1')) : null,
        dimension2: params.get('dimension2') ? decodeURIComponent(params.get('dimension2')) : null,
        dimension3: params.get('dimension3') ? decodeURIComponent(params.get('dimension3')) : null,
        referrer: params.get('urlref') ? decodeURIComponent(params.get('urlref')) : null,
        timestamp: Date.now()
      };
    } catch (e) {
      console.warn('[Matomo Debug] Failed to parse page view data:', e);
      return null;
    }
  }

  // Plugin registration function
  function registerPlugin() {
    console.log('[MatomoDebugPlugin] registerPlugin called - checking if Matomo is ready...');
    console.log('[MatomoDebugPlugin] window.Matomo exists:', !!window.Matomo);
    console.log('[MatomoDebugPlugin] window.Matomo.addPlugin exists:', !!(window.Matomo && window.Matomo.addPlugin));
    
    if (!window.Matomo || typeof window.Matomo.addPlugin !== 'function') {
      console.log('[MatomoDebugPlugin] Matomo not ready, will retry...');
      return false;
    }

    try {
      console.log('[MatomoDebugPlugin] Registering plugin with Matomo...');
      
      window.Matomo.addPlugin('DebugPlugin', {
        log: function () {
          console.log('[MatomoDebugPlugin] Plugin log() method called');
          const data = window.__matomoDebugData;
          data.pageViews.push({
            title: document.title,
            url: window.location.href,
            timestamp: Date.now()
          });

          console.log('[MatomoDebugPlugin] Page view captured via log()');
          return '';
        },
        
        // This event function is called by Matomo when events are tracked
        event: function () {
          console.log('[MatomoDebugPlugin] *** Plugin event() method called! ***');
          console.log('[MatomoDebugPlugin] event() arguments:', arguments);
          console.log('[MatomoDebugPlugin] event() arguments length:', arguments.length);
          
          // Try to extract meaningful data from arguments
          const args = Array.from(arguments);
          console.log('[MatomoDebugPlugin] event() parsed args:', args);
          
          const data = window.__matomoDebugData;
          
          // Extract request string from first argument
          let requestString = null;
          if (args[0] && typeof args[0] === 'object' && args[0].request) {
            requestString = args[0].request;
            console.log('[MatomoDebugPlugin] event() found request string:', requestString);
            
            // Store the raw request for debugging
            data.requests.push({
              request: requestString,
              timestamp: Date.now(),
              method: 'plugin_event',
              url: requestString
            });
            
            console.log('[MatomoDebugPlugin] event() stored request. Total requests:', data.requests.length);
            
            // Parse event data from the request string  
            const eventData = parseEventData(requestString);
            if (eventData) {
              data.events.push(eventData);
              console.log('[MatomoDebugPlugin] event() parsed and stored event! Total events now:', data.events.length);
              console.log('[MatomoDebugPlugin] event() parsed event:', eventData);
            } else {
              console.log('[MatomoDebugPlugin] event() no event data found in request');
            }
            
            // Parse page view data
            const pageViewData = parsePageViewData(requestString);
            if (pageViewData) {
              data.pageViews.push(pageViewData);
              console.log('[MatomoDebugPlugin] event() parsed page view:', pageViewData);
            }
            
            // Parse visitor ID
            const parsedVisitorId = parseVisitorId(requestString);
            if (parsedVisitorId || (requestString && requestString.includes('_id='))) {
              const match = requestString ? requestString.match(/[?&]_id=([^&]*)/) : null;
              const visitorId = match ? decodeURIComponent(match[1]) : null;
              
              data.visitorIds.push({
                visitorId: visitorId,
                isNull: !visitorId || visitorId === 'null' || visitorId === '',
                timestamp: Date.now()
              });
              
              console.log('[MatomoDebugPlugin] event() captured visitor ID:', visitorId);
            }
            
            // Parse dimensions
            const dimensionMatches = requestString ? requestString.match(/[?&]dimension(\d+)=([^&]*)/g) : [];
            if (dimensionMatches) {
              dimensionMatches.forEach(match => {
                const [, dimNum, dimValue] = match.match(/dimension(\d+)=([^&]*)/);
                data.dimensions['dimension' + dimNum] = decodeURIComponent(dimValue);
                console.log('[MatomoDebugPlugin] event() captured dimension:', 'dimension' + dimNum, '=', decodeURIComponent(dimValue));
              });
            }
            
          } else {
            console.log('[MatomoDebugPlugin] event() no request string found in arguments');
            
            // Store raw event data as fallback
            data.events.push({
              timestamp: Date.now(),
              method: 'plugin_event',
              args: args,
              category: 'unknown',
              action: 'unknown',
              raw_data: args
            });
          }
          
          console.log('[MatomoDebugPlugin] event() processing complete. Total events:', data.events.length);
          
          return '';
        }
      });

      console.log('[MatomoDebugPlugin] Plugin registered, now setting up TrackerSetup hook...');

      // Hook into TrackerSetup for detailed request interception
      window.Matomo.on('TrackerSetup', function (tracker) {
        console.log('[MatomoDebugPlugin] *** TrackerSetup event fired! ***');
        console.log('[MatomoDebugPlugin] Tracker object:', tracker);
        console.log('[MatomoDebugPlugin] Tracker.trackRequest exists:', !!tracker.trackRequest);
        console.log('[MatomoDebugPlugin] Tracker methods:', Object.getOwnPropertyNames(tracker));

        // Hook multiple tracking methods
        const originalTrackRequest = tracker.trackRequest;
        const originalSendRequest = tracker.sendRequest;
        const originalMakeRequest = tracker.makeRequest;
        const originalDoTrackPageView = tracker.doTrackPageView;
        const originalDoTrackEvent = tracker.doTrackEvent;
        
        console.log('[MatomoDebugPlugin] Available tracking methods:');
        console.log('  - trackRequest:', !!originalTrackRequest);
        console.log('  - sendRequest:', !!originalSendRequest);
        console.log('  - makeRequest:', !!originalMakeRequest);
        console.log('  - doTrackPageView:', !!originalDoTrackPageView);
        console.log('  - doTrackEvent:', !!originalDoTrackEvent);
        
        if (originalTrackRequest) {
          console.log('[MatomoDebugPlugin] *** HOOKING INTO trackRequest METHOD! ***');
          
          tracker.trackRequest = function (request, callback) {
            console.log('[MatomoDebugPlugin] *** trackRequest INTERCEPTED! ***');
            console.log('[MatomoDebugPlugin] Raw request:', request);
            console.log('[MatomoDebugPlugin] Callback:', callback);
            
            const data = window.__matomoDebugData;

            // Capture the complete request
            const fullUrl = this.getTrackerUrl() + (request ? '?' + request : '');
            data.requests.push({
              request: request,
              timestamp: Date.now(),
              url: fullUrl
            });

            console.log('[MatomoDebugPlugin] Request stored. Total requests now:', data.requests.length);

            // Parse and store structured event data
            console.log('[MatomoDebugPlugin] trackRequest: Processing request for event parsing:', request);
            const eventData = parseEventData(request);
            if (eventData) {
              data.events.push(eventData);
              console.log('[MatomoDebugPlugin] trackRequest: Event parsed and stored! Total events now:', data.events.length);
              console.log('[MatomoDebugPlugin] trackRequest: Latest event:', eventData);
            } else {
              console.log('[MatomoDebugPlugin] trackRequest: No event data parsed from request');
            }

            // Parse and store structured page view data
            const pageViewData = parsePageViewData(request);
            if (pageViewData) {
              data.pageViews.push(pageViewData);
              console.log('[MatomoDebugPlugin] Page view parsed:', pageViewData);
            }

            // Parse visitor ID from request
            const parsedVisitorId = parseVisitorId(request);
            if (parsedVisitorId || (request && request.includes('_id='))) {
              // Extract _id parameter more reliably
              const match = request ? request.match(/[?&]_id=([^&]*)/) : null;
              const visitorId = match ? decodeURIComponent(match[1]) : null;
              
              data.visitorIds.push({
                visitorId: visitorId,
                isNull: !visitorId || visitorId === 'null' || visitorId === '',
                timestamp: Date.now()
              });
              
              console.log('[MatomoDebugPlugin] Visitor ID captured:', visitorId, 'isNull:', !visitorId || visitorId === 'null' || visitorId === '');
            } else if (request) {
              // Even if no _id parameter, log this for debugging
              console.log('[MatomoDebugPlugin] No _id parameter in request:', request);
            }

            // Parse dimensions from request
            const dimensionMatches = request ? request.match(/[?&]dimension(\d+)=([^&]*)/g) : [];
            if (dimensionMatches) {
              dimensionMatches.forEach(match => {
                const [, dimNum, dimValue] = match.match(/dimension(\d+)=([^&]*)/);
                data.dimensions['dimension' + dimNum] = decodeURIComponent(dimValue);
                
                console.log('[MatomoDebugPlugin] Dimension captured:', 'dimension' + dimNum, '=', decodeURIComponent(dimValue));
              });
            }

            console.log('[MatomoDebugPlugin] Request processed:', {
              requestLength: request ? request.length : 0,
              hasVisitorId: request && request.includes('_id='),
              visitorIdValue: request && request.includes('_id=') ? 
                (request.match(/[?&]_id=([^&]*)/) || [])[1] : 'none',
              dimensionCount: dimensionMatches.length,
              url: fullUrl
            });

            console.log('[MatomoDebugPlugin] Calling original trackRequest...');
            return originalTrackRequest.call(this, request, callback);
          };
          
          console.log('[MatomoDebugPlugin] trackRequest hook installed successfully!');
        }
        
        // Hook sendRequest if available
        if (originalSendRequest) {
          console.log('[MatomoDebugPlugin] *** HOOKING INTO sendRequest METHOD! ***');
          
          tracker.sendRequest = function (request, delay, callback) {
            console.log('[MatomoDebugPlugin] *** sendRequest INTERCEPTED! ***');
            console.log('[MatomoDebugPlugin] sendRequest - request:', request);
            console.log('[MatomoDebugPlugin] sendRequest - delay:', delay);
            console.log('[MatomoDebugPlugin] sendRequest - callback:', callback);
            
            // Same processing as trackRequest
            const data = window.__matomoDebugData;
            
            // Capture the request
            data.requests.push({
              request: request,
              timestamp: Date.now(),
              method: 'sendRequest',
              url: request
            });
            
            console.log('[MatomoDebugPlugin] sendRequest: Request stored. Total requests now:', data.requests.length);
            
            return originalSendRequest.call(this, request, delay, callback);
          };
          
          console.log('[MatomoDebugPlugin] sendRequest hook installed successfully!');
        }
        
        // Hook doTrackEvent if available  
        if (originalDoTrackEvent) {
          console.log('[MatomoDebugPlugin] *** HOOKING INTO doTrackEvent METHOD! ***');
          
          tracker.doTrackEvent = function (category, action, name, value, customData) {
            console.log('[MatomoDebugPlugin] *** doTrackEvent INTERCEPTED! ***');
            console.log('[MatomoDebugPlugin] doTrackEvent - category:', category);
            console.log('[MatomoDebugPlugin] doTrackEvent - action:', action);
            console.log('[MatomoDebugPlugin] doTrackEvent - name:', name);
            console.log('[MatomoDebugPlugin] doTrackEvent - value:', value);
            console.log('[MatomoDebugPlugin] doTrackEvent - customData:', customData);
            
            // Store event directly
            const data = window.__matomoDebugData;
            data.events.push({
              category: category || 'unknown',
              action: action || 'unknown', 
              name: name || null,
              value: value || null,
              customData: customData,
              timestamp: Date.now(),
              method: 'doTrackEvent'
            });
            
            console.log('[MatomoDebugPlugin] doTrackEvent: Event stored. Total events now:', data.events.length);
            
            return originalDoTrackEvent.call(this, category, action, name, value, customData);
          };
          
          console.log('[MatomoDebugPlugin] doTrackEvent hook installed successfully!');
        }
        
        if (!originalTrackRequest && !originalSendRequest && !originalDoTrackEvent) {
          console.warn('[MatomoDebugPlugin] *** NO TRACKING METHODS FOUND ON TRACKER! ***');
          console.log('[MatomoDebugPlugin] Available tracker methods:', Object.getOwnPropertyNames(tracker));
          console.log('[MatomoDebugPlugin] Tracker prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tracker)));
        }
      });

      console.log('[MatomoDebugPlugin] Plugin registered successfully');
      return true;
    } catch (e) {
      console.error('[MatomoDebugPlugin] Failed to register plugin:', e);
      return false;
    }
  }

  // Register for Matomo's async plugin initialization
  if (typeof window.matomoPluginAsyncInit === 'undefined') {
    window.matomoPluginAsyncInit = [];
  }
  window.matomoPluginAsyncInit.push(registerPlugin);
 
  
  console.log('[MatomoDebugPlugin] === INITIALIZATION COMPLETE ===');
}

// Export for use in loader
if (typeof window !== 'undefined') {
  window.initMatomoDebugPlugin = initMatomoDebugPlugin;
}