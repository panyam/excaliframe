# Roadmap

Long-term vision and milestones for Excaliframe.

---

## Vision

Make Excaliframe the go-to lightweight diagramming toolkit for Confluence and the web — fast, secure, and extensible. Multiple diagram types (Excalidraw sketches, Mermaid flowcharts, and more) unified under one tool-agnostic architecture, with zero data leaving your control.

---

## Phase 1: Public Launch (Current)

**Goal:** Get Excaliframe listed on the Atlassian Marketplace and establish CI/security baseline.

| Milestone | Status |
|-----------|--------|
| Core editor + renderer on Forge | Done |
| Enterprise documentation (FAQ, security roadmap, justification) | Done |
| Enterprise sync tooling | Done |
| Subdirectory sync (excaliframe/ in enterprise target) | Done |
| Marketing site live | Done |
| Update ARCHITECTURE.md for Forge | Done |
| Multi-hostable architecture (core/hosts split) | Done |
| Interactive playground on marketing site | Done |
| Multi-drawing playground (list/detail/edit + IndexedDB) | Done |
| Editable drawing title in playground editor | Done |
| Playground as landing page (drawing list at `/`) | Done |
| Rspack migration (5-10x faster builds, webpack fallback) | Done |
| GitHub Actions CI (build, lint, audit) | TODO |
| Atlassian Marketplace submission | TODO |
| SBOM generation on releases | TODO |

---

## Phase 2: Enterprise Trust

**Goal:** Enable enterprises to self-verify and trust Excaliframe through tooling and documentation.

| Milestone | Status |
|-----------|--------|
| Security whitepaper | TODO |
| Self-audit guide for security teams | TODO |
| Verification scripts (code + dependency checks) | TODO |
| Signed releases (GPG) | TODO |
| Reproducible build documentation | TODO |
| Changelog with security annotations | TODO |

---

## Phase 3: Extensibility

**Goal:** Support multiple diagram types beyond Excalidraw.

| Milestone | Status |
|-----------|--------|
| Tool-agnostic DrawingEnvelope (host stores opaque payloads) | Done |
| Host adapter interface (EditorHost, RendererHost) | Done |
| Forge host adapter | Done |
| Web/localStorage host adapter | Done |
| Server-backed host adapter (API persistence) | Planned |
| Playground Mermaid editor | Done |
| Forge Mermaid macro | Done |
| Macro key dispatcher in editor/renderer entry points | Done |
| Lazy-loaded library bundles (dynamic import per diagram type) | Done |
| Playground tool chooser (tool selection modal) | Done |

Architecture uses `DrawingEnvelope.tool` field to identify diagram type. Host adapters are shared across all tools — they store/retrieve envelopes without knowing tool-specific data formats. See ARCHITECTURE.md "Adding New Diagram Libraries".

---

## Phase 3.5: Real-Time Collaboration

**Goal:** Enable live multi-user editing and programmatic control of drawings via an external relay server.

| Milestone | Status |
|-----------|--------|
| Proto definitions (CollabAction/CollabEvent, buf code gen) | Done |
| Relay server (Go + servicekit, WebSocket bidi, rooms) | In Progress |
| Browser client (CollabClient, framework-agnostic) | In Progress |
| React hooks + UI (useCollaboration, CollabPanel, CollabBadge) | In Progress |
| Test suite (TDD — 63 TS + ~30 Go tests) | Done |
| `make test` unified test runner | Done |
| Editor integration (optional `collab` prop, URL params) | Done |
| Element sync (Excalidraw scene diffing/merging) | Done |
| Cursor broadcasting (Excalidraw collaborators) | Done |
| Cursor tracking — Mermaid (text selection cursors) | Planned — [#9](https://github.com/panyam/excaliframe/issues/9) |
| Text sync (Mermaid LWW) | Done |
| Peer colors and labels (session-local, 8-color palette) | Done |
| Programmatic control (CLI/agent → live drawing via relay) | Planned |

The relay is stateless — no database, no persistent storage. It routes messages between peers in real-time. Any client (browser, CLI, agent) that speaks the protocol can join sessions.

---

## Phase 4: Enterprise Certification

**Goal:** Achieve Atlassian's highest trust tier for marketplace apps.

| Milestone | Status |
|-----------|--------|
| Atlassian Cloud Fortified certification | Planned |
| Formal security contact and CVE process | Planned |
| Published vulnerability disclosure policy | Planned |

---

## Non-Goals

- **Replace Lucidchart/draw.io** — Excaliframe targets quick-sketch use cases, not formal diagrams
- **Store data outside Confluence** — all diagram data stays in Confluence macro bodies (relay is transient, not persistent)
- **Heavy backend processing** — drawing operations are client-side; the relay server is a stateless message router only
- **Per-user licensing** — Excaliframe is free and open-source (MIT)
