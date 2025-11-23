# Universal Login System - Usage Examples

## Overview

The universal login system provides a complete authentication solution that can be used anywhere in the Remix IDE React tree. It includes:

- **AuthProvider**: Global auth state management via React Context
- **LoginButton**: Universal component with 3 variants (button, badge, compact)
- **LoginModal**: Modal overlay with all authentication providers
- **useAuth**: Hook to access auth state and actions anywhere

## Components

### 1. AuthProvider

Already integrated into the main `remix-app.tsx`. Wraps the entire app and provides auth context.

```tsx
<AuthProvider appManager={props.app.appManager}>
  {/* Your app */}
</AuthProvider>
```

### 2. LoginButton Component

The main component you'll use throughout the app. It has 3 variants:

#### Variant: "button" (default)
Full button with credits display and dropdown menu.

```tsx
import { LoginButton } from '@remix-ui/app'

<LoginButton 
  variant="button" 
  showCredits={true} 
  className="my-2"
/>
```

**Displays:**
- When logged out: `🔐 Sign In` button
- When logged in: Credits badge + `👤 Username` dropdown with:
  - User info (name, email, provider)
  - Credit details (total, free, paid)
  - Sign Out button

#### Variant: "badge"
Compact badge display with dropdown.

```tsx
<LoginButton 
  variant="badge" 
  showCredits={true}
/>
```

**Displays:**
- When logged out: `🔐 Login` button
- When logged in: `✓ Username [123 credits]` dropdown

#### Variant: "compact"
Icon-only display for tight spaces (like toolbar).

```tsx
<LoginButton 
  variant="compact" 
  showCredits={true}
/>
```

**Displays:**
- When logged out: `🔐 Login` button
- When logged in: `👤` icon with dropdown

### 3. useAuth Hook

Access auth state and actions from any component.

```tsx
import { useAuth } from '@remix-ui/app'

function MyComponent() {
  const { 
    isAuthenticated, 
    user, 
    credits, 
    loading, 
    error,
    login, 
    logout, 
    refreshCredits 
  } = useAuth()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  if (!isAuthenticated) {
    return (
      <button onClick={() => login('google')}>
        Login with Google
      </button>
    )
  }

  return (
    <div>
      <p>Welcome, {user.name || user.email}!</p>
      <p>Credits: {credits?.balance}</p>
      <button onClick={refreshCredits}>Refresh Credits</button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

### 4. LoginModal

The modal is automatically shown when LoginButton is clicked, but you can also use it directly:

```tsx
import { LoginModal } from '@remix-ui/app'

function MyComponent() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Custom Login Button
      </button>
      {showModal && <LoginModal onClose={() => setShowModal(false)} />}
    </>
  )
}
```

## Real-World Usage Examples

### Example 1: Add Login to Menubar

```tsx
// In your menubar component
import { LoginButton } from '@remix-ui/app'

export const Menubar = () => {
  return (
    <div className="menubar d-flex align-items-center">
      <div className="flex-grow-1">
        {/* Other menu items */}
      </div>
      <LoginButton variant="compact" showCredits={true} />
    </div>
  )
}
```

### Example 2: Protected Feature with Credits Check

```tsx
import { useAuth } from '@remix-ui/app'

export const AIAssistant = () => {
  const { isAuthenticated, credits, login } = useAuth()

  if (!isAuthenticated) {
    return (
      <div className="p-3">
        <h5>AI Assistant</h5>
        <p>Please sign in to use AI features</p>
        <LoginButton variant="button" />
      </div>
    )
  }

  if (!credits || credits.balance < 1) {
    return (
      <div className="alert alert-warning">
        Insufficient credits. You have {credits?.balance || 0} credits.
        <a href="/billing">Purchase more credits</a>
      </div>
    )
  }

  return (
    <div>
      <p>Credits remaining: {credits.balance}</p>
      {/* AI Assistant UI */}
    </div>
  )
}
```

### Example 3: Sidebar with User Profile

```tsx
import { useAuth, LoginButton } from '@remix-ui/app'

export const Sidebar = () => {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="sidebar">
      <div className="sidebar-header p-3">
        {isAuthenticated ? (
          <div>
            <img 
              src={user.picture || '/default-avatar.png'} 
              alt="Profile" 
              className="rounded-circle mb-2"
              width="40"
            />
            <div className="small">{user.name || user.email}</div>
            <LoginButton variant="badge" showCredits={true} />
          </div>
        ) : (
          <LoginButton variant="button" showCredits={false} />
        )}
      </div>
      {/* Rest of sidebar */}
    </div>
  )
}
```

### Example 4: Conditional Rendering Based on Provider

```tsx
import { useAuth } from '@remix-ui/app'

