# Token Auto-Refresh Implementation

## Overview

Implemented automatic JWT token refresh to handle token expiration transparently without requiring users to log in again.

## Problem

- JWT access tokens expire after 15 minutes (AUTH_ACCESS_TOKEN_TTL=15m)
- Users experienced 401 Unauthorized errors when tokens expired
- Required manual re-login to continue using authenticated features

## Solution

### 1. Backend: `/refresh` Endpoint

**File**: `services/auth/src/hosts/sso.ts`

Added new endpoint to refresh access tokens using refresh tokens:

```typescript
app.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body
  
  // Verify refresh token
  const decoded = await verifyToken(refresh_token)
  
  // Generate new access token with same user ID and payload
  const accessToken = createToken(decoded.sub, decoded, ACCESS_TTL)
  
  res.json({ access_token: accessToken })
})
```

**Features**:
- Validates refresh token signature
- Generates new access token with same user data
- Returns only access token (refresh token remains valid)
- Handles errors with 401 status

### 2. Frontend: API Client Auto-Refresh

**File**: `libs/remix-api/src/lib/plugins/api-client.ts`

Enhanced ApiClient to automatically handle 401 errors:

```typescript
export interface IApiClient {
  setTokenRefreshCallback(callback: () => Promise<string | null>): void
}

export class ApiClient implements IApiClient {
  private tokenRefreshCallback: (() => Promise<string | null>) | null = null
  private isRefreshing = false
  private refreshPromise: Promise<string | null> | null = null
  
  async request<TResponse>(endpoint: string, options: ApiRequestOptions = {}) {
    // ... make request ...
    
    if (response.status === 401 && !options.skipTokenRefresh) {
      const newToken = await this.refreshToken()
      if (newToken) {
        // Retry the request with new token
        return this.request<TResponse>(endpoint, { ...options, skipTokenRefresh: true })
      }
    }
  }
  
  private async refreshToken(): Promise<string | null> {
    // Deduplicate concurrent refresh requests
    if (this.isRefreshing) {
      return this.refreshPromise
    }
    
    if (!this.tokenRefreshCallback) {
      return null
    }
    
    this.isRefreshing = true
    this.refreshPromise = this.tokenRefreshCallback()
    
    try {
      const newToken = await this.refreshPromise
      this.token = newToken
      return newToken
    } finally {
      this.isRefreshing = false
      this.refreshPromise = null
    }
  }
}
```

**Features**:
- Detects 401 Unauthorized responses
- Calls refresh callback to get new token
- Automatically retries failed request with new token
- Deduplicates concurrent refresh attempts
- Prevents infinite loops with `skipTokenRefresh` flag

### 3. AuthPlugin Integration

**File**: `apps/remix-ide/src/app/plugins/auth-plugin.tsx`

Connected API clients to refresh logic:

```typescript
constructor() {
  // Initialize API clients
  this.apiClient = new ApiClient(endpointUrls.sso)
  this.ssoApi = new SSOApiService(this.apiClient)
  
  const creditsClient = new ApiClient(endpointUrls.credits)
  this.creditsApi = new CreditsApiService(creditsClient)
  
  // Set up token refresh callback for auto-renewal
  this.apiClient.setTokenRefreshCallback(() => this.refreshAccessToken())
  creditsClient.setTokenRefreshCallback(() => this.refreshAccessToken())
}

private async refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('remix_refresh_token')
  if (!refreshToken) {
    return null
  }
  
  console.log('[AuthPlugin] Refreshing access token...')
  
  const response = await this.ssoApi.refreshToken(refreshToken)
  
  if (response.ok && response.data) {
    const newAccessToken = response.data.access_token
    
    // Update localStorage
    localStorage.setItem('remix_access_token', newAccessToken)
    
    // Update all API clients
    this.apiClient.setToken(newAccessToken)
    const creditsApiClient = (this.creditsApi as any).apiClient as ApiClient
    creditsApiClient.setToken(newAccessToken)
    
    console.log('[AuthPlugin] Access token refreshed successfully')
    return newAccessToken
  }
  
  // If refresh failed, clear tokens and emit logout
  if (response.status === 401) {
    await this.logout()
  }
  
  return null
}
```

