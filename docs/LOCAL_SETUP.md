# Local Development Setup

This guide walks through setting up excaliframe for local development. The project has three main components:

1. **Forge Plugin** — Confluence macro (editor + renderer)
2. **Site / Playground** — Marketing site + browser-based playground (Go + webpack)
3. **Relay Server** — Real-time collaboration WebSocket server (Go)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Forge plugin, playground bundles |
| Go | 1.24+ | Site server, relay server |
| npm | 9+ | Package management |
| [buf CLI](https://buf.build/docs/installation) | Latest | Protobuf code generation (collab only) |
| [Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/) | Latest | Confluence plugin (optional) |

---

## 1. Initial Setup

```bash
git clone https://github.com/yourusername/excaliframe.git
cd excaliframe

# Install root deps (Forge plugin + shared code)
npm install

# Install site deps (playground bundles)
cd site && npm install && cd ..
```

Or use the Makefile:
```bash
make install
```

---

## 2. Running the Playground Locally

The playground runs at `http://localhost:8080` and uses IndexedDB for storage.

```bash
# Terminal 1: Build playground bundles (watch mode)
cd site && npm run watch

# Terminal 2: Start Go web server
cd site && make run
```

Open http://localhost:8080/playground/ to create and edit drawings.

---

## 3. Running the Relay Server (Collaboration)

The relay server is a stateless WebSocket message router that enables real-time collaboration between browsers and programmatic clients (CLI, agents).

### Standalone mode

```bash
cd relay
go run . --port 8787
```

The server starts on `http://localhost:8787` with these endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/v1/rooms` | List active rooms |
| `GET /api/v1/rooms/{session_id}` | Get room details |
| `WS /ws/v1/{session_id}/sync` | WebSocket bidi stream (main API) |

### Embedded mode

The relay implements `http.Handler` and can be mounted in any Go server:

```go
import relay "github.com/user/excaliframe/relay/web/server"

relayApp := relay.NewRelayApp()
relayApp.Init()

// Mount at a prefix
mux.Handle("/relay/", http.StripPrefix("/relay", relayApp))
```

### Connecting the playground to the relay

Open any editor page with query parameters:

```
http://localhost:8080/playground/{id}/edit?relay=ws://localhost:8787&session=my-session&user=Alice
```

Open the same URL in a second tab with `&user=Bob` — both tabs will see each other as peers.

Without the `?relay` param, the editor works exactly as before (no collab UI).

---

## 4. Running the Forge Plugin

Requires an Atlassian account and Confluence Cloud site.

```bash
# One-time setup
forge login
forge register

# Build and deploy
make deploy

# Install on your Confluence site
make install-app

# For live development (rebuilds on changes + tunnels to Confluence)
# Terminal 1:
make dev
# Terminal 2:
make tunnel
```

---

## 5. Proto Generation (Collaboration)

Proto definitions live in `relay/protos/`. Generated code goes to:
- Go: `relay/gen/go/`
- TypeScript: `src/collab/gen/`

```bash
# One-time: set up buf for local dev
cd relay/protos && make setupdev

# Generate code from protos
make proto    # from project root
# or:
cd relay/protos && make buf
```

You only need to re-run this when `.proto` files change.

---

## 6. Running Tests

```bash
# All tests (TypeScript + Go)
make test

# TypeScript only (vitest)
make test-ts
# or: npm run test

# Go relay only
make test-go
# or: cd relay && go test ./...

# Watch mode (TypeScript)
npm run test:watch

# Type checking
make type-check
```

---

## 7. Building for Production

```bash
# Forge plugin
npm run build

# Site / playground
cd site && npm run build

# Both
make build && cd site && npm run build
```

---

## Project Layout

```
excaliframe/
├── src/
│   ├── core/              # Host-agnostic editors + renderers
│   ├── collab/            # Collaboration client (CollabClient, React hook, UI)
│   │   └── gen/           # Generated TypeScript from protos
│   ├── hosts/             # Platform adapters (Forge, Web/IndexedDB)
│   ├── editor/            # Forge editor entry point
│   └── renderer/          # Forge renderer entry point
├── relay/
│   ├── main.go            # Standalone relay entry point
│   ├── services/          # CollabService, Room management
│   ├── web/server/        # HTTP handlers, WebSocket bidi stream
│   ├── protos/            # Proto definitions + buf config
│   └── gen/go/            # Generated Go from protos
├── site/
│   ├── main.go            # Marketing site + playground server
│   ├── pages/             # Playground page source
│   ├── server/            # Go web server
│   └── templates/         # HTML templates
├── Makefile               # Root build commands
└── package.json           # Root npm scripts
```

---

## Common Workflows

### Adding a new proto message

1. Edit `relay/protos/excaliframe/v1/models/collab.proto`
2. Run `make proto`
3. Use the generated types in both Go (`relay/gen/go/`) and TypeScript (`src/collab/gen/`)

### Testing collaboration locally

1. Start relay: `cd relay && go run . --port 8787`
2. Start playground: `cd site && make run`
3. Open two browser tabs to the same drawing with `?relay=ws://localhost:8787&session=test&user=Alice` and `&user=Bob`

### Programmatic control via relay

Any WebSocket client can connect to the relay and interact with browser sessions. This enables CLI tools and coding agents to push elements into live drawings:

```bash
# Example: connect with wscat
wscat -c ws://localhost:8787/ws/v1/my-session/sync
```

Send a JSON message matching the `CollabAction` proto schema to join and interact.

---

## Troubleshooting

**`buf: command not found`**
```bash
# macOS
brew install bufbuild/buf/buf
# or see https://buf.build/docs/installation
```

**`go: module not found` in relay**
```bash
cd relay && go mod tidy
```

**Playground not picking up changes**
- Make sure `npm run watch` is running in `site/`
- Hard-refresh the browser (Cmd+Shift+R)

**Relay connection refused**
- Verify the relay is running: `curl http://localhost:8787/health`
- Check the URL scheme: use `ws://` for local dev, `wss://` for production
