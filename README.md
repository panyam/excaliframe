# Excalfluence

A Confluence plugin for custom drawing types, starting with Excalidraw. Create and edit Excalidraw drawings directly in Confluence pages without requiring external network connectivity.

## Features

- **Custom Content Type**: Excalidraw drawings as a first-class content type in Confluence
- **Full Editor**: Edit drawings using the Excalidraw editor
- **Viewer**: View drawings inline on Confluence pages
- **Local Storage**: All drawing data (JSON and PNG snapshots) stored directly on the Confluence page
- **No External Dependencies**: Works entirely within Confluence (except for Confluence API calls)

## Project Structure

```
excalfluence/
├── src/
│   ├── editor/          # Editor component for creating/editing drawings
│   │   ├── ExcalidrawEditor.tsx
│   │   ├── index.tsx
│   │   ├── index.html
│   │   └── styles.css
│   ├── renderer/        # Renderer component for viewing drawings
│   │   ├── ExcalidrawRenderer.tsx
│   │   ├── index.tsx
│   │   ├── index.html
│   │   └── styles.css
│   └── types/           # TypeScript type definitions
│       └── atlassian-connect.d.ts
├── dist/                # Built files (generated)
├── atlassian-connect.json  # Confluence plugin descriptor
├── webpack.config.js    # Webpack build configuration
├── tsconfig.json        # TypeScript config for React components
├── tsconfig.server.json # TypeScript config for server
├── server.ts            # Express server (TypeScript)
└── package.json         # Dependencies

```

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the plugin**:
   ```bash
   npm run build
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Install in Confluence**:
   - Go to Confluence Administration → Manage Apps
   - Click "Upload app" or use "Development" mode
   - Upload or reference the `atlassian-connect.json` file
   - Make sure the `baseUrl` in `atlassian-connect.json` matches your server URL

## Development

- **Watch mode**: `npm run dev` - Rebuilds webpack automatically on file changes
- **Development server**: `npm run dev:server` - Run server with ts-node (no build needed)
- **Production build**: `npm run build` - Creates optimized production build (webpack + server)
- **Type checking**: `npm run type-check` - Check TypeScript types without building

## How It Works

1. **Custom Content Type**: The plugin registers a custom content type "Excalidraw Drawing" in Confluence
2. **Editor**: When creating/editing, Confluence loads `editor.html` in an iframe (served from plugin server)
3. **Client-Side Rendering**: Excalidraw runs entirely in the browser - no server-side rendering
4. **Storage**: Drawing data (JSON) and PNG snapshots are stored in Confluence's content storage via Connect API
5. **Renderer**: When viewing, Confluence loads `renderer.html` in an iframe, which displays the drawing

**Why a server?** See [WHY_SERVER.md](./WHY_SERVER.md) - Confluence Connect architecture requires a server to register the app and serve HTML files, even though Excalidraw is 100% client-side.

## Storage Format

Drawings are stored as JSON in Confluence's content storage:
```json
{
  "value": "{...excalidraw JSON...}",
  "pngSnapshot": "data:image/png;base64,..."
}
```

## Future Extensions

This plugin is designed to support multiple drawing types. To add a new type:
1. Create new editor/renderer components
2. Register a new custom content type in `atlassian-connect.json`
3. Follow the same storage pattern

## Performance

Confluence Server startup takes 60-120 seconds. See [PERFORMANCE.md](PERFORMANCE.md) for optimization tips.

**Quick tips:**
- Keep Confluence running during development (use `make confluence-restart` instead of stop+start)
- Ensure Docker Desktop has adequate resources (8GB+ RAM, 4+ CPUs)
- Monitor startup: `make monitor-startup`

## Testing Locally

### Option 1: Confluence Server Locally (Production-like) ⭐ Recommended

**Quick start (automated):**
```bash
make quick-start
```

**Common commands:**
```bash
make help              # Show all available commands
make status            # Check service status
make logs              # View Confluence logs
make confluence-start  # Start Confluence + PostgreSQL (Docker)
make start             # Start plugin server (local, runs on host)
make dev               # Webpack watch mode (local)
make dev-server        # Server with auto-reload (local)
```

**Manual setup:**
See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for complete step-by-step guide.

**Quick reference:** See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for common commands.

### Option 2: Confluence Cloud (Quick Testing)
See [TESTING.md](./TESTING.md) for testing with Confluence Cloud using tunneling services.

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

**Quick fixes:**
- PostgreSQL errors? Complete the Confluence setup wizard to create tables
- Port in use? Run `make stop` then `make start`
- Plugin won't install? Run `make test-connectivity` to diagnose

## Deployment

For production deployment to a live Confluence instance:

1. **Deploy your server** to a publicly accessible HTTPS URL (e.g., `https://excalfluence.com`)
2. **Update `baseUrl`** in `atlassian-connect.json` to your production URL
3. **Build and deploy:**
   ```bash
   npm run build
   # Deploy dist/ folder to your server
   ```
4. **Install in Confluence** using your production URL

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment options (Heroku, Railway, VPS, etc.)

## Notes

- The plugin uses Atlassian Connect JS API (provided globally by Confluence at runtime) for Confluence integration
- The `AP` object is automatically available when the plugin loads in Confluence
- Excalidraw is bundled with the plugin, so no external CDN is required
- All drawing data is stored locally on the Confluence page
- **Why a server?** See [WHY_SERVER.md](./WHY_SERVER.md) - Confluence Connect requires a server for app registration
- For local testing, use a tunneling service to expose your local server (see TESTING.md)
- PostgreSQL "relation does not exist" errors during setup are normal - complete the setup wizard to create tables
