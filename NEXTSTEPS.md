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

### Fix False Positive "Unsaved Changes" Indicator
- When loading an existing drawing, "Unsaved changes" appears immediately without user interaction
- Root cause: Excalidraw mutates internal element properties (`version`, `versionNonce`, `updated`, `seed`) when loading elements into the scene
- Attempted fix: fingerprint-based comparison excluding internal keys — partially implemented in `ExcalidrawEditor.tsx` but still triggers false positive
- The `isDeleted` field may also be added by Excalidraw during init, causing fingerprint mismatch
- Next step: debug what specific properties differ between stored and post-init fingerprints

### 4. Forge Mermaid Macro
- Add Mermaid macro key to `manifest.yml`
- Create `MermaidRenderer.tsx` in `src/core/`
- Add macro key dispatcher in `src/editor/index.tsx` and `src/renderer/index.tsx`
- Build and test in Confluence

## Backlog

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