export const WalletFeatures = () => {
  const { user } = useAuth()

  // Only show wallet features for SIWE users
  if (user?.provider !== 'siwe') {
    return null
  }

  return (
    <div>
      <h6>Wallet Features</h6>
      <p>Address: {user.address}</p>
      <p>Chain ID: {user.chainId}</p>
      {/* Blockchain-specific features */}
    </div>
  )
}
```

### Example 5: Manual Login with Specific Provider

```tsx
import { useAuth } from '@remix-ui/app'

export const QuickLogin = () => {
  const { login, loading } = useAuth()

  return (
    <div className="btn-group">
      <button 
        onClick={() => login('google')} 
        disabled={loading}
        className="btn btn-sm btn-outline-primary"
      >
        🔵 Google
      </button>
      <button 
        onClick={() => login('siwe')} 
        disabled={loading}
        className="btn btn-sm btn-outline-primary"
      >
        🦊 Wallet
      </button>
    </div>
  )
}
```

## API Reference

### AuthState

```typescript
interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  token: string | null
  credits: Credits | null
  loading: boolean
  error: string | null
}
```

### AuthUser

```typescript
interface AuthUser {
  sub: string  // Unique user ID
  email?: string
  name?: string
  picture?: string
  address?: string  // For SIWE users
  chainId?: number  // For SIWE users
  provider: 'google' | 'apple' | 'discord' | 'coinbase' | 'siwe'
}
```

### Credits

```typescript
interface Credits {
  balance: number  // Total credits
  free_credits: number  // Free credits remaining
  paid_credits: number  // Paid credits remaining
}
```

### useAuth Hook

```typescript
const {
  // State
  isAuthenticated: boolean
  user: AuthUser | null
  token: string | null
  credits: Credits | null
  loading: boolean
  error: string | null
  
  // Actions
  login: (provider: 'google' | 'apple' | 'discord' | 'coinbase' | 'siwe') => Promise<void>
  logout: () => Promise<void>
  refreshCredits: () => Promise<void>
  dispatch: React.Dispatch<AuthAction>
} = useAuth()
```

### LoginButton Props

```typescript
interface LoginButtonProps {
  className?: string  // Additional CSS classes
  showCredits?: boolean  // Show/hide credits (default: true)
  variant?: 'button' | 'badge' | 'compact'  // Display variant (default: 'button')
}
```

## Authentication Providers

The system supports 5 authentication providers:

1. **Google** 🔵 - OAuth via Google accounts
2. **Discord** 💬 - OAuth via Discord accounts
3. **SIWE** 🦊 - Sign-In With Ethereum (MetaMask, Coinbase Wallet, etc.)
4. **Apple** 🍎 - OAuth via Apple ID
5. **Coinbase** 🔷 - OAuth via Coinbase (currently disabled)

## Events

The system automatically listens to SSO plugin events:

- `authStateChanged` - Fired when auth state changes
- `loginSuccess` - Fired on successful login
- `loginError` - Fired on login failure
- `logout` - Fired when user logs out
- `tokenRefreshed` - Fired when access token is refreshed

These are handled automatically by the AuthProvider. You don't need to listen to them manually unless you have specific needs.

## Best Practices

1. **Use LoginButton for most cases** - It handles all the UI logic
2. **Use useAuth for custom logic** - When you need programmatic access to auth state
3. **Check credits before expensive operations** - Especially for AI/API features
4. **Refresh credits after operations** - Call `refreshCredits()` after API calls that consume credits
5. **Handle loading states** - Always check `loading` from useAuth
6. **Handle errors gracefully** - Display `error` to users when present
7. **Use appropriate variant** - `compact` for toolbars, `button` for prominent areas, `badge` for sidebars

## Migration from SSO Demo Plugin

If you're currently using the SSO Demo plugin directly:

**Before:**
```tsx
await plugin.call('sso', 'login', 'google')
const user = await plugin.call('sso', 'getUser')
const isAuth = await plugin.call('sso', 'isAuthenticated')
```

**After:**
```tsx
import { useAuth } from '@remix-ui/app'

const { login, user, isAuthenticated } = useAuth()
await login('google')
// user and isAuthenticated are automatically updated
```

The new system is fully compatible with the SSO plugin and provides a much cleaner API!
