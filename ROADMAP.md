# Roadmap

Long-term vision and milestones for Excaliframe.

---

## Vision

Make Excaliframe the go-to lightweight diagramming tool inside Confluence — fast, secure, and extensible. Fill the gap between heavyweight formal diagramming tools and ad-hoc whiteboarding, with zero data leaving Confluence.

---

## Phase 1: Public Launch (Current)

**Goal:** Get Excaliframe listed on the Atlassian Marketplace and establish CI/security baseline.

| Milestone | Status |
|-----------|--------|
| Core editor + renderer on Forge | Done |
| Enterprise documentation (FAQ, security roadmap, justification) | Done |
| Enterprise sync tooling | Done |
| Marketing site live | Done |
| Update ARCHITECTURE.md for Forge | Done |
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
| Mermaid editor integration | Planned |
| Plugin architecture for new diagram types | Planned |
| Shared component library across editors | Planned |

Architecture already supports this via namespaced `src/<editor>/` directories — see ARCHITECTURE.md.

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
- **Store data outside Confluence** — all diagram data stays in Confluence macro bodies
- **Backend processing** — all drawing operations are client-side; server remains stateless
- **Per-user licensing** — Excaliframe is free and open-source (MIT)
