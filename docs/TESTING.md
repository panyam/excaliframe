# Testing Excalfluence Locally

This guide explains how to test the Excalfluence plugin locally with Confluence Cloud or Server.

## Prerequisites

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**
3. **A Confluence instance** (Cloud or Server)
   - **Confluence Cloud**: Sign up at https://www.atlassian.com/try/cloud (free trial)
   - **Confluence Server**: See [CONFLUENCE_SETUP.md](./CONFLUENCE_SETUP.md) for local setup
4. **A tunneling service** (ngrok, localtunnel, or cloudflared) - *Only needed for Confluence Cloud*

## Quick Start

### Option 1: Using ngrok (Recommended)

1. **Install ngrok** (if not already installed):
   ```bash
   # macOS
   brew install ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. **Build the plugin**:
   ```bash
   npm install
   npm run build
   ```

3. **Start the local server**:
   ```bash
   npm start
   # Server runs on http://localhost:3000
   ```

4. **In a new terminal, start ngrok**:
   ```bash
   ngrok http 3000
   ```

5. **Copy the HTTPS URL** from ngrok (e.g., `https://abc123.ngrok.io`)

6. **Update `atlassian-connect.json`**:
   - Change `baseUrl` from `http://localhost:3000` to your ngrok URL (e.g., `https://abc123.ngrok.io`)

7. **Install in Confluence**:
   - Go to Confluence → Settings → Manage Apps
   - Click "Upload app" or "Development" → "Upload app"
   - Paste your ngrok URL + `/atlassian-connect.json` (e.g., `https://abc123.ngrok.io/atlassian-connect.json`)
   - Click "Upload"

### Option 2: Using localtunnel (No installation needed)

1. **Build and start the server**:
   ```bash
   npm install
   npm run build
   npm start
   ```

2. **In a new terminal, start localtunnel**:
   ```bash
   npx localtunnel --port 3000
   ```

3. **Copy the HTTPS URL** provided by localtunnel

4. **Update `atlassian-connect.json`** with the localtunnel URL

5. **Install in Confluence** (same as Option 1, step 7)

### Option 3: Using cloudflared (Cloudflare Tunnel)

1. **Install cloudflared**:
   ```bash
   brew install cloudflared
   ```

2. **Build and start the server**:
   ```bash
   npm install
   npm run build
   npm start
   ```

3. **Start cloudflared**:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

4. **Copy the HTTPS URL** and update `atlassian-connect.json`

5. **Install in Confluence** (same as Option 1, step 7)

## Development Workflow

For active development, use watch mode:

1. **Terminal 1 - Watch mode for webpack**:
   ```bash
   npm run dev
   ```

2. **Terminal 2 - Development server**:
   ```bash
   npm run dev:server
   ```

3. **Terminal 3 - Tunnel** (ngrok/local tunnel):
   ```bash
   ngrok http 3000
   # or
   npx localtunnel --port 3000
   ```

4. **Update `atlassian-connect.json`** with your tunnel URL

5. **Reload the app in Confluence** after making changes:
   - Go to Manage Apps → Your app → "Reload app"

## Testing the Plugin

1. **Create a new page** in Confluence

2. **Insert the custom content**:
   - Type `/` to open the insert menu
   - Search for "Excalidraw Drawing"
   - Click to insert

3. **Edit the drawing**:
   - The editor should open with Excalidraw
   - Draw something
   - Click "Save"

4. **View the drawing**:
   - The renderer should display your drawing
   - Click "Edit" to modify it again

## Troubleshooting

### App won't install
- Make sure your tunnel URL is HTTPS (required by Confluence)
- Verify `atlassian-connect.json` is accessible at `{baseUrl}/atlassian-connect.json`
- Check browser console for errors

### Editor/Renderer won't load
- Check browser console for JavaScript errors
- Verify the webpack build completed successfully
- Ensure `editor.html` and `renderer.html` are in the `dist/` folder
- Check that the Atlassian Connect JS API is loading (should be automatic)

### API calls failing
- Verify the app has the correct scopes (`read`, `write`)
- Check that Confluence can reach your tunnel URL
- Look for CORS errors in the browser console

### Changes not appearing
- Rebuild: `npm run build`
- Reload the app in Confluence (Manage Apps → Reload app)
- Hard refresh the Confluence page (Cmd+Shift+R / Ctrl+Shift+R)

## Notes

- **ngrok** requires a free account for persistent URLs (otherwise URLs change on restart)
- **localtunnel** URLs change each time you restart
- **cloudflared** provides stable URLs and is free
- The `baseUrl` in `atlassian-connect.json` must match your tunnel URL exactly
- For production, you'll need a permanent domain and HTTPS certificate
