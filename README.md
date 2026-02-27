# Excaliframe

A lightweight, extensible diagramming toolkit for Confluence and the web. Create [Excalidraw](https://excalidraw.com/) sketches, [Mermaid](https://mermaid.js.org/) flowcharts, and more — directly in Confluence pages or the browser-based playground. Built on Atlassian Forge with zero external data storage.

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

- **Multiple Diagram Types** - Excalidraw (hand-drawn sketches) and Mermaid (code-to-diagram) with more planned
- **Full Excalidraw Editor** - Shapes, text, arrows, freehand drawing — the complete Excalidraw canvas
- **Mermaid Editor** - Split-pane code editor with live SVG preview, syntax error display
- **Browser Playground** - Try everything at [excaliframe.com/playground/](https://excaliframe.com/playground/) with no install
- **Inline Viewer** - Drawings display as previews directly on Confluence pages
- **Local Storage** - All data stored in Confluence's macro config or browser IndexedDB (no external servers)
- **Lazy Loading** - Each diagram type loads independently — Mermaid users never download Excalidraw, and vice versa
- **Free & Open Source** - MIT license, uses only Forge Custom UI (no compute/storage charges)

---

## Project Structure

```
excaliframe/
├── src/
│   ├── core/            # Host-agnostic core components
│   │   ├── types.ts     # DrawingEnvelope, EditorHost, RendererHost interfaces
│   │   ├── ExcalidrawEditor.tsx   # Excalidraw editor (accepts host adapter)
│   │   ├── ExcalidrawRenderer.tsx # Excalidraw renderer (accepts host adapter)
│   │   └── MermaidEditor.tsx      # Mermaid split-pane editor
│   ├── hosts/           # Platform-specific host adapters
│   │   ├── forge.ts     # ForgeEditorHost / ForgeRendererHost
│   │   ├── web.ts       # WebEditorHost / WebRendererHost (IndexedDB)
│   │   └── playground-store.ts  # IndexedDB wrapper for multi-drawing storage
│   ├── editor/          # Forge editor entry point
│   ├── renderer/        # Forge renderer entry point
│   └── version.ts       # Auto-generated version info
├── site/                # Marketing site + playground frontend
│   ├── package.json     # Site's own deps (React, Excalidraw, jsx-dom, webpack)
│   ├── tsconfig.json    # Site TS config with @excaliframe/* path alias
│   ├── webpack.config.js # Builds 3 playground bundles
│   ├── pages/           # Playground page source (imports ../src/ via alias)
│   │   ├── editor/      # Editor dispatcher (dynamically loads Excalidraw or Mermaid)
│   │   ├── listing/     # Drawing list (jsx-dom)
│   │   └── detail/      # Drawing preview (jsx-dom)
│   ├── server/          # Go web server
│   ├── templates/       # HTML templates
│   └── static/          # Built assets + playground bundles
├── static/              # Forge build output (editor + renderer)
├── tools/               # Enterprise sync tooling
├── manifest.yml         # Forge app manifest
├── webpack.config.js    # Forge builds (editor + renderer)
├── package.json         # Forge app deps
└── Makefile
```

The core editor/renderer are **host-agnostic** — they accept a host adapter via props. This enables multiple deployments (Forge, web playground, future server-backed) from the same core code. See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

---

## Playground

Try Excaliframe without installing anything at [excaliframe.com/playground/](https://excaliframe.com/playground/). Create Excalidraw sketches or Mermaid diagrams — all stored in your browser's IndexedDB.

To run the playground locally:
```bash
cd site
npm install
npm run build         # or: npm run watch
make run              # starts Go server at http://localhost:8080
```

---

## Development

### Forge Plugin Commands

| Command | Description |
|---------|-------------|
| `make dev` | Watch mode - rebuild on changes |
| `make tunnel` | Start Forge tunnel for live testing |
| `make deploy` | Build and deploy to Forge |
| `make install-app` | Install app on a Confluence site |
| `make logs` | View Forge app logs |
| `make help` | Show all commands |

### Site / Playground Commands

| Command | Description |
|---------|-------------|
| `cd site && npm run build` | Build playground bundles |
| `cd site && npm run watch` | Watch mode for playground |
| `cd site && make run` | Run marketing site locally |
| `cd site && make deploy` | Deploy to Google App Engine |

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

- **Frontend**: React 18, TypeScript
- **Diagram engines**: Excalidraw 0.18, Mermaid 11
- **Platform**: Atlassian Forge (Custom UI) + standalone web playground
- **Build**: Webpack 5 with dynamic import code splitting
- **API**: `@forge/bridge` for Confluence integration

---

## License

MIT
