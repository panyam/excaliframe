# Excaliframe

A Confluence Connect app that lets you create and edit [Excalidraw](https://excalidraw.com/) drawings directly in Confluence pages. All drawing data is stored within Confluence - no external services required.

## Screenshots

**Insert a drawing** - Type `/Excal` in the Confluence editor

![Insert macro](screenshots/insert.png)

**Edit with Excalidraw** - Full-featured drawing editor

![Editor](screenshots/editor.png)

**View on page** - Drawings render as PNG previews

![Viewer](screenshots/renderer.png)

## Features

- **Full Excalidraw Editor** - Complete drawing capabilities including shapes, text, arrows, freehand drawing, and more
- **Inline Viewer** - Drawings display as PNG previews directly on Confluence pages
- **Local Storage** - All data (JSON + PNG snapshots) stored in Confluence's content storage
- **No External Dependencies** - Excalidraw is bundled; works without external network access
- **Hot Reload Development** - Webpack dev middleware for instant changes during development
- **Multiple Deployment Options** - Local Docker setup, Confluence Cloud with tunneling, or Google App Engine

## Quick Start

### Option 1: Confluence Cloud (Recommended)

The fastest way to get started - no local Confluence installation needed.

```bash
# Install dependencies
npm install

# Start dev server with Cloudflare tunnel
make cloud-dev
```

Look for the tunnel URL in the output (e.g., `https://xxx.trycloudflare.com`), then:
1. Go to your Confluence Cloud instance → Settings → Apps → Manage apps
2. Enable development mode
3. Upload app using: `<tunnel-url>/atlassian-connect.json`

See [CLOUD_SETUP.md](./CLOUD_SETUP.md) for detailed instructions.

### Option 2: Local Confluence Server

Run Confluence locally in Docker for a production-like environment.

```bash
# Complete automated setup (PostgreSQL + Confluence + build)
make quick-start

# In a separate terminal, start the plugin server
make start
```

Then:
1. Open http://localhost:8090 and complete the Confluence setup wizard
2. Install the plugin using: `http://host.docker.internal:3000/atlassian-connect.json`

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for detailed instructions.

## Project Structure

```
excaliframe/
├── src/
│   ├── editor/                 # Excalidraw editor component
│   │   ├── ExcalidrawEditor.tsx   # Main editor React component
│   │   ├── index.tsx              # Editor entry point
│   │   ├── index.html             # Editor HTML template
│   │   └── styles.css
│   ├── renderer/               # Drawing viewer component
│   │   ├── ExcalidrawRenderer.tsx # Displays PNG preview
│   │   ├── index.tsx              # Renderer entry point
│   │   ├── index.html             # Renderer HTML template
│   │   └── styles.css
│   ├── utils/
│   │   └── mockAP.ts           # Mock Atlassian Connect API for dev
│   ├── types/
│   │   └── atlassian-connect.d.ts # TypeScript types for AP object
│   └── version.ts              # Version info injected at build
├── scripts/                    # Utility scripts for setup and testing
├── images/
│   └── excalidraw-icon.svg     # Macro icon
├── server.ts                   # Express server (TypeScript)
├── webpack.config.js           # Webpack build configuration
├── atlassian-connect.json      # Confluence Connect app descriptor
├── docker-compose.yml          # Local Confluence + PostgreSQL
├── docker-compose.cloud.yml    # Plugin + tunnel for Cloud testing
├── docker-compose.dev.yml      # Dev mode with hot reload
├── app.yaml                    # Google App Engine config
├── Makefile                    # All common commands
└── package.json
```

## Development

### Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start dev server with hot reload |
| `make start` | Start production server locally |
| `make build` | Build for production |
| `make cloud-dev` | Dev mode with tunnel for Confluence Cloud |
| `make status` | Check status of all services |
| `make logs` | View Confluence logs |
| `make help` | Show all available commands |

### Hot Reload Development

For the fastest development experience:

```bash
# Start with hot reload (changes reflect instantly)
make dev

# In another terminal, start a tunnel for Confluence Cloud
make dev-tunnel
```

Changes to files in `src/` will automatically rebuild and refresh.

### Type Checking

```bash
npm run type-check
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Confluence Page                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   Excalidraw Macro                     │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │              iframe (renderer.html)              │  │ │
│  │  │                                                  │  │ │
│  │  │           PNG Preview of Drawing                 │  │ │
│  │  │                                                  │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Edit Macro
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Macro Editor Dialog                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │               iframe (editor.html)                     │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │                                                  │  │ │
│  │  │              Full Excalidraw Editor              │  │ │
│  │  │                                                  │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Insert Macro** - User inserts "Excalidraw" macro from the Confluence editor
2. **Edit** - Confluence loads `editor.html` in a fullscreen dialog iframe
3. **Draw** - User creates drawing using Excalidraw (runs entirely client-side)
4. **Save** - Drawing JSON + PNG preview saved to macro body via `AP.confluence.saveMacro()`
5. **View** - On page load, `renderer.html` displays the PNG preview
6. **Re-edit** - Clicking edit loads the JSON back into Excalidraw

### Storage Format

Drawings are stored as JSON in the macro body:

```json
{
  "drawing": "{\"type\":\"excalidraw\",\"version\":2,\"elements\":[...],\"appState\":{...}}",
  "preview": "data:image/png;base64,..."
}
```

### Why a Server?

Confluence Connect requires a server to:
1. Serve the `atlassian-connect.json` descriptor
2. Handle lifecycle events (`/lifecycle/installed`, `/lifecycle/uninstalled`)
3. Serve HTML files for the editor and renderer

The server is minimal - all Excalidraw logic runs client-side in the browser.

See [WHY_SERVER.md](./WHY_SERVER.md) for detailed explanation.

## Deployment

### Google App Engine (Production)

```bash
# Build and deploy
make gae-deploy
```

This will:
1. Build the production bundle
2. Update `baseUrl` in `atlassian-connect.json`
3. Deploy to Google App Engine

Install in Confluence using: `https://excaliframe.appspot.com/atlassian-connect.json`

### Other Platforms

The app can be deployed to any platform that runs Node.js:
- **Heroku** - `git push heroku main`
- **Railway** - Connect GitHub repo
- **Render** - Connect GitHub repo
- **Fly.io** - `fly deploy`
- **VPS** - Use PM2 + Nginx

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions for each platform.

## Documentation

| Document | Description |
|----------|-------------|
| [LOCAL_SETUP.md](./LOCAL_SETUP.md) | Complete local development setup guide |
| [CLOUD_SETUP.md](./CLOUD_SETUP.md) | Confluence Cloud testing with tunnels |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment options |
| [TESTING.md](./TESTING.md) | Testing strategies and tools |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |
| [PERFORMANCE.md](./PERFORMANCE.md) | Confluence startup optimization |
| [WHY_SERVER.md](./WHY_SERVER.md) | Why Confluence Connect needs a server |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | Command cheat sheet |

## Troubleshooting

### Common Issues

**Plugin won't install?**
```bash
make test-connectivity  # Diagnose connection issues
```

**PostgreSQL errors during setup?**
- These are normal during Confluence initialization
- Complete the setup wizard to create database tables

**Port 3000 in use?**
```bash
make stop    # Stop any existing process
make start   # Restart the server
```

**Changes not reflecting?**
- Use `make dev` for hot reload during development
- In production, rebuild with `make build`

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more solutions.

## Tech Stack

- **Frontend**: React 18, Excalidraw 0.18, TypeScript
- **Backend**: Express.js, TypeScript
- **Build**: Webpack 5, ts-loader
- **Infrastructure**: Docker, Docker Compose
- **Deployment**: Google App Engine, or any Node.js host

## License

MIT