**Features**:
- Retrieves refresh token from localStorage
- Calls `/refresh` endpoint via typed API
- Updates localStorage with new access token
- Updates all API client instances
- Handles refresh failure by logging out user

### 4. Type Definitions

**File**: `libs/remix-api/src/lib/plugins/api-types.ts`

Added type for refresh response:

```typescript
export interface RefreshTokenResponse {
  access_token: string
  refresh_token?: string  // Optional - can rotate refresh tokens
}
```

**File**: `libs/remix-api/src/lib/plugins/api-services.ts`

Added typed method to SSOApiService:

```typescript
async refreshToken(refreshToken: string): Promise<ApiResponse<RefreshTokenResponse>> {
  return this.apiClient.post<RefreshTokenResponse>('/refresh', { refresh_token: refreshToken })
}
```

## Flow Diagram

```
User makes API call
     ↓
ApiClient.request()
     ↓
Receives 401 Unauthorized
     ↓
ApiClient.refreshToken()
     ↓
Calls tokenRefreshCallback
     ↓
AuthPlugin.refreshAccessToken()
     ↓
SSOApiService.refreshToken()
     ↓
POST /refresh with refresh_token
     ↓
Backend verifies refresh token
     ↓
Backend generates new access token
     ↓
AuthPlugin updates localStorage
     ↓
ApiClient updates internal token
     ↓
Retries original request with new token
     ↓
Request succeeds! ✅
```

## Benefits

1. **Seamless UX**: Users never see 401 errors or login prompts during active sessions
2. **Automatic**: No user intervention required
3. **Efficient**: Token refresh happens on-demand only when needed
4. **Deduplication**: Multiple concurrent 401s trigger only one refresh
5. **Type-safe**: Full TypeScript typing throughout the flow
6. **Secure**: Refresh tokens stored in localStorage, short-lived access tokens

## Configuration

### Increase Token TTL

To make tokens last longer, set environment variable:

```bash
# In .env or environment
AUTH_ACCESS_TOKEN_TTL=24h  # 24 hours
# or
AUTH_ACCESS_TOKEN_TTL=7d   # 7 days
# or
AUTH_ACCESS_TOKEN_TTL=15m  # Default: 15 minutes
```

### Disable Auto-Refresh for Specific Request

```typescript
const response = await apiClient.get('/endpoint', {
  skipTokenRefresh: true  // Will not auto-refresh on 401
})
```

## Testing

1. **Login**: User authenticates normally
2. **Wait 15+ minutes**: Let access token expire
3. **Make API call**: Credits balance, linked accounts, etc.
4. **Observe**: Request succeeds after automatic refresh
5. **Check logs**:
   - `[AuthPlugin] Refreshing access token...`
   - `[AuthPlugin] Access token refreshed successfully`

## Security Considerations

- Refresh tokens are long-lived (typically 30 days)
- Access tokens are short-lived (15 minutes by default)
- Refresh tokens stored in localStorage (not secure for XSS, but acceptable for desktop app)
- Failed refresh triggers logout to force re-authentication
- Refresh endpoint validates token signature and user ID

## Future Enhancements

1. **Rotate Refresh Tokens**: Return new refresh token on each refresh
2. **Proactive Refresh**: Refresh before expiry (e.g., at 14 minutes)
3. **Background Refresh**: Refresh in Web Worker to avoid blocking UI
4. **Secure Storage**: Move tokens to httpOnly cookies (requires CORS changes)
5. **Token Revocation**: Add endpoint to invalidate refresh tokens
6. **Session Management**: Track active sessions, allow multi-device logout

## Related Files

- `services/auth/src/hosts/sso.ts` - Backend refresh endpoint
- `libs/remix-api/src/lib/plugins/api-client.ts` - Auto-refresh logic
- `libs/remix-api/src/lib/plugins/api-types.ts` - Type definitions
- `libs/remix-api/src/lib/plugins/api-services.ts` - Typed refresh method
- `apps/remix-ide/src/app/plugins/auth-plugin.tsx` - Token management
- `API_CLIENT_GUIDE.md` - Complete API architecture documentation
