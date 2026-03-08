# Architecture

## Overview

Excaliframe has two independent components:

1. **Confluence Plugin** — An Atlassian Forge app that embeds diagram editors into Confluence pages as native macros. TypeScript/React frontend, deployed to Atlassian's Forge platform.
2. **Marketing Site + Playground** — A Go web application at [excaliframe.com](https://excaliframe.com) for landing pages, docs, and the interactive playground (no install required). Deployed to Google App Engine.

Supported diagram types:
- **Excalidraw** — hand-drawn style whiteboard diagrams
- **Mermaid** — code-to-diagram (flowcharts, sequence diagrams, etc.)

Design principles:
- **Zero backend state**: No database, no user data storage — all diagram data lives in Confluence (plugin) or IndexedDB (playground)
- **Small auditable surface**: Thin core with tool-agnostic host adapters
- **Multi-tool extensibility**: `DrawingEnvelope` pattern with dynamic imports — each diagram type loads independently
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
│   ├── core/                       # Host-agnostic core components
│   │   ├── types.ts                # DrawingEnvelope, EditorHost, RendererHost interfaces
│   │   ├── EditorHandle.ts         # EditorHandle + EditorStateCallbacks interfaces
│   │   ├── EditorChrome.tsx        # Chrome wrapper (collab, autosave, shortcuts, layout)
│   │   ├── FloatingToolbar.tsx     # Gear-icon expandable menu (save, share, auto-save)
│   │   ├── SaveToast.tsx           # Auto-dismissing save-status pill (web/playground)
│   │   ├── ExcalidrawEditor.tsx    # Excalidraw editor (forwardRef, pure content)
│   │   ├── ExcalidrawRenderer.tsx  # Excalidraw renderer (accepts RendererHost prop)
│   │   ├── MermaidEditor.tsx       # Mermaid split-pane editor (forwardRef, pure content)
│   │   ├── mermaid.css             # Mermaid editor styles (shared by Forge + playground)
│   │   └── DrawingTitle.tsx        # Inline-editable title (standalone, host-agnostic)
│   ├── hosts/                      # Platform-specific host adapters
│   │   ├── forge.ts                # ForgeEditorHost, ForgeRendererHost (@forge/bridge)
│   │   ├── web.ts                  # WebEditorHost, WebRendererHost (IndexedDB via PlaygroundStore)
│   │   └── playground-store.ts     # IndexedDB wrapper for multi-drawing storage
│   ├── editor/                     # Forge editor entry point (dispatcher)
│   │   ├── index.tsx               # Reads macro key, lazy-loads correct editor
│   │   ├── excalidraw-boot.tsx     # Excalidraw async chunk wrapper
│   │   ├── mermaid-boot.tsx        # Mermaid async chunk wrapper
│   │   ├── excalidraw.css          # Excalidraw-specific styles
│   │   ├── index.html              # HTML template
│   │   └── styles.css              # Generic editor reset
│   ├── renderer/                   # Forge renderer entry point
│   │   ├── index.tsx               # Wires core renderer + Forge host
│   │   ├── index.html              # HTML template
│   │   └── styles.css
│   ├── collab/                      # Real-time collaboration client
│   │   ├── adapters/                # Tool-specific sync adapters
│   │   │   ├── ExcalidrawSyncAdapter.ts  # Excalidraw diff/merge/cursor impl
│   │   │   └── MermaidSyncAdapter.ts     # Mermaid text sync adapter
│   │   ├── sync/                    # Tool-agnostic sync orchestration
│   │   │   ├── SyncAdapter.ts       # Re-exports from @panyam/massrelay/sync
│   │   │   └── useSync.ts           # Debounced outgoing, throttled cursors, event routing, E2EE encrypt/decrypt
│   │   ├── CollabClient.ts          # Re-exports from @panyam/massrelay/client
│   │   ├── crypto.ts                # E2EE: PBKDF2 key derivation, AES-256-GCM encrypt/decrypt, password generation
│   │   ├── useCollaboration.ts      # React hook for connection state
│   │   ├── SharePanel.tsx           # Share dialog (relay servers, password, peer list with colored dots)
│   │   ├── CollabBadge.tsx          # People icon badge with peer count
│   │   ├── peerColors.ts            # 8-color palette, getPeerColor(), getPeerLabel()
│   │   ├── url-params.ts            # Re-exports from @panyam/massrelay/url
│   │   └── types.ts                 # CollabConfig, RelayServerOption, proto re-exports
│   └── version.ts                  # Auto-generated version info
│
├── static/                         # Webpack build output (Forge resources)
│   ├── editor/                     # Editor bundle (served by Forge)
│   └── renderer/                   # Renderer bundle (served by Forge)
│
├── site/                           # Marketing site (Go + playground frontend)
│   ├── package.json                # Site's own npm deps (React, Excalidraw, jsx-dom, webpack)
│   ├── tsconfig.json               # Site TS config with @excaliframe/* path alias
│   ├── rspack.config.js            # Builds playground bundles (3 entry points) — default
│   ├── webpack.config.js           # Builds playground bundles (3 entry points) — fallback
│   ├── pages/                      # Playground frontend source (TypeScript/TSX)
│   │   ├── editor/                 # Editor dispatcher (dynamic import per tool)
│   │   │   ├── index.tsx           # Reads envelope.tool, lazy-loads correct editor
│   │   │   ├── excalidraw-boot.tsx # Excalidraw async chunk wrapper
│   │   │   ├── mermaid-boot.tsx    # Mermaid async chunk wrapper
│   │   │   └── styles.css          # Shared editor reset
│   │   ├── excalidraw/             # Excalidraw-specific styles (imported by boot)
│   │   │   └── styles.css
│   │   ├── listing/                # Drawing list page entry point
│   │   │   └── index.tsx           # jsx-dom, IndexedDB grid/table population
│   │   └── detail/                 # Drawing detail/preview page entry point
│   │       └── index.tsx           # jsx-dom, drawing preview + metadata
│   ├── main.go                     # Server entry point
│   ├── server/
│   │   ├── app.go                  # App context and config
│   │   └── views.go                # Page handlers and routes
│   ├── templates/                  # HTML templates (goapplib/templar)
│   │   ├── PlaygroundListPage.html   # Drawing list (extends EntityListing)
│   │   ├── PlaygroundDetailPage.html # Drawing preview
│   │   └── PlaygroundEditPage.html   # Full-screen editor
│   ├── static/                     # CSS, images, robots.txt, sitemap
│   │   └── playground/             # Playground build outputs (generated)
│   │       ├── editor/             # Editor dispatcher bundle + async chunks
│   │       ├── listing/            # List page bundle
│   │       └── detail/             # Detail page bundle
│   ├── app.yaml                    # App Engine config
│   └── Makefile                    # Site build/deploy
│
├── e2e/                           # Playwright E2E tests (Python + uv)
│   ├── conftest.py                # Fixtures: server lifecycle, multi-profile contexts
│   ├── list_tests.py              # Standalone test lister (AST-based)
│   ├── pages/                     # Page Object Models (listing, editor, join, share)
│   ├── helpers/                   # Seeding (IndexedDB), server manager, join codes
│   ├── tests/                     # 23 tests across 7 files
│   ├── pyproject.toml             # uv project (playwright, pytest-playwright)
│   └── Makefile                   # E2E-specific targets (test, list, debug, report)
│
├── scripts/
│   └── pre-push.sh                # Git hook: unit + E2E tests on push
│
├── tools/
│   └── sync.py                     # Enterprise distribution sync tool
│
├── manifest.yml                    # Forge app manifest
├── package.json                    # Forge app npm dependencies
├── rspack.config.js                # Rspack config (editor + renderer) — default bundler
├── webpack.config.js               # Webpack config (editor + renderer) — fallback
├── tsconfig.json                   # TypeScript config (src/ only)
└── Makefile                        # Build, deploy, install commands
```

---

## Confluence Plugin (Forge)

### Multi-Hostable Architecture

The core Excalidraw editor and renderer are host-agnostic — they accept a host adapter via props and have zero platform imports. This enables multiple "installs" of the same diagramming components:

| Host | Adapter | Storage | Use Case |
|------|---------|---------|----------|
| **Forge** | `ForgeEditorHost` / `ForgeRendererHost` | Confluence macro config | Confluence plugin |
| **Web** | `WebEditorHost` / `WebRendererHost` | IndexedDB (via `PlaygroundStore`) | Playground on excaliframe.com |
| **Server** | _(future)_ | Backend API | Multi-user hosted mode |

#### Host Interface

```typescript
interface DrawingEnvelope {
  tool: string;       // e.g. "excalidraw", "mermaid" — tool-agnostic
  version: number;    // envelope schema version
  data: string;       // opaque tool-specific payload
  preview?: string;   // base64 PNG preview
  createdAt?: string;
  updatedAt?: string;
}

interface EditorHost {
  loadDrawing(): Promise<DrawingEnvelope | null>;
  saveDrawing(envelope: DrawingEnvelope): Promise<void>;
  close(): void;
  getTitle?(): string;          // optional — return current drawing title
  setTitle?(title: string): Promise<void>;  // optional — persist title change
}

interface RendererHost {
  loadConfig(): Promise<DrawingEnvelope | null>;
}
```

The `DrawingEnvelope` is tool-agnostic — hosts store/retrieve it without knowing whether the `data` field contains Excalidraw JSON, Mermaid markup, or anything else.

**Title support** is optional on `EditorHost`. `WebEditorHost` implements `getTitle()` / `setTitle()` because playground drawings have user-editable titles stored in IndexedDB (independently of drawing save). `ForgeEditorHost` does not implement them — Forge drawings live in Confluence pages where the page title serves as the name.

### Dual-Component Model

The plugin consists of two independent React apps, built as separate Webpack bundles:

| Component | Purpose | Entry Point | Core Component |
|-----------|---------|-------------|----------------|
| **Editor** | Dispatcher — loads Excalidraw or Mermaid by macro key | `src/editor/index.tsx` | `src/core/ExcalidrawEditor.tsx` or `MermaidEditor.tsx` |
| **Renderer** | Preview for viewing on pages (tool-agnostic) | `src/renderer/index.tsx` | `src/core/ExcalidrawRenderer.tsx` |

Configured in `manifest.yml`:
- Macro `resource` → renderer (what users see on the page)
- Macro `config.resource` → editor (opens in fullscreen dialog on edit)

### Data Storage

On Forge, data is stored in Confluence's macro config (no external storage). The Forge host adapter translates between `DrawingEnvelope` and Forge's `MacroConfig`:

```typescript
// What Forge stores
interface MacroConfig {
  drawing: string;   // JSON stringified Excalidraw scene data
  preview: string;   // Base64 PNG data URL for inline display
}
```

The Forge host adapter reads/writes via `@forge/bridge`:
- **Load**: `view.getContext()` → `context.extension.config` → `DrawingEnvelope`
- **Save**: `DrawingEnvelope` → `view.submit({ config: macroConfig })` — saves and closes the editor

### Editor Dispatcher

The Forge editor entry point (`src/editor/index.tsx`) uses the same dispatcher pattern as the playground:

1. Read `moduleKey` from `view.getContext()` (`extension.moduleKey`)
2. Map macro key to tool: `'mermaid-macro'` → `'mermaid'`, default → `'excalidraw'`
3. Dynamic `import()` of the matching boot module (`excalidraw-boot.tsx` or `mermaid-boot.tsx`)
4. Create `ForgeEditorHost(tool)` and mount the editor

Each boot module is a webpack async chunk that imports the tool's core editor + CSS. This means Mermaid users never download Excalidraw, and vice versa.

### Data Flow

1. **Insert**: User types `/Excalidraw` or `/Mermaid` in the Confluence editor
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
- **Editable drawing title** (playground only) — inline-editable title in the site header, persists to IndexedDB immediately

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5 |
| Diagramming | @excalidraw/excalidraw 0.18, mermaid 11 |
| Collaboration | @panyam/massrelay (relay server + vanilla TS client) |
| Confluence API | @forge/bridge 4, @forge/api 4 |
| Bundler | Rspack (default), Webpack 5 (fallback) — multi-config: editor + renderer |
| Build | npm + Makefile |

### Build & Deploy

```bash
make build              # Rspack builds editor + renderer to static/
make build-old          # Webpack fallback (same output)
make playground-build   # Rspack builds playground to site/static/playground/
make playground-build-old # Webpack fallback
make deploy             # Build + forge deploy -e development
make deploy-prod        # Build + forge deploy -e production
make install-app        # forge install -e development -p Confluence
make tunnel             # Build + forge tunnel (live dev testing)
```

**Bundler**: Rspack is the default bundler (5-10x faster than Webpack). Webpack configs are kept intact as `-old` fallback targets. Both use identical output paths and config structure — `rspack.config.js` mirrors `webpack.config.js` with built-in plugin replacements (`HtmlRspackPlugin`, `CopyRspackPlugin`, `builtin:swc-loader`).

Build outputs to `static/editor/` and `static/renderer/`, which Forge serves as Custom UI resources. The playground builds separately from `site/` via its own `rspack.config.js` to `site/static/playground/{listing,detail,editor}/`. Excalidraw fonts are copied to both the Forge editor and playground editor bundles.

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
| `/` | Playground drawing list (landing page) |
| `/about/` | Marketing/about page with feature highlights and install links |
| `/docs/` | Documentation |
| `/privacy/` | Privacy policy (covers both Confluence and playground data) |
| `/terms/` | Terms of service |
| `/contact/` | Contact (links to GitHub Issues) |

The playground is the landing page — users can start creating drawings immediately without navigating away from the root URL. The old `/playground/` URL redirects to `/`.

### Playground

The playground is a multi-page experience for creating, browsing, and editing drawings:

| Route | Page | Description |
|-------|------|-------------|
| `/` | `PlaygroundListPage` | Drawing list (landing page, grid/list view toggle) |
| `/playground/{drawingId}/` | `PlaygroundDetailPage` | Preview + metadata + edit button |
| `/playground/{drawingId}/edit` | `PlaygroundEditPage` | Full-screen Excalidraw editor |

**Storage**: Drawings are stored in IndexedDB via `PlaygroundStore` (`src/hosts/playground-store.ts`). Each drawing is a `StoredDrawing` with `id`, `title`, and `envelope` (a `DrawingEnvelope`). Legacy localStorage data is auto-migrated on first access.

**Client-side rendering**: Since drawings live in IndexedDB (not the server), the Go server renders page skeletons using goapplib's `EntityListingData` and `EntityListing.html` templates. Client JS populates the grid/table from IndexedDB on `DOMContentLoaded`.

**JSX without React**: The listing and detail pages use `jsx-dom` — a lightweight JSX-to-DOM library that compiles TSX to real DOM elements without React overhead. Only the Excalidraw editor page uses React.

**Self-contained site/**: The `site/` directory has its own `package.json`, `tsconfig.json`, and `webpack.config.js`. Playground page source lives in `site/pages/` and imports shared core code via the `@excaliframe/*` path alias (mapped to `../src/*`). This means `site/` can eventually move to its own repo — only the alias config changes, no source code changes.

**Bundler**: `site/rspack.config.js` (default) or `site/webpack.config.js` (fallback) produces three bundles:
- `playground-listing` → `site/static/playground/listing/bundle.[hash].js` (small, jsx-dom)
- `playground-detail` → `site/static/playground/detail/bundle.[hash].js` (small, jsx-dom)
- `playground-editor` → `site/static/playground/editor/bundle.[hash].js` (dispatcher + async chunks)

**Cache busting**: Production builds use content-hash filenames (`bundle.[contenthash:8].js`). Each bundle directory gets a `manifest.json` mapping logical names to hashed filenames. The Go server reads manifests at startup via `LoadManifests()` and registers a `bundleJS` template function. Templates use `{{bundleJS "editor"}}` to emit the correct hashed URL. Dev mode uses plain `bundle.js` (no hashing).

The editor bundle uses an **editor dispatcher** pattern: the entry point reads `envelope.tool` from IndexedDB, then dynamically imports the matching editor (Excalidraw or Mermaid) as a webpack async chunk. This means Mermaid users never download Excalidraw (~400KB), and vice versa. `splitChunks: { chunks: 'async' }` enables automatic code splitting. The same pattern is used by the Forge editor entry point (reads `moduleKey` from `view.getContext()` instead of IndexedDB).

Mermaid CSS (`src/core/mermaid.css`) is shared between Forge and playground builds — the playground boot file imports via `@excaliframe/core/mermaid.css`.

Module resolution uses `resolve.modules` to pin all packages to `site/node_modules/`, preventing dual-instance issues when `../src/` files import React or Excalidraw.

**Tool selection**: New drawings show a tool selection modal with Excalidraw and Mermaid options. The tool ID is stored in `DrawingEnvelope.tool`.

**Editor UI modes**: The `EditorChrome` wrapper component (`src/core/EditorChrome.tsx`) owns all "chrome" concerns — collab hooks, auto-save, keyboard shortcuts, dirty badges, and layout. It accepts a `showCancel` prop to select the layout branch:

- **Forge mode** (`showCancel=true`): A top toolbar with Save/Cancel buttons, inline dirty indicator, and CollabBadge. Uses inline styles (no Tailwind in Forge host).
- **Web/playground mode** (`showCancel=false`): No toolbar. Instead uses two floating components:
  - `FloatingToolbar` (`src/core/FloatingToolbar.tsx`) — a gear-icon button that expands into a vertical menu with Save, Share/Collab (inline SharePanel with back-arrow navigation), and Auto-save toggle. Click-outside dismisses the panel. A small indigo dot on the gear icon indicates an active collab connection. The `toolbarPosition` prop controls placement (`bottom-right` by default, also `bottom-left`, `top-right`, `top-left`). Panel direction adapts: menu renders above the button for bottom positions, below for top positions.
  - `SaveToast` (`src/core/SaveToast.tsx`) — an auto-dismissing color-coded pill showing save status: green "Saved" (auto-hides after 2s), blue "Saving...", amber "Auto-saving...", or red "Unsaved changes". Positioned on the opposite horizontal side from the toolbar (e.g., toolbar bottom-right puts toast bottom-left).

Editors (`ExcalidrawEditor`, `MermaidEditor`) are pure content components that expose an `EditorHandle` imperative interface (`save()`, `canClose()`) via `forwardRef` and communicate state changes via `EditorStateCallbacks` props.

**Editable drawing title**: In the playground editor, users can click the drawing title in the site header (after "Excaliframe /") to rename it inline. The title persists immediately to IndexedDB via `WebEditorHost.setTitle()`, independently of the drawing save cycle.

Architecture decisions for the title feature:
- `DrawingTitle` component (`src/core/DrawingTitle.tsx`) is standalone and reusable — takes `initialTitle` + `onRename` callback, has no knowledge of hosts or editors
- Title rendering happens at the page layer (`site/pages/editor/index.tsx`), NOT inside the editor component — this keeps it tool-agnostic so any editor type reuses it
- `PlaygroundEditPage.html` injects a `#drawing-title-slot` into the site header's logo area via inline script
- Title is rendered into the slot via a separate React root (portal pattern), positioned after "Excaliframe /" on the left side of the header bar
- `getTitle()` / `setTitle()` are optional on `EditorHost` — only `WebEditorHost` implements them (Forge drawings get their name from the Confluence page)

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

## Real-Time Collaboration (Relay)

Excaliframe supports optional real-time collaboration via an external relay server. The relay is a **stateless message router** — it can be hosted anywhere (excaliframe.com, user's server, localhost). This preserves the zero-backend philosophy: the relay holds no persistent state.

### Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   Browser Tab A     │     │   Browser Tab B      │
│                     │     │                      │
│ CollabClient ←──────┼─WS──┼──→ CollabClient      │
│ useCollaboration()  │     │  useCollaboration()  │
│ CollabPanel/Badge   │     │  CollabPanel/Badge   │
└─────────────────────┘     └──────────────────────┘
          │                           │
          └────────┐    ┌─────────────┘
                   ▼    ▼
          ┌─────────────────────┐
          │    Relay Server     │
          │  (Go + servicekit)  │
          │                     │
          │  Room → FanOut      │
          │  WS bidi streaming  │
          │  Connect-RPC unary  │
          └─────────────────────┘
```

### Components

| Layer | Component | Location | Description |
|-------|-----------|----------|-------------|
| **Proto** | Message types | `@panyam/massrelay` (`massrelay/protos/`) | CollabAction (client→server), CollabEvent (server→client), oneof discriminated unions |
| **Relay** | CollabService | `massrelay/services/` | Room management, action dispatch, peer lifecycle |
| **Relay** | WebSocket API | `massrelay/web/server/` | servicekit `grpcws.BidiStreamHandler` for WS bidi, Connect-RPC for unary |
| **Client** | CollabClient | `@panyam/massrelay/client` | Framework-agnostic WebSocket client (vanilla TS, no React) |
| **Client** | SyncAdapter | `@panyam/massrelay/sync` | Tool-agnostic sync interface (vanilla TS) |
| **Client** | url-params | `@panyam/massrelay/url` | `parseConnectParam` / `buildConnectUrl` / `resolveRelayUrl` |
| **Client** | useCollaboration | `src/collab/useCollaboration.ts` | React hook wrapping CollabClient for state management |
| **Client** | SharePanel/Badge | `src/collab/SharePanel.tsx`, `CollabBadge.tsx` | Opt-in dialog UI with relay server list and peer status icon |
| **Client** | peerColors | `src/collab/peerColors.ts` | 8-color palette for peer identification (cursors, dots) |

### Massrelay (External Library)

The relay server and generic TS client code live in the standalone [`massrelay`](https://github.com/panyam/massrelay) library (`github.com/panyam/massrelay`). Massrelay is tool-agnostic — it has zero Excalidraw/Mermaid-specific logic. All domain knowledge lives in excaliframe's `SyncAdapter` implementations.

- **Go module**: `github.com/panyam/massrelay` — relay server, proto definitions, generated Go/TS stubs
- **npm package**: `@panyam/massrelay` — CollabClient, SyncAdapter interface, url-params, proto types
- **Local dev**: `~/newstack/massrelay`, with `replace` directive in `site/go.mod`

### Embedded Relay

The site server embeds the relay at `/relay/` — single server for dev and testing:

```go
// site/main.go
import relayserver "github.com/panyam/massrelay/web/server"
relayApp := relayserver.NewRelayApp()
relayApp.Init()
mux.Handle("/relay/", http.StripPrefix("/relay", relayApp))
```

WebSocket endpoint: `/relay/ws/v1/{session_id}/sync`

### Protocol

Messages use protobuf definitions with JSON-over-WebSocket transport (servicekit envelope: `{type: "data", data: <payload>}`).

- **CollabAction** (client→server): oneof `JoinRoom`, `LeaveRoom`, `PresenceUpdate`, `SceneUpdate`, `CursorUpdate`, `TextUpdate`, `CredentialsChanged`
- **CollabEvent** (server→client): oneof `RoomJoined`, `PeerJoined`, `PeerLeft`, `PresenceUpdate`, `SceneUpdate`, `CursorUpdate`, `TextUpdate`, `SceneInit`, `ErrorEvent`, `CredentialsChanged`

`JoinRoom` includes `protocol_version` (v2 for E2EE-capable clients) and `encrypted` flag. `RoomJoined` returns `max_peers`, `encrypted`, and `protocol_version`.

Generated code: Go in `massrelay/gen/go/`, TypeScript in `@panyam/massrelay` npm package.

### Programmatic Control

The relay isn't limited to browser-to-browser collaboration. Any client that speaks the CollabAction/CollabEvent protocol can join a session — CLI tools, coding agents, test harnesses, or backend services. This enables **programmatic control** of live drawings:

- A CLI tool can push elements (rectangles, arrows, text) into a browser session via `SceneUpdate`
- A coding agent can generate a diagram and inject it into a running editor
- An automated pipeline can update a Mermaid diagram's text via `TextUpdate`

The `client_type` field in `JoinRoom` distinguishes client kinds (`"browser"`, `"cli"`, `"api"`), allowing the UI to display programmatic peers differently. The `CollabClient` class is framework-agnostic (no React dependency), making it straightforward to use from Node.js, Deno, or any JavaScript runtime.

### Editor Integration

Connection is **opt-in**. Editors accept an optional `collabConfig` prop (`CollabConfig: {drawingId, initialRelayUrl?, relayServers?}`):

- **CollabBadge**: Always visible — people icon when disconnected, `N` + icon when connected
- **CollabPanel**: Dialog with predefined relay server list (radio buttons), username field, session ID (= drawing ID)
- **`?connect=<relay-url>`**: Query param auto-opens the dialog (debugging shortcut, does not auto-connect)
- **Session ID**: Defaults to drawing ID — everyone editing the same drawing shares a room
- **localStorage**: Persists username and custom relay URLs across sessions

### Cursor Tracking

Cursor tracking uses Excalidraw's native collaborator rendering. No custom UI is needed — Excalidraw renders colored cursors with labels natively via `updateScene({ collaborators })`.

**Flow:**
1. `onPointerUpdate` prop on `<Excalidraw>` fires on every pointer move → `{pointer: {x, y, tool}, button}`
2. `ExcalidrawSyncAdapter.setLocalPointer()` stores the position
3. `useSync.notifyCursorMove()` throttles at 50ms, calls `getCursorData()` → sends `CursorUpdate` proto
4. Remote peer receives `CursorUpdate` → `applyRemoteCursor()` builds `Collaborator` object with color/label → `updateScene({ collaborators })`
5. On peer disconnect: `removePeerCursor()` cleans up

**Peer identification** is session-local (not global): each peer gets a color from a fixed 8-color palette based on join order (mod 8) and a label like "User 1", "User 2". The `peerColors.ts` module provides `getPeerColor(index)` and `getPeerLabel(index)`.

**SharePanel** shows colored dots next to peer names using the same palette.

**Mermaid cursor tracking** uses a different approach since there's no native collaborator rendering:

1. `MermaidSyncAdapter` stores `localSelection` (textarea selectionStart/End), packs it as `CursorData { x: start, y: end, tool: "text" }`
2. Remote cursors are converted from char offset to line number via `charOffsetToLine()` and rendered as colored pills at the bottom of the code pane (e.g., "User 1 · line 3")
3. Inline cursor carets are overlaid on the textarea using a `pointer-events-none` positioned div with colored blinking carets and name flags
4. Same `peerColors` palette and `ensurePeerIndex()` pattern as Excalidraw — stable color per clientId
5. The `onCursorsChange` callback triggers React re-render via `cursorVersion` state counter

### End-to-End Encryption (E2EE)

Optional password-based encryption protects content from relay operator snooping and MITM attacks.

**Key derivation:** Owner enters a session password → PBKDF2 derives AES-256-GCM key using sessionId as salt (100k iterations, SHA-256). Key cached in memory.

**Encrypted fields:** `SceneUpdate.elements[].data`, `TextUpdate.text`, `SceneInitResponse.payload` — content payloads only. Cursors and metadata remain unencrypted.

**Wire format:** `base64(IV_12bytes || ciphertext || authTag_16bytes)` — same field names, opaque base64 values.

**Password distribution:** Shared out-of-band (not in the join code). JoinPage prompts for password when room is encrypted.

**Implementation:** `src/collab/crypto.ts` (pure Web Crypto API), `useSync.ts` (encrypt outgoing, decrypt incoming), `SharePanel.tsx` (password field with auto-generate), `EditorChrome.tsx` (key derivation lifecycle).

### Relay-Side Protections

The relay enforces server-side limits: max 10 peers/room (ROOM_FULL ErrorEvent), global connection rate (100/s), per-IP rate (5/s), per-client message rate (30/s), 1MB max message size. Protocol version negotiation ensures old clients can't join encrypted rooms.

### Implementation Status

- **Part 1** (connection infrastructure): Complete — relay embedded in site server, opt-in UI
- **Part 2** (element sync + text): Complete — ExcalidrawSyncAdapter, MermaidSyncAdapter, useSync hook, scene init, debounced outgoing
- **Part 3** (share UX): Complete — SharePanel, owner lifecycle, join codes, auto-connect, browserId
- **Part 4** (cursor tracking): Complete — Excalidraw native collaborator rendering, Mermaid pill+caret overlay, peer colors, throttled broadcasts
- **Part 5** (security hardening): Complete — participant limits, rate limiting, E2EE, protocol versioning, adapter robustness, 200 TS + ~40 Go tests passing
- **Stability fixes**: Zombie client cleanup (server-side `watchClose` goroutine), CollabClient disconnect lifecycle fix, cross-tab session reuse via localStorage, cache-busted bundle URLs (content-hash filenames + manifest.json)

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

New libraries add core components under `src/core/` and are wired through the same host adapter interface. The `DrawingEnvelope.tool` field identifies which library created the data:

```
src/
├── core/
│   ├── types.ts                    # DrawingEnvelope, EditorHost, RendererHost
│   ├── DrawingTitle.tsx            # Inline-editable title (shared across all tools)
│   ├── EditorHandle.ts             # EditorHandle + EditorStateCallbacks interfaces
│   ├── EditorChrome.tsx            # Chrome wrapper (collab, autosave, shortcuts, layout)
│   ├── FloatingToolbar.tsx         # Gear-icon expandable menu (web/playground)
│   ├── SaveToast.tsx               # Auto-dismissing save-status pill (web/playground)
│   ├── ExcalidrawEditor.tsx        # Excalidraw editor (forwardRef, pure content)
│   ├── ExcalidrawRenderer.tsx      # Excalidraw-specific renderer
│   ├── MermaidEditor.tsx           # Mermaid split-pane editor (forwardRef, pure content)
│   └── MermaidRenderer.tsx         # Mermaid renderer (future — Forge macro)
├── hosts/
│   ├── forge.ts                    # Forge adapter (shared by all tools)
│   └── web.ts                      # Web adapter (shared by all tools)
├── editor/
│   └── index.tsx                   # Forge entry — routes by macro key
└── renderer/
    └── index.tsx                   # Forge entry — routes by macro key
```

Host adapters are shared across all diagram types — they store/retrieve `DrawingEnvelope` without caring about the tool-specific `data` payload.

### What Stays the Same

- Bundler config: still two entry points (editor, renderer) for Forge (rspack.config.js + webpack.config.js)
- Forge resources: still `static/editor/` and `static/renderer/`
- Sync tool: picks up new source files automatically (entire `src/` is synced)
- No new enterprise-side config changes needed for additional libraries
- Host adapters are reused across all diagram types

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
│   │   ├── core/
│   │   ├── hosts/
│   │   ├── editor/
│   │   └── renderer/
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

Only `src/` and `scripts/` are synced. Generated files (`src/version.ts`) are excluded via ignorelist. The `site/` and `tools/` directories are not synced — they are specific to the open-source repo.
