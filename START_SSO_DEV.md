# Quick Start: SSO Development

## Local Development (No ngrok)

### Terminal 1: Start Endpoints Server
```bash
cd /Users/filipmertens/Documents/GitHub/remix-endpoints
yarn dev
```
Server will run on: `http://localhost:3000`

### Terminal 2: Start Remix IDE
```bash
cd /Users/filipmertens/projects/remix-project
yarn serve:endpoints
```
IDE will run on: `http://localhost:8080`

### Test SSO
1. Open `http://localhost:8080` in browser
2. Activate **SSO Demo** plugin from Plugin Manager
3. **Note**: Google/Apple login won't work locally (requires HTTPS)
4. You can test with SIWE (Sign-In with Ethereum) locally

---

## With ngrok (For OAuth Providers)

### Terminal 1: Start Endpoints Server
```bash
cd /Users/filipmertens/Documents/GitHub/remix-endpoints
yarn dev
```

### Terminal 2: Start ngrok Tunnels
```bash
cd /Users/filipmertens/Documents/GitHub/remix-endpoints
ngrok start --all --config dev/ngrok.yml
```
This creates:
- `https://endpoints-remix-dev.ngrok.dev` → localhost:3000
- `https://remix-dev.ngrok.dev` → localhost:8080

### Terminal 3: Start Remix IDE with ngrok URL
```bash
cd /Users/filipmertens/projects/remix-project
NX_ENDPOINTS_URL="https://endpoints-remix-dev.ngrok.dev" yarn serve
```

### Test SSO
1. Open `https://remix-dev.ngrok.dev` in browser
2. Activate **SSO Demo** plugin from Plugin Manager
3. Click **Google** button to test OAuth login
4. Popup opens, authenticate, and you're logged in!

---

## Verify Plugin is Loaded

Open browser DevTools → Console and type:
```javascript
// Check if SSO plugin is loaded
await remix.call('manager', 'isActive', 'sso')
// Should return: true

// Check if demo plugin is active
await remix.call('manager', 'isActive', 'ssoDemo')
// Should return: true (if you activated it)
```

---

## Troubleshooting

### "Cannot connect to plugin"
- Make sure endpoints server is running on port 3000
- Check browser console for CORS errors
- Verify `NX_ENDPOINTS_URL` is set correctly

### Google OAuth not working locally
- OAuth providers require HTTPS
- Use ngrok tunnels for testing
- Make sure Google Cloud Console redirect URI matches ngrok URL

### SSO plugin not loading
- Check `http://localhost:3000/sso-plugin` in browser
- Should return the plugin JavaScript bundle
- If 404, rebuild: `cd remix-endpoints/src/sso-plugin && yarn build`

### Demo plugin not visible
- Check if it's activated: Plugin Manager → Search "SSO Demo"
- Look in the sidebar icons for the demo panel
- Check console for plugin registration errors
