# Remix API Client Architecture

## Overview

The Remix IDE now uses a strongly-typed, centralized API client architecture for all backend communications. This ensures type safety, consistent authentication, and eliminates scattered fetch calls throughout the codebase.

## Architecture Components

### 1. API Client (`libs/remix-api/src/lib/plugins/api-client.ts`)

Generic HTTP client that handles:
- Automatic Bearer token injection
- Request/response typing
- Error handling
- HTTP method helpers (GET, POST, PUT, DELETE)

```typescript
const client = new ApiClient('https://api.example.com')
client.setToken('your-jwt-token')

const response = await client.get<UserResponse>('/user')
if (response.ok) {
  console.log(response.data.name)
}
```

### 2. API Types (`libs/remix-api/src/lib/plugins/api-types.ts`)

All request/response types matching backend contracts:
- `Credits` - Credit balance information
- `LinkedAccount` - Linked OAuth account
- `AccountsResponse` - List of accounts
- `LinkAccountRequest` / `LinkAccountResponse` - Account linking
- And more...

### 3. API Services (`libs/remix-api/src/lib/plugins/api-services.ts`)

Typed service classes for each API domain:

#### SSOApiService
- `verify()` - Check auth status
- `logout()` - Log out user
- `getAccounts()` - Get linked accounts
- `linkAccount()` - Link new provider
- `unlinkAccount()` - Remove linked account
- `getSiweNonce()` - Get SIWE nonce
- `verifySiwe()` - Verify SIWE signature

#### CreditsApiService
- `getBalance()` - Get credit balance
- `getTransactions()` - Get transaction history

## Usage in Plugins

### Auth Plugin Integration

The AuthPlugin now exposes three ways to access the API:

```typescript
// Get the generic API client
const apiClient = await this.call('auth', 'getApiClient')

// Get typed SSO API service
const ssoApi = await this.call('auth', 'getSSOApi')
const accountsResponse = await ssoApi.getAccounts()

// Get typed Credits API service
const creditsApi = await this.call('auth', 'getCreditsApi')
const creditsResponse = await creditsApi.getBalance()
```

### Using in React Components

Components receive typed API methods as props instead of making raw fetches:

```typescript
interface MyComponentProps {
  getLinkedAccounts?: () => Promise<AccountsResponse | null>
  unlinkAccount?: (userId: number) => Promise<void>
}

// In component
const accounts = await getLinkedAccounts()
if (accounts) {
  console.log(accounts.accounts) // Fully typed!
}
```

## Benefits

### ✅ Type Safety
All requests and responses are strongly typed - no more `any` types

### ✅ Centralized Auth
Token management happens in one place (AuthPlugin)

### ✅ Consistent Error Handling
Standardized `ApiResponse<T>` format for all endpoints

### ✅ No Raw Fetches
Components never make direct HTTP calls

### ✅ Easy Testing
Mock the service interfaces, not HTTP

### ✅ Autocomplete
Full IDE autocomplete for all API methods and types

## Migration Guide

### Before (❌ Bad)
```typescript
const response = await fetch(`${endpointUrls.sso}/accounts`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
const data: any = await response.json() // No types!
```

### After (✅ Good)
```typescript
// In plugin/component that has auth plugin access
const ssoApi = await this.call('auth', 'getSSOApi')
const response = await ssoApi.getAccounts()

if (response.ok && response.data) {
  // response.data is fully typed as AccountsResponse!
  console.log(response.data.accounts)
}
```

### For React Components
```typescript
// Pass typed methods as props
<UserMenuCompact
  user={user}
  getLinkedAccounts={async () => {
    const ssoApi = await authPlugin.call('getSSOApi')
    const result = await ssoApi.getAccounts()
    return result.ok ? result.data : null
  }}
/>
```

## Adding New Endpoints

### 1. Add Types (`api-types.ts`)
```typescript
export interface NewFeatureRequest {
  param1: string
  param2: number
}

export interface NewFeatureResponse {
  success: boolean
  data: SomeType
}
```

### 2. Add Service Method (`api-services.ts`)
```typescript
export class SSOApiService {
  async newFeature(request: NewFeatureRequest): Promise<ApiResponse<NewFeatureResponse>> {
    return this.apiClient.post<NewFeatureResponse>('/new-feature', request)
  }
}
```

### 3. Use in Plugin/Component
```typescript
const ssoApi = await this.call('auth', 'getSSOApi')
const response = await ssoApi.newFeature({ param1: 'test', param2: 123 })
```

## API Response Pattern

All API methods return `ApiResponse<T>`:

```typescript
interface ApiResponse<T> {
  ok: boolean        // Success/failure
  status: number     // HTTP status code
  data?: T          // Response data (if successful)
  error?: string    // Error message (if failed)
}

// Always check ok before accessing data
const response = await api.getAccounts()
if (response.ok && response.data) {
  // Use response.data safely
} else {
  console.error(response.error)
}
```

## Best Practices

1. **Never use raw fetch** for authenticated endpoints
2. **Always use typed service methods** from `SSOApiService` or `CreditsApiService`
3. **Check `response.ok`** before accessing `response.data`
4. **Pass methods as props** to React components, don't expose API clients directly
5. **Add types first** when creating new endpoints
6. **Use ApiClient** for new services (following the same pattern as SSO/Credits)

## File Structure

```
libs/remix-api/src/lib/plugins/
├── api-client.ts      # Generic HTTP client
├── api-types.ts       # All request/response types
├── api-services.ts    # Typed service classes
└── sso-api.ts         # SSO plugin interface (existing)

apps/remix-ide/src/app/plugins/
└── auth-plugin.tsx    # Auth plugin with API integration
```

## Questions?

- For new endpoints: Add to `api-types.ts` and `api-services.ts`
- For bugs: Check type definitions match backend contract
- For auth issues: Ensure token is set via `apiClient.setToken()`
