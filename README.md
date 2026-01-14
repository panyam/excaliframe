# Excaliframe

A Confluence Cloud app that lets you create and edit [Excalidraw](https://excalidraw.com/) drawings directly in Confluence pages. Built on Atlassian Forge - all drawing data is stored within Confluence.

---

## Quick Start

### Prerequisites

- Node.js 18+
- [Atlassian Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/)
- Confluence Cloud site (admin access for installation)

### Installation

```bash
# 1. Clone and install dependencies
git clone https://github.com/yourusername/excaliframe.git
cd excaliframe
npm install

# 2. Login to Forge (one-time)
forge login

# 3. Register, build, and deploy
forge register      # Register app with Atlassian
npm run build       # Build frontend assets
forge deploy        # Deploy to Forge

# 4. Install on your Confluence site
forge install       # Follow prompts to select your site
```

Or use the Makefile shortcuts:
```bash
make install        # Install npm dependencies
make setup          # First-time: install deps + register app
make deploy         # Build and deploy
make install-app    # Install on Confluence
```

### Usage

Once installed, users can:
1. Type `/Excalidraw` in any Confluence page
2. Select "Excalidraw" from the macro menu
3. Draw using the full Excalidraw editor
4. Click "Save" - drawing appears as a preview on the page
5. Click the preview to edit anytime

---

## Screenshots

**Insert a drawing** - Type `/Excal` in the Confluence editor

![Insert macro](screenshots/insert.png)

**Edit with Excalidraw** - Full-featured drawing editor

![Editor](screenshots/editor.png)

**View on page** - Drawings render as PNG previews

![Viewer](screenshots/renderer.png)

---

## Features

- **Full Excalidraw Editor** - Complete drawing capabilities including shapes, text, arrows, freehand drawing
- **Inline Viewer** - Drawings display as PNG previews directly on Confluence pages
- **Local Storage** - All data stored in Confluence's macro config (no external database)
- **No External Dependencies** - Excalidraw is bundled; works offline
- **Copy/Paste JSON** - Import/export drawings via the menu
- **Free Tier Friendly** - Uses only Forge Custom UI (no compute/storage charges)

---

## Project Structure

```
excaliframe/
├── src/
│   ├── editor/          # Excalidraw editor component
│   │   ├── ExcalidrawEditor.tsx
│   │   ├── index.tsx
│   │   └── index.html
│   ├── renderer/        # Drawing viewer component
│   │   ├── ExcalidrawRenderer.tsx
│   │   ├── index.tsx
│   │   └── index.html
│   └── version.ts       # Version info
├── dist/forge/          # Build output (generated)
│   ├── editor/          # Editor bundle
│   └── renderer/        # Renderer bundle
├── manifest.yml         # Forge app manifest
├── webpack.config.js    # Build configuration
├── package.json
└── Makefile
```

---

## Development

### Commands

| Command | Description |
|---------|-------------|
| `make dev` | Watch mode - rebuild on changes |
| `make tunnel` | Start Forge tunnel for live testing |
| `make deploy` | Build and deploy to Forge |
| `make install-app` | Install app on a Confluence site |
| `make logs` | View Forge app logs |
| `make help` | Show all commands |

### Development Workflow

```bash
# Terminal 1: Watch for changes
make dev

# Terminal 2: Start tunnel (after initial deploy)
make tunnel
```

The tunnel connects your local build to your Confluence site for live testing.

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Confluence Page                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   Excalidraw Macro                     │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │         Custom UI iframe (renderer)              │  │ │
│  │  │           PNG Preview of Drawing                 │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Edit Macro
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Macro Config Dialog                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          Custom UI iframe (editor)                     │ │
│  │              Full Excalidraw Editor                    │ │
│  │                                                        │ │
│  │  Uses @forge/bridge:                                   │ │
│  │  - view.getContext() to load saved drawing            │ │
│  │  - view.submit() to save drawing + PNG preview        │ │
│  │  - view.close() to cancel                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Insert Macro** - User inserts "Excalidraw" macro via `/` command
2. **Config Opens** - Editor Custom UI loads in config dialog
3. **Draw** - User creates drawing using Excalidraw (runs entirely client-side)
4. **Save** - `view.submit()` saves drawing JSON + PNG preview to macro config
5. **View** - Renderer Custom UI displays the PNG preview on the page
6. **Re-edit** - Opening config loads the JSON back into Excalidraw

### Storage

Drawings are stored in the macro's config object:

```typescript
interface MacroConfig {
  drawing: string;   // JSON stringified Excalidraw data
  preview: string;   // Base64 PNG data URL
}
```

No external database or Forge storage is used - everything lives in Confluence.

---

## Pricing

This app is designed to stay within Forge's **free tier**:

| Resource | Free Allowance | Excaliframe Usage |
|----------|----------------|-------------------|
| Compute Functions | 100,000 GB-sec | 0 (Custom UI only) |
| Key-Value Store | 0.1 GB | 0 (macro config) |
| SQL Storage | 730 GB-hours | 0 |

Since Excaliframe only uses Custom UI (static assets) and stores data in Confluence's macro config, it incurs **no Forge resource charges**.

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/FAQ.md](./docs/FAQ.md) | Enterprise FAQ - security, compliance |
| [SECURITY_ROADMAP.md](./SECURITY_ROADMAP.md) | Security validation roadmap |

---

## Troubleshooting

**Forge CLI not found?**
```bash
npm install -g @forge/cli
```

**Not logged in?**
```bash
forge login
```

**Tunnel not connecting?**
- Make sure you've deployed at least once (`forge deploy`)
- Check that the app is installed on your site (`forge install`)

**Changes not reflecting?**
- Rebuild: `npm run build`
- Redeploy: `forge deploy`
- Or use tunnel: `make tunnel`

---

## Tech Stack

- **Frontend**: React 18, Excalidraw 0.18, TypeScript
- **Platform**: Atlassian Forge (Custom UI)
- **Build**: Webpack 5
- **API**: `@forge/bridge` for Confluence integration

---

## License

MIT
