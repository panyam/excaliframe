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
2. **Editor**: When creating/editing, the editor component loads with Excalidraw
3. **Storage**: Drawing data (JSON) and PNG snapshots are stored in Confluence's content storage
4. **Renderer**: When viewing, the renderer component loads the stored data and displays it using Excalidraw's view mode

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
make confluence-start  # Start Confluence + PostgreSQL
make start             # Start plugin server
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

## Notes

- The plugin uses Atlassian Connect JS API (provided globally by Confluence at runtime) for Confluence integration
- The `AP` object is automatically available when the plugin loads in Confluence
- Excalidraw is bundled with the plugin, so no external CDN is required
- All drawing data is stored locally on the Confluence page
- For local testing, use a tunneling service to expose your local server (see TESTING.md)
- PostgreSQL "relation does not exist" errors during setup are normal - complete the setup wizard to create tables
