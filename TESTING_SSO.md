# Testing SSO in Remix IDE - Quick Start Guide

## Prerequisites

1. **Endpoints server running** with SSO plugin built (on port 3000)
2. **Remix IDE** running locally or on ngrok (on port 8080)
3. **Google OAuth credentials** configured in `env/local.env`
4. **ngrok tunnels** (if testing with OAuth providers that require HTTPS)

## Step 1: Start the Endpoints Server

```bash
cd /Users/filipmertens/Documents/GitHub/remix-endpoints

# Make sure plugin is built
cd src/sso-plugin && yarn build && cd ../..

# Start the server
yarn dev
```

Endpoints will be available at:
- **SSO auth endpoints**: `http://localhost:3000/sso`
- **SSO plugin**: `http://localhost:3000/sso-plugin`

## Step 2: Load the SSO Plugin in Remix IDE

The SSO plugin is now automatically loaded and activated in Remix IDE! You don't need to manually load it anymore.

### Verify it's loaded:

1. Open browser DevTools → Console
2. You should see the SSO plugin iframe loaded at `http://localhost:3000/sso-plugin`
3. Check Application → Frames - you should see an iframe with the SSO plugin URL

## Step 3: Start Remix IDE

```bash
cd /Users/filipmertens/projects/remix-project

# Option A: Use yarn serve:endpoints (automatically sets NX_ENDPOINTS_URL to localhost:3000)
yarn serve:endpoints

# Option B: With ngrok tunnels
ngrok start --all --config ../remix-endpoints/dev/ngrok.yml
# Then in another terminal:
NX_ENDPOINTS_URL="https://endpoints-remix-dev.ngrok.dev" yarn serve
```

The IDE will be available at:
- **Local**: `http://localhost:8080`
- **ngrok**: `https://remix-dev.ngrok.dev`

## Step 4: Activate the SSO Demo Plugin

The demo plugin is already registered in `app.ts`. To use it:

1. Open **Plugin Manager**
2. Search for **"SSO Demo"**
3. Click **Activate**

The SSO Demo panel will appear in the sidebar with login buttons.

## Step 5: Test the Login Flow

1. In the **SSO Demo** panel, click **Google** (or another provider)
2. A popup window will open to `/sso/login/google`
3. Authenticate with Google
4. The popup closes automatically
5. The demo panel shows your user info and access token
6. Check the **Event Log** at the bottom to see auth events

## Step 6: Test Token Refresh

- Wait 10 minutes, or click **Refresh Token** button
- Check the event log - you should see "Token refreshed automatically"
- The token in the display will update

## Using SSO in Your Own Plugins

Once the SSO plugin is loaded, any plugin can use it:

```typescript
// Login
await this.call('sso', 'login', 'google')

// Get user
const user = await this.call('sso', 'getUser')
console.log(user.email)

// Get token for API calls
const token = await this.call('sso', 'getToken')
fetch('https://api.example.com/data', {
  headers: { 'Authorization': `Bearer ${token}` }
})

// Listen to auth events
this.on('sso', 'authStateChanged', (state) => {
  if (state.isAuthenticated) {
    console.log('User logged in:', state.user)
  }
})

// Logout
await this.call('sso', 'logout')
```

## Troubleshooting

### Plugin not loading
- Check browser console for errors
- Verify endpoints server is running at `localhost:3000`
- Check CORS errors in network tab

### Login popup blocked
- Allow popups for `localhost:3000` in your browser
- Check popup blocker settings

### "Invalid origin" error
- Verify `AUTH_ALLOWED_ORIGINS` in `env/local.env` includes `http://localhost:8080`
- Check that IDE origin matches what's configured

### Token not refreshing
- Open browser DevTools → Network tab
- Filter for "refresh"
- Check if `/sso/refresh` requests are returning tokens
- Verify refresh cookie exists in Application → Cookies

### SSO Demo not in Plugin Manager
- Make sure you've built the remix-ide project: `yarn build`
- Check that `ssoDemo` is imported and registered in `app.ts`

## Production Setup (ngrok)

For testing with ngrok tunnels:

1. Update the SSO plugin profile URL:
   ```json
   {
     "url": "https://endpoints-remix-dev.ngrok.dev/sso-plugin"
   }
   ```

2. Update `env/local.env`:
   ```bash
   AUTH_ALLOWED_ORIGINS=https://remix-dev.ngrok.dev
   OIDC_GOOGLE_REDIRECT_URI=https://endpoints-remix-dev.ngrok.dev/sso/callback/google
   ```

3. Update Google Cloud Console authorized origins and redirect URIs

4. Load plugin via URL:
   ```
   https://remix-dev.ngrok.dev/?plugins=https://endpoints-remix-dev.ngrok.dev/sso-plugin
   ```

## Next Steps

- Wire SSO into actual Remix features (file storage, AI, etc.)
- Add logout UI to top bar
- Show user avatar/name when logged in
- Protect AI endpoints with token validation
- Add session management UI
