# Architecture

## Overview

Excaliframe is a Confluence Cloud Connect app that embeds drawing editors (starting with Excalidraw) into Confluence pages. The architecture is designed for:

- **Minimal attack surface**: Go backend with zero runtime dependencies
- **Extensibility**: Namespaced structure allows adding new editors (e.g., Mermaid) without conflicts
- **Cost efficiency**: Static assets served by CDN/GAE, Go server only handles dynamic routes

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Confluence Cloud                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Confluence Page                          │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │              Excalidraw Macro (iframe)               │  │ │
│  │  │         Loads /excalidraw/editor or /renderer        │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Excaliframe Server                            │
│                                                                  │
│  Static (GAE/CDN)           │    Dynamic (Go Server)            │
│  ─────────────────          │    ───────────────────            │
│  /static/excalidraw/*.js    │    /confluence/atlassian-connect  │
│  /images/*                  │    /confluence/lifecycle/*        │
│                             │    /excalidraw/editor             │
│                             │    /excalidraw/renderer           │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
excaliframe/
├── main.go                     # Server entry point
├── server/                     # Go handler packages
│   ├── confluence/             # /confluence/* routes
│   ├── excalidraw/             # /excalidraw/* routes
│   └── middleware/             # HTTP middleware
├── src/                        # Frontend source (TypeScript/React)
│   ├── editor/                 # Excalidraw editor
│   └── renderer/               # Excalidraw renderer
└── dist/                       # Build output
    ├── excalidraw/             # HTML pages (served by Go)
    ├── static/excalidraw/      # JS bundles (served by GAE/CDN)
    └── images/                 # Static images
```

## Adding New Editors

The architecture supports adding new diagram types (e.g., Mermaid):

1. **Frontend**: Create `src/mermaid/` with editor and renderer
2. **Backend**: Create `server/mermaid/handlers.go` returning an `http.Handler`
3. **Build**: Webpack outputs to `dist/mermaid/` and `dist/static/mermaid/`
4. **Routes**: Mount handler in `main.go` at `/mermaid/`

Example structure after adding Mermaid:
```
dist/
├── excalidraw/
│   ├── editor.html
│   └── renderer.html
├── mermaid/
│   ├── editor.html
│   └── renderer.html
├── static/
│   ├── excalidraw/*.js
│   └── mermaid/*.js
└── images/
```

## Data Flow

1. **Insert**: User types `/Excalidraw` in Confluence editor
2. **Edit**: Confluence opens `editor.html` in fullscreen dialog (iframe)
3. **Draw**: User creates drawing (Excalidraw runs client-side)
4. **Save**: Drawing JSON + PNG preview saved to macro body via `AP.confluence.saveMacro()`
5. **View**: Page load renders `renderer.html` showing PNG preview
6. **Re-edit**: Clicking edit loads JSON back into Excalidraw

## Security Model

- **Stateless server**: No user data stored on server
- **Data in Confluence**: All drawings stored in Confluence's content storage
- **No external calls**: Excalidraw bundled; no runtime external dependencies
- **JWT authentication**: Confluence Connect handles auth via JWT

See [SECURITY_ROADMAP.md](./SECURITY_ROADMAP.md) for enterprise compliance path.

## Deployment

### Google App Engine (Recommended)

- Runtime: `go124`
- Static files served directly by GAE (no instance hours)
- Auto-scales to zero when idle (free tier friendly)

### Docker

Multi-stage build produces ~15MB image:
1. Node.js stage: builds frontend
2. Go stage: builds server binary
3. Alpine stage: final minimal image

### Self-hosted

Single binary + `dist/` folder. No runtime dependencies.
