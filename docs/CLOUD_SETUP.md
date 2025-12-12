# Confluence Cloud Setup (Recommended)

This guide sets up Excaliframe with **Confluence Cloud** using Docker. No Java required!

## Why Confluence Cloud?

The `customContent` module type used by this plugin is **only supported on Confluence Cloud**, not Confluence Server. This is a limitation of Atlassian's platform - Server uses a completely different plugin system (Java-based P2 plugins).

## Prerequisites

- Docker and Docker Compose installed
- A free Atlassian developer account

## Quick Start

### Step 1: Get a Free Confluence Cloud Instance

1. Go to https://developer.atlassian.com/
2. Click "Get it free" or sign in
3. Create a new site (e.g., `yourname.atlassian.net`)
4. This gives you a free Confluence Cloud instance for development

### Step 2: Start the Plugin + Tunnel

```bash
# Build and start plugin server + cloudflared tunnel
docker compose -f docker-compose.cloud.yml up --build
```

### Step 3: Get Your Tunnel URL

In the logs, look for a line like:
```
tunnel-1  | Your quick Tunnel has been created! Visit it at https://random-words.trycloudflare.com
```

Copy that URL (e.g., `https://random-words.trycloudflare.com`)

### Step 4: Update baseUrl

Edit `atlassian-connect.json` and update the `baseUrl`:

```json
{
  "baseUrl": "https://random-words.trycloudflare.com",
  ...
}
```

Then rebuild the plugin:
```bash
docker compose -f docker-compose.cloud.yml up --build
```

### Step 5: Install in Confluence Cloud

1. Go to your Confluence Cloud site (e.g., `https://yourname.atlassian.net/wiki`)
2. Click the gear icon (Settings) > **Manage apps**
3. On the left sidebar, click **Apps** (you might need to enable development mode first)
4. Click **Upload app**
5. Enter your tunnel URL + `/confluence/atlassian-connect.json`:
   ```
   https://random-words.trycloudflare.com/confluence/atlassian-connect.json
   ```
6. Click **Upload**

### Step 6: Use the Plugin

1. Go to any Confluence page
2. Click **Insert** > **Other macros** (or use `/` command)
3. Look for "Excalidraw Drawing"
4. Create your drawing!

## Commands Reference

```bash
# Start everything
docker compose -f docker-compose.cloud.yml up --build

# Start in background
docker compose -f docker-compose.cloud.yml up -d --build

# View tunnel URL
docker compose -f docker-compose.cloud.yml logs tunnel | grep trycloudflare

# Stop everything
docker compose -f docker-compose.cloud.yml down

# Rebuild after code changes
docker compose -f docker-compose.cloud.yml up --build
```

## Troubleshooting

### Tunnel URL Changes Every Restart

Cloudflare's free "quick tunnels" generate a new URL each time. After restarting:
1. Get the new URL from logs
2. Update `baseUrl` in `atlassian-connect.json`
3. Rebuild: `docker compose -f docker-compose.cloud.yml up --build`
4. Reinstall the app in Confluence (or update the existing installation)

**Tip:** For a stable URL, sign up for a free Cloudflare account and create a named tunnel.

### Plugin Shows as "Invalid"

- Make sure the tunnel is running and accessible
- Verify `baseUrl` in `atlassian-connect.json` matches your tunnel URL exactly
- Check the plugin container is healthy: `docker compose -f docker-compose.cloud.yml ps`

### Can't Find "Excalidraw Drawing" Option

- The plugin must be successfully installed
- Check **Manage apps** to verify it's listed and enabled
- Try refreshing the page or clearing cache

### Development Mode Required

If you can't upload apps, you may need to enable development mode:
1. Go to **Manage apps**
2. Click **Settings** at bottom of sidebar
3. Enable **Enable development mode**
4. Refresh the page

## Development Workflow

For active development with hot-reload:

```bash
# Terminal 1: Run tunnel only
docker compose -f docker-compose.cloud.yml up tunnel

# Terminal 2: Run plugin locally with hot-reload
npm run dev:server
```

This lets you make changes and see them immediately without rebuilding Docker.

## Persistent Tunnel URL (Optional)

For a stable URL that doesn't change:

1. Create a free Cloudflare account at https://cloudflare.com
2. Install cloudflared locally: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
3. Create a named tunnel:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create excaliframe
   cloudflared tunnel route dns excaliframe your-subdomain.your-domain.com
   ```
4. Update `baseUrl` to your permanent URL
5. Run: `cloudflared tunnel run excaliframe`

## Next Steps

- Read [README.md](README.md) for project overview
- See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment options
- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
