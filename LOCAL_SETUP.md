# Local Development Setup Guide

Complete guide for running Excaliframe with Confluence Server locally.

## Prerequisites

1. **Docker Desktop** installed and running
   - macOS: `brew install --cask docker` or download from https://www.docker.com/products/docker-desktop
   - **Resource Requirements:**
     - **Memory:** Minimum 6GB, Recommended 8GB+
     - **CPUs:** Minimum 4 cores, Recommended 6+ cores
   - **Check current resources:** `make check-resources`
   - **Increase resources:** Docker Desktop → Settings → Resources → Advanced
     - Increase Memory slider to at least 6GB
     - Increase CPUs to at least 4
     - Click "Apply & Restart"

2. **Node.js** (v16 or higher) and npm

## Architecture

The local setup includes:
- **PostgreSQL** - Database backend (port 5432) - Runs in Docker
- **Confluence Server** - Main application (port 8090) - Runs in Docker
- **Plugin Server** - Express server (port 3000) - Runs locally on host
- **Persistent Storage** - Data survives container restarts
  - `./data/postgres` - PostgreSQL database files
  - `./data/confluence` - Confluence application data

**Note:** Plugin server runs locally (not in Docker) for easier development with hot-reload.
Confluence accesses it via `host.docker.internal:3000`.

## Quick Start (Automated) ⚡

**Fastest way to get started:**

```bash
make quick-start
```

This will:
- Create data directories
- Install dependencies
- Build the plugin
- Start PostgreSQL and Confluence Server
- Start the plugin server
- Show next steps

Then follow the on-screen instructions!

**Or see all available commands:**
```bash
make help
```

---

## Step-by-Step Setup (Manual)

### 1. Start Confluence Server

```bash
make confluence-start
```

Or manually:
```bash
docker-compose up -d postgres confluence
```

**First time setup:**
- Wait 2-3 minutes for Confluence to start
- Open http://localhost:8090 in your browser
- Follow the setup wizard:
  1. Choose "Set up Confluence"
  2. Choose "Production installation"
  3. **Get a FREE 30-day evaluation license:**
     - Go to: https://my.atlassian.com/products/index?evaluation=true
     - Select "Confluence Server"
     - Fill in your details and generate license
     - Copy the license key and paste it in Confluence
     - 📖 See [GET_LICENSE.md](./GET_LICENSE.md) for detailed instructions
  4. **Database Configuration:**
     - Select "PostgreSQL" as database type
     - **Hostname:** `postgres` (or `localhost` if connecting from host)
     - **Port:** `5432`
     - **Database name:** `confluence`
     - **Username:** `confluence`
     - **Password:** `confluence`
     - Click "Test connection" - should succeed
     - Click "Next" - Confluence will create all required tables automatically
  5. Complete the setup wizard (create admin account, etc.)

**Note:** The PostgreSQL errors you see in logs are normal during initialization. Confluence checks for tables before creating them. Once you complete the database setup in the wizard, all tables will be created automatically.

### 2. Configure Confluence for Local Development

Confluence Server needs to allow HTTP connections for localhost apps:

1. **Enable Development Mode** (if available):
   - Go to Settings → Manage Apps → Settings
   - Enable "Development mode"

2. **Allow HTTP connections** (important for localhost):
   - Go to Settings → General Configuration → Security Configuration
   - Find "Allow requests from localhost" or similar setting
   - Enable it
   - Or add `http://localhost:3000` to allowed domains

