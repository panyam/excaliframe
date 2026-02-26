# Next Steps

Immediate and near-term action items for Excaliframe.

---

## In Progress

_(nothing currently in progress)_

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

## Backlog

- **Security whitepaper** — formal architecture and trust model document
- **Self-audit guide** — step-by-step for enterprise security teams
- **Verification scripts** — automated code/dependency verification tooling
- **Changelog with security notes** — flag security-relevant changes in releases
- **Atlassian Cloud Fortified** — Atlassian's enterprise security certification
- **Add Mermaid editor** — second diagram type using existing extensible architecture
- **Formal vulnerability disclosure process** — security contact + CVE handling

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
