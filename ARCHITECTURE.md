# Architecture

## Overview

Excaliframe has two independent components:

1. **Confluence Plugin** — An Atlassian Forge app that embeds Excalidraw into Confluence pages as a native macro. TypeScript/React frontend, deployed to Atlassian's Forge platform.
2. **Marketing Site** — A Go web application at [excaliframe.com](https://excaliframe.com) for landing pages, docs, and SEO. Deployed to Google App Engine.

Design principles:
- **Zero backend state**: No database, no user data storage — all diagram data lives in Confluence
- **Small auditable surface**: ~620 lines of TypeScript for the entire plugin
- **Extensibility**: Namespaced structure supports adding new editor types (e.g., Mermaid)
- **Client-side processing**: All drawing operations run in the browser

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Confluence Cloud                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                 Confluence Page                      │  │
│  │                                                      │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │           Excalidraw Macro (iframe)           │   │  │
│  │  │                                               │   │  │
│  │  │  View mode  → Renderer (PNG preview)          │   │  │
│  │  │  Edit mode  → Editor (full Excalidraw canvas) │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │                        │                             │  │
│  │            ┌───────────┴───────────┐                 │  │
│  │            │  Macro Config Store   │                 │  │
│  │            │  (drawing JSON +      │                 │  │
│  │            │   PNG preview)        │                 │  │
│  │            └───────────────────────┘                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Forge hosts static assets (HTML/JS/CSS) on Atlassian    │
│  infrastructure. No external server involved.            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              Marketing Site (separate)                    │
│                                                          │
│  excaliframe.com  →  Google App Engine (Go)              │
│  Landing page, docs, privacy, terms, contact             │
└─────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
excaliframe/
├── src/                            # Plugin frontend (TypeScript/React)
│   ├── editor/
│   │   ├── ExcalidrawEditor.tsx    # Full Excalidraw editor (~384 lines)
│   │   ├── index.tsx               # React entry point
│   │   ├── index.html              # HTML template
│   │   └── styles.css
│   ├── renderer/
│   │   ├── ExcalidrawRenderer.tsx  # PNG preview viewer (~142 lines)
│   │   ├── index.tsx               # React entry point
│   │   ├── index.html              # HTML template
│   │   └── styles.css
│   ├── types/
│   │   └── atlassian-connect.d.ts  # TypeScript type definitions
│   └── version.ts                  # Auto-generated version info
│
├── static/                         # Webpack build output (Forge resources)
│   ├── editor/                     # Editor bundle (served by Forge)
│   └── renderer/                   # Renderer bundle (served by Forge)
│
├── site/                           # Marketing site (Go)
│   ├── main.go                     # Server entry point
│   ├── server/
│   │   ├── app.go                  # App context and config
│   │   └── views.go                # Page handlers and routes
│   ├── templates/                  # HTML templates (goapplib/templar)
│   ├── static/                     # CSS, images, robots.txt, sitemap
│   ├── app.yaml                    # App Engine config
│   └── Makefile                    # Site build/deploy
│
├── tools/
│   └── sync.py                     # Enterprise distribution sync tool
│
├── manifest.yml                    # Forge app manifest
├── package.json                    # npm dependencies
├── webpack.config.js               # Webpack config (editor + renderer)
├── tsconfig.json                   # TypeScript config
└── Makefile                        # Build, deploy, install commands
```

---

## Confluence Plugin (Forge)

### Dual-Component Model

The plugin consists of two independent React apps, built as separate Webpack bundles:

| Component | Purpose | Entry Point | Key File |
|-----------|---------|-------------|----------|
| **Editor** | Full Excalidraw canvas for creating/editing | `src/editor/index.tsx` | `ExcalidrawEditor.tsx` |
| **Renderer** | PNG preview for viewing on pages | `src/renderer/index.tsx` | `ExcalidrawRenderer.tsx` |

Configured in `manifest.yml`:
- Macro `resource` → renderer (what users see on the page)
- Macro `config.resource` → editor (opens in fullscreen dialog on edit)

### Data Storage

All data is stored in Confluence's macro config (no external storage):

```typescript
interface MacroConfig {
  drawing: string;   // JSON stringified Excalidraw scene data
  preview: string;   // Base64 PNG data URL for inline display
}
```

The editor reads/writes this config via `@forge/bridge`:
- **Load**: `view.getContext()` → `context.extension.config`
- **Save**: `view.submit({ config: macroConfig })` — saves and closes the editor

### Data Flow

1. **Insert**: User types `/Excalidraw` in the Confluence editor
2. **View**: Confluence loads the **renderer** iframe, which displays the PNG preview
3. **Edit**: User clicks edit → Confluence opens the **editor** iframe in a fullscreen dialog
4. **Draw**: Excalidraw runs entirely client-side in the editor
5. **Save**: Editor generates a PNG preview via `exportToCanvas()`, bundles it with the drawing JSON, and calls `view.submit()` to persist back to Confluence
6. **Close**: `view.submit()` saves the config AND closes the editor panel

### Key Editor Features

- **Dirty state tracking** — warns on unsaved changes before closing
- **ESC key handling** — closes editor (defers to Excalidraw when menus are open)
- **Copy/Paste JSON** — export/import Excalidraw scenes via clipboard
- **Dynamic loading** — Excalidraw loaded via `import()` for code splitting
- **Version display** — auto-generated from `scripts/update-version.js`

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5 |
| Diagramming | @excalidraw/excalidraw 0.18 |
| Confluence API | @forge/bridge 4, @forge/api 4 |
| Bundler | Webpack 5 (multi-config: editor + renderer) |
| Build | npm + Makefile |

### Build & Deploy

```bash
make build          # Webpack builds editor + renderer to static/
make deploy         # Build + forge deploy -e development
make deploy-prod    # Build + forge deploy -e production
make install-app    # forge install -e development -p Confluence
make tunnel         # Build + forge tunnel (live dev testing)
```

Webpack outputs to `static/editor/` and `static/renderer/`, which Forge serves as Custom UI resources. Excalidraw fonts are copied to the editor bundle only.

---

## Marketing Site (Go)

A separate Go web application for the public-facing website.

### Stack

- **Framework**: [goapplib](https://github.com/panyam/goapplib) with [templar](https://github.com/panyam/templar) templates
- **Styling**: Tailwind CSS (CDN) + custom CSS
- **Deployment**: Google App Engine (`go` runtime)
- **URL**: https://excaliframe.com

### Pages

| Route | Page |
|-------|------|
| `/` | Landing page |
| `/docs/` | Documentation |
| `/privacy/` | Privacy policy |
| `/terms/` | Terms of service |
| `/contact/` | Contact (links to GitHub Issues) |

### SEO

- Canonical URL redirects (www → non-www, http → https)
- Meta descriptions and Open Graph tags on all pages
- `robots.txt` and `sitemap.xml`

### Build & Deploy

```bash
cd site/
make run            # Run locally
make deploy         # Deploy to App Engine
```

---

## Security Model

- **No server-side state**: Forge hosts static assets only; no database, no user data storage
- **Data stays in Confluence**: All drawings stored in Confluence macro config, inheriting Confluence's permissions and encryption
- **No external network calls**: Excalidraw is bundled (~400KB); no runtime fetches to third-party services
- **Client-side only**: All drawing, rendering, and PNG generation happen in the browser
- **Auditable**: `grep -r "fetch\|XMLHttpRequest\|sendBeacon\|WebSocket" src/` returns only `navigator.clipboard` usage (user-initiated copy/paste)

See [SECURITY_ROADMAP.md](./SECURITY_ROADMAP.md) for the enterprise compliance path.

---

## Adding New Diagram Libraries

Excaliframe is the "uber wrapper" — a shell that dispatches to native diagram libraries (Excalidraw, Mermaid, etc.) based on the Confluence macro type.

### Shared Resources Model

The editor and renderer are Confluence-side concepts (edit view vs. page view), not tool-specific. A single editor bundle and a single renderer bundle serve all diagram types. The Forge macro key determines which library to load:

```yaml
# manifest.yml
macro:
  - key: excalidraw-macro     # User types /Excali...
    resource: renderer
    config:
      resource: editor
  - key: mermaid-macro         # User types /Mer...
    resource: renderer
    config:
      resource: editor
```

At runtime, the editor/renderer reads the macro key and loads the appropriate native library:
- `excalidraw-macro` → loads `@excalidraw/excalidraw`
- `mermaid-macro` → loads `mermaid`

Libraries can be lazy-loaded via dynamic `import()` so only the relevant library's chunks download.

### Source Structure

New libraries add source files under the existing `src/editor/` and `src/renderer/` directories (not separate top-level dirs):

```
src/
├── editor/
│   ├── ExcalidrawEditor.tsx    # Excalidraw-specific editor
│   ├── MermaidEditor.tsx       # Mermaid-specific editor (future)
│   ├── index.tsx               # Shared entry — routes by macro key
│   └── ...
├── renderer/
│   ├── ExcalidrawRenderer.tsx  # Excalidraw-specific renderer
│   ├── MermaidRenderer.tsx     # Mermaid-specific renderer (future)
│   ├── index.tsx               # Shared entry — routes by macro key
│   └── ...
└── types/
```

### What Stays the Same

- Webpack config: still two entry points (editor, renderer)
- Forge resources: still `static/editor/` and `static/renderer/`
- Sync tool: picks up new source files automatically (entire `src/` is synced)
- No new enterprise-side config changes needed for additional libraries

---

## Enterprise Distribution

The `tools/sync.py` script syncs library source code (`src/`, `scripts/`) into an `excaliframe/` subdirectory within the enterprise target. This keeps enterprise config files (`package.json`, `webpack.config.js`, `tsconfig.json`, `.pipeline/`, `Makefile`) untouched by syncs.

### Enterprise Target Layout

```
enterprise-repo/
├── .pipeline/config.json         # Enterprise CI — untouched by sync
├── package.json                  # Enterprise deps — untouched (paths patched once by migrate)
├── webpack.config.js             # Reads from ./excaliframe/src/, outputs to static/
├── tsconfig.json                 # Points to excaliframe/src/
├── manifest.yml                  # Forge resource paths (static/editor, static/renderer)
├── Makefile                      # Enterprise build targets — untouched
├── excaliframe/                  # ← synced content lives here
│   ├── src/
│   │   ├── editor/
│   │   ├── renderer/
│   │   └── types/
│   └── scripts/
└── static/                       # Webpack build output (committed for Forge deploy)
    ├── editor/
    └── renderer/
```

### Commands

```bash
make sync TARGET=/path/to/enterprise-fork          # Preview changes
make sync TARGET=/path/to/enterprise-fork COMMIT=1  # Apply changes
make diff TARGET=/path/to/enterprise-fork           # Show diff
make migrate TARGET=/path/to/enterprise-fork        # One-time: restructure flat layout to subdir
```

The `migrate` command is a one-time operation for existing enterprise repos that had the old flat layout (src/ at top level). It moves directories and patches config file paths.

Only `src/` and `scripts/` are synced. Generated files (`src/version.ts`) are excluded via ignorelist.
