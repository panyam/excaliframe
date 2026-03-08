# Next Steps

Immediate and near-term action items for Excaliframe.

---

## Up Next

### 1. Set Up GitHub Actions CI Pipeline
- Add `npm audit` for dependency vulnerability scanning
- Add TypeScript type-checking (`npm run type-check`)
- Add build verification (`npm run build`)
- Consider adding CodeQL or Semgrep for SAST
- Generate SBOM on releases (CycloneDX)

### 2. Submit to Atlassian Marketplace
- `forge deploy` deploys the app privately — Marketplace listing is a separate process
- Go through [Atlassian Developer Portal](https://developer.atlassian.com/platform/marketplace/) submission
- Prepare listing assets: description, screenshots, icon, categories
- Triggers Atlassian's security review
- Once published, update marketplace URL in `site/server/app.go:19` (currently a TODO placeholder)

### 3. Security Hardening (Phase 1)
- See `SECURITY_ROADMAP.md` for full checklist
- Pin dependency versions with lockfile review process
- GPG-sign releases
- Document reproducible build process

---

## In Progress

### Real-Time Collaboration — Remaining Work
- Parts 1-5 complete: relay, transport, peer tracking, real-time sync, share UX, cursor tracking, security hardening (200 TS tests passing)
- Relay server and generic TS client extracted to [`massrelay`](https://github.com/panyam/massrelay) — npm: `@panyam/massrelay@0.0.6`
- Excaliframe imports massrelay via npm package; local collab files are thin re-exports
- Mermaid cursor tracking: implemented — pills at bottom of code pane + inline cursor overlay ([#9](https://github.com/panyam/excaliframe/issues/9))
- Security hardening: participant limits (10/room), multi-layer rate limiting, password-based E2EE (AES-256-GCM), protocol versioning
- Cache busting: content-hash filenames + manifest.json per bundle dir + Go `bundleJS` template function
- Zombie client fix: server-side `watchClose()` goroutine cleans up on ungraceful WS disconnect
- CollabClient disconnect lifecycle fix: `onDisconnect` fires synchronously, state reset before `grpc.close()`
- Cross-tab session reuse: owner's second tab finds existing session via localStorage before creating a new one
- Remaining: smart reconnect (currently disabled), binary file sync, `ws://` URL warning, Playwright E2E tests

### Fix False Positive "Unsaved Changes" Indicator
- When loading an existing drawing, "Unsaved changes" appears immediately without user interaction
- Root cause: Excalidraw mutates internal element properties (`version`, `versionNonce`, `updated`, `seed`) when loading elements into the scene
- Attempted fix: fingerprint-based comparison excluding internal keys — partially implemented in `ExcalidrawEditor.tsx` but still triggers false positive
- The `isDeleted` field may also be added by Excalidraw during init, causing fingerprint mismatch
- Next step: debug what specific properties differ between stored and post-init fingerprints

## Backlog

- **DOMPurify hardening for Mermaid SVG preview** — [#2](https://github.com/panyam/excaliframe/issues/2) — add DOMPurify with custom config that allows `<foreignObject>` but strips scripts/event handlers
- **Security whitepaper** — formal architecture and trust model document
- **Self-audit guide** — step-by-step for enterprise security teams
- **Verification scripts** — automated code/dependency verification tooling
- **Changelog with security notes** — flag security-relevant changes in releases
- **Atlassian Cloud Fortified** — Atlassian's enterprise security certification
- **Playground enhancements** — export PNG button, sample drawings gallery, dark mode sync, title editing from list/detail pages
- **Server-backed host adapter** — `src/hosts/server.ts` for multi-user persistence via backend API
- **Formal vulnerability disclosure process** — security contact + CVE handling
- **Wrap jsx-dom in tsappkit** — consider re-exporting from `@panyam/tsappkit` for cross-project reuse

---

## Done

- [x] Core Excalidraw editor and renderer
- [x] Migration from Atlassian Connect to Forge
- [x] Enterprise sync tooling (`tools/sync.py`)
- [x] SEO improvements for marketing site
- [x] Comprehensive documentation (FAQ, NOW.md, SECURITY_ROADMAP.md)
- [x] Marketing site (Go + goapplib, deployed to GAE)
- [x] Forge deploy/install workflow via Makefile
- [x] Update ARCHITECTURE.md for Forge migration (removed stale Connect references)
- [x] Restructure sync to use `excaliframe/` subdirectory in enterprise target
- [x] Add `migrate` command for one-time flat→subdir restructure
- [x] Trim sync allowlist to `src/` and `scripts/` only (enterprise configs no longer overwritten)
- [x] Enterprise PR: GM-SDV/JRA_204485_Forge-Apps#1
- [x] Multi-hostable architecture: extracted core components (`src/core/`) with host adapter interface
- [x] Host adapters: Forge (`src/hosts/forge.ts`) and Web/localStorage (`src/hosts/web.ts`)
- [x] Interactive playground on marketing site (`/playground/` → full Excalidraw editor with localStorage persistence)
- [x] Multi-drawing playground with list/detail/edit pages and IndexedDB storage
- [x] Fix playground data persistence bug (save spinner was blocking subsequent saves)
- [x] Reorganize playground code into `site/` — self-contained `package.json`, `tsconfig.json`, `webpack.config.js` with `@excaliframe/*` path alias
- [x] Add `showCancel` prop to ExcalidrawEditor — web mode uses MainMenu + Cmd/Ctrl+S instead of top toolbar
- [x] Editable drawing title in playground editor — inline-editable in site header, persists to IndexedDB via `WebEditorHost.setTitle()`
- [x] `EditorHost` extended with optional `getTitle()` / `setTitle()` methods
- [x] `DrawingTitle` component in `src/core/DrawingTitle.tsx` — standalone, reusable, host-agnostic
- [x] Title rendered at page layer via portal into `#drawing-title-slot` (not inside ExcalidrawEditor)
- [x] Playground Mermaid editor — split-pane code editor + live SVG preview
- [x] Editor dispatcher with dynamic imports — lazy-loads Excalidraw or Mermaid per drawing
- [x] Tool selection modal — Excalidraw and Mermaid options for new drawings
- [x] SVG preview for Mermaid drawings on listing and detail pages
- [x] Forge Mermaid macro — `mermaid-macro` in manifest, editor dispatcher reads `moduleKey`, async code splitting
- [x] Shared mermaid.css — moved from site-local to `src/core/mermaid.css` for Forge + playground reuse
- [x] ForgeEditorHost/ForgeRendererHost accept `tool` param (default `'excalidraw'` for backward compat)
- [x] Synced to enterprise Forge repo with `mermaid` dependency and webpack code splitting
- [x] Make playground the landing page — drawing list at `/`, marketing page moved to `/about/`, old `/playground/` redirects to `/`
- [x] Listing UX: removed redundant View button, Edit button shows on hover as full-width button
- [x] Privacy policy updated to cover playground IndexedDB storage alongside Confluence
- [x] Fix C4 diagram rendering in Mermaid editor (securityLevel + innerHTML for foreignObject support)
- [x] Fix BorderLayout for editor pages — header (North), main (Center), footer (South) properly fill viewport
- [x] Change all editor `100vh` heights to `100%` so editors respect container bounds, not viewport
- [x] Reduce footer height (py-8 → py-2) for compact editor layout
- [x] Fix C4 Mermaid preview on listing/detail pages — render SVG via innerHTML instead of `<img>` to preserve `<foreignObject>` (web + Forge)
- [x] Rspack migration — parallel rspack configs for root + site, 5-10x faster builds, webpack kept as `-old` fallback targets
- [x] Collab Part 1 — connection infrastructure: Go relay, CollabClient with GRPCWSClient, TDD tests
- [x] Collab Part 1.5 — embed relay in site server (`/relay/`), opt-in collab UI (dialog with relay server list, people icon badge, peer count), `?connect=` param, session ID = drawing ID, localStorage persistence
- [x] Tailwind dark mode for editor chrome — CollabPanel, CollabBadge, AutoSaveToggle, loading spinners, status badges, popover containers all use Tailwind with `dark:` variants
- [x] Collab Part 2 — sync engine: ExcalidrawSyncAdapter, MermaidSyncAdapter, useSync hook, SceneInit, debounced outgoing, element reconciliation
- [x] Collab Part 3 — share-based UX: SharePanel, owner lifecycle, join codes, auto-connect, browserId
- [x] Collab Part 4 — cursor tracking: Excalidraw native collaborator rendering, peer colors (8-color palette), throttled broadcasts (50ms), colored peer dots in SharePanel, room validation
- [x] EditorChrome refactor — extracted all chrome concerns (collab hooks, autosave, keyboard shortcuts, dirty badges, layout branches) into `EditorChrome` wrapper. Editors are now pure `forwardRef` content components with `EditorHandle` imperative interface.
- [x] Floating Toolbar + Save Toast — web/playground layout consolidated: `FloatingToolbar` (gear-icon menu with Save, Share/Collab, Auto-save toggle, click-outside dismiss, inline SharePanel) and `SaveToast` (auto-dismissing color-coded save-status pill). Replaces three scattered fixed-position elements with two composable components. `toolbarPosition` prop on `EditorChrome`. Forge layout unchanged.
- [x] Extract relay into standalone `massrelay` library — Go relay server + vanilla TS client (`CollabClient`, `SyncAdapter`, `url-params`, proto types) at `github.com/panyam/massrelay`, published to npm as `@panyam/massrelay`. Excaliframe collab files become thin re-exports. `relay/` and `src/collab/gen/` deleted.
- [x] Collab Part 5 — relay hardening: participant limits (10/room default, graceful ROOM_FULL ErrorEvent), multi-layer rate limiting (global 100/s, per-IP 5/s, per-client 30msg/s, 1MB max message), protocol versioning (v2), adapter robustness (try/catch on JSON.parse), password-based E2EE (AES-256-GCM, PBKDF2 key derivation, optional per-session password)
- [x] E2EE UX: SharePanel password field with auto-generate, JoinPage password prompt for encrypted rooms, EditorChrome key derivation, useSync encrypt/decrypt layer, CredentialsChanged broadcast
- [x] Security doc (docs/SECURITY.md) updated with E2EE section, rate limiting mitigations, updated threat analysis