3. **Alternative: Configure via system properties** (if UI doesn't work):
   ```bash
   # Stop Confluence
   docker-compose stop confluence
   
   # Edit the container's setenv.sh (or use environment variables)
   docker exec -it confluence-server bash
   # Then edit /opt/atlassian/confluence/bin/setenv.sh
   # Add: -Datlassian.dev.mode=true
   ```

### 3. Build and Start Your Plugin Server

```bash
# Build the plugin
npm run build

# Start the server (runs on http://localhost:3000)
npm start
```

### 4. Start Plugin Server Locally

```bash
# Start plugin server (runs on your host machine)
make start

# Or for development with auto-reload:
make dev-server  # Terminal 1 - server with auto-reload
make dev         # Terminal 2 - webpack watch mode
```

### 5. Install the Plugin in Confluence

1. **Open Confluence**:
   - Go to http://localhost:8090
   - Log in as admin

2. **Install the app**:
   - Go to Settings → Manage Apps
   - Click "Upload app" (or "Development" → "Upload app")
   - **Use:** `http://host.docker.internal:3000/atlassian-connect.json`
   - Click "Upload"

3. **Verify installation**:
   - You should see "Excaliframe" in your installed apps list
   - Status should be "Enabled"

**Why `host.docker.internal`?** Confluence runs in Docker and needs to reach your local plugin server. The browser will still access via `localhost:3000` (handled automatically by Confluence).

### 6. Test the Plugin

1. **Create a test page**:
   - Go to any space in Confluence
   - Click "Create" → "Page"

2. **Insert Excalidraw Drawing**:
   - Type `/` in the editor
   - Search for "Excalidraw Drawing"
   - Click to insert

3. **Draw something**:
   - The editor should open with Excalidraw
   - Draw something
   - Click "Save"

4. **View the drawing**:
   - The renderer should display your drawing
   - Click "Edit" to modify it

## Development Workflow

### Active Development

For active development with hot-reload:

**Terminal 1 - Webpack watch:**
```bash
make dev
```

**Terminal 2 - Development server (with auto-reload):**
```bash
make dev-server
```

**Terminal 3 - Confluence (if needed):**
```bash
make logs  # View Confluence logs
```

After making changes:
1. Webpack rebuilds automatically (Terminal 1)
2. Server restarts automatically (Terminal 2 - nodemon)
3. Reload the Confluence page (hard refresh: Cmd+Shift+R)
4. **No Docker restart needed!**

### Useful Commands

```bash
# Quick setup
make quick-start           # Automated setup (recommended)
make status                # Check status of all services
make test-connectivity     # Test connectivity between services
make help                  # Show all available commands

# Confluence management
make confluence-start      # Start PostgreSQL + Confluence
make confluence-stop       # Stop all services
make confluence-restart    # Restart all services
make logs                  # View Confluence logs
make logs-db               # View PostgreSQL logs
make logs-all              # View all logs
make confluence-status     # Check status of all services
make confluence-reset      # ⚠️ Remove all data and start fresh

# Plugin development
make build                 # Production build (webpack + server)
make build-webpack         # Build webpack bundles only
make build-server          # Build server TypeScript only
make dev                   # Webpack watch mode
make dev-server            # Development server (ts-node)
make start                 # Production server
make stop                  # Stop plugin server
make type-check            # TypeScript type checking

# Cleanup
make clean                 # Remove build artifacts
make clean-all             # Clean everything except data
make reset                 # ⚠️ Reset everything including data
```

## Troubleshooting

### Confluence won't start

**Check all services:**
```bash
make status
# or
make confluence-status
```

**Check logs:**
```bash
# Confluence logs
make logs

# PostgreSQL logs
make logs-db

# All logs
make logs-all
```

**Check port availability:**
```bash
lsof -i :8090  # Confluence
lsof -i :5432  # PostgreSQL
```

**Check PostgreSQL connection:**
```bash
# Test database connection
docker exec confluence-postgres pg_isready -U confluence
```

**Increase Docker memory:**
- Docker Desktop → Settings → Resources → Memory → Increase to 4GB+

### Plugin won't install

**Quick test:**
```bash
make test-connectivity
```

**Check plugin server is running:**
```bash
# Should be running locally (not in Docker)
curl http://localhost:3000/atlassian-connect.json
make status
```

**Check Confluence can reach plugin:**
The docker-compose.yml is configured with `extra_hosts` to allow Confluence to reach your host machine.

**Use this URL in Confluence:**
- `http://host.docker.internal:3000/atlassian-connect.json`

**Test from Confluence container:**
```bash
docker exec confluence-server curl http://host.docker.internal:3000/atlassian-connect.json
```

**If still failing:**
1. Make sure plugin server is running: `make start`
2. Check plugin server logs for errors
3. Verify port 3000 is accessible: `curl http://localhost:3000/atlassian-connect.json`

### Plugin loads but editor/renderer don't work

**Check browser console:**
- Open browser DevTools (F12)
- Look for JavaScript errors
- Check Network tab for failed requests

**Check CORS:**
- Confluence Server might block cross-origin requests
- Ensure your plugin server allows requests from `http://localhost:8090`

**Verify files are served:**
```bash
curl http://localhost:3000/editor.html
curl http://localhost:3000/renderer.html
```

### Confluence is slow

**Increase memory:**
- Edit `docker-compose.yml`:
  ```yaml
  environment:
    - SETENV_JVM_MINIMUM_MEMORY=2048m
    - SETENV_JVM_MAXIMUM_MEMORY=4096m
  ```

**Check system resources:**
```bash
docker stats confluence-server
```

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐
│  Confluence     │────────▶│  Plugin Server   │
│  Server         │  HTTP   │  (host machine)   │
│  (Docker)       │         │  localhost:3000  │
│  localhost:8090 │         │                  │
└─────────────────┘         └──────────────────┘
         │                           │
         │                           │
         │  Uses: host.docker.internal│
         │                           │
         ▼                           ▼
  ┌──────────┐              ┌──────────────┐
  │ Browser  │◀─────────────▶│  Editor.html │
  │          │               │ Renderer.html│
  │(host)    │               │  (localhost)  │
  └──────────┘               └──────────────┘
         │
         │
         ▼
  ┌──────────────┐
  │  PostgreSQL  │
  │  (Docker)     │
  │  port 5432    │
  └──────────────┘
         │
         ▼
  ./data/postgres (persistent)
```

**Components:**
- **PostgreSQL** - Database backend (port 5432) in Docker with persistent storage in `./data/postgres`
- **Confluence Server** - Main application (port 8090) in Docker with persistent storage in `./data/confluence`
- **Plugin Server** - Runs locally on host machine (port 3000) - NOT in Docker
- **Browser** - Loads Confluence, which loads plugin iframes
- **Data Persistence** - All data survives container restarts

**Networking:**
- Confluence (Docker) → Plugin Server (host): `http://host.docker.internal:3000`
- Browser (host) → Plugin Server (host): `http://localhost:3000`
- Browser (host) → Confluence (Docker): `http://localhost:8090`

## Next Steps

Once everything is working:
1. Create some test drawings
2. Test editing existing drawings
3. Check that data persists after page reload
4. Test with multiple pages/spaces

## Cleanup

### Stop Services (Keeps Data)

```bash
# Stop all services (data persists)
make confluence-stop
make stop
```

### Remove Everything (⚠️ Deletes All Data)

```bash
# One command to reset everything
make reset
# or
make confluence-reset
```

**Note:** This will delete all Confluence pages, configurations, and database data!

### Clean Build Artifacts Only

```bash
# Remove build files (keeps data)
make clean

# Remove everything except data
make clean-all
```
