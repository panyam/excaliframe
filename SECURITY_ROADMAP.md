# Security Roadmap

This document outlines the path to making Excaliframe enterprise-ready from a security and compliance perspective.

---

## Current State

Excaliframe is a **stateless** application that:
- Serves static assets (HTML, JS, CSS) only
- Stores no user data - all diagram data lives in Confluence
- Has a small, auditable codebase (~300 lines of React, ~500 lines of server)
- Uses open-source dependencies (Excalidraw, React, Express)

This architecture simplifies security but requires attention to:
1. **Supply chain security** - npm dependencies
2. **Code integrity** - ensuring deployed code matches source
3. **Trust verification** - enabling enterprises to validate the above

---

## Roadmap

### Phase 1: Foundation (Immediate)

Low effort, high value. Establishes baseline security hygiene.

| Action | Status | Description |
|--------|--------|-------------|
| Automated dependency scanning | [ ] | Add `npm audit` to CI pipeline |
| SAST in CI | [ ] | Add CodeQL or Semgrep via GitHub Actions |
| SBOM generation | [ ] | Generate Software Bill of Materials on each release |
| Reproducible builds | [ ] | Document build verification process |
| Signed releases | [ ] | GPG-sign releases for integrity verification |
| Pin dependency versions | [ ] | Use lockfile, review updates explicitly |

**Deliverables:**
- CI pipeline with security checks
- SBOM published with each release
- Build verification documentation

---

### Phase 2: Validation (Next Quarter)

Medium effort. Enables enterprises to self-verify using their own security processes.

| Action | Status | Description |
|--------|--------|-------------|
| Atlassian Marketplace submission | [ ] | Triggers Atlassian's security review process |
| Security whitepaper | [ ] | Formal documentation of architecture and trust model |
| Self-audit guide | [ ] | Step-by-step guide for enterprise security teams |
| Verification scripts | [ ] | Automated scripts for code/dependency verification |
| Changelog with security notes | [ ] | Flag security-relevant changes in releases |

**Deliverables:**
- Marketplace listing (with Atlassian security approval)
- Published security whitepaper
- Self-service audit documentation and tooling

**Philosophy:** Rather than expensive third-party audits that need repeating each version, we provide tooling and documentation that enables enterprise security teams to verify Excaliframe using their existing processes.

---

### Phase 3: Enterprise Tier (As Needed)

Higher effort. For formal program participation if required.

| Action | Status | Description |
|--------|--------|-------------|
| Atlassian Cloud Fortified | [ ] | Atlassian's higher security tier for Marketplace apps |
| Formal security contact | [ ] | Published security contact for vulnerability reports |
| CVE process | [ ] | Process for handling and disclosing vulnerabilities |

**Note on SOC 2 / ISO 27001:**
These certifications are designed for services that store and process data. Since Excaliframe is stateless and stores no user data, these certifications are **not applicable**. The data security responsibility lies with Confluence/Atlassian (which has these certifications).

**Enterprise Internal Audits:**
Most enterprises have internal security teams that perform their own assessments. Excaliframe's small codebase (~300 lines of React components) makes internal audits straightforward. We provide documentation and tooling to support this - see "Verification Steps for Enterprises" below.

---

## What Certifications Actually Apply?

| Certification | Relevance | Rationale |
|---------------|-----------|-----------|
| **Atlassian Marketplace Review** | High | Validates Connect app security practices |
| **Atlassian Cloud Fortified** | High | Atlassian's enterprise security seal |
| **SBOM + Dependency Scanning** | High | Directly addresses supply chain concerns |
| **Self-service Audit Tooling** | High | Enables enterprise security teams to verify internally |
| SOC 2 Type II | N/A | Designed for data processors; Excaliframe has no data storage |
| ISO 27001 | N/A | Focuses on information security management systems |

---

## Security Controls Checklist

### Code Security
- [ ] No hardcoded secrets in codebase
- [ ] Input validation on all user inputs
- [ ] Output encoding to prevent XSS
- [ ] HTTPS enforced for all endpoints
- [ ] Security headers configured (CSP, HSTS, etc.)

### Dependency Security
- [ ] All dependencies from trusted sources (npm registry)
- [ ] Lockfile committed and used for builds
- [ ] Automated vulnerability scanning in CI
- [ ] Process for reviewing and updating dependencies
- [ ] SBOM generated and published

### Build & Release Security
- [ ] Builds are reproducible
- [ ] Release artifacts are signed
- [ ] Build process documented
- [ ] No secrets in build artifacts

### Operational Security
- [ ] Logging enabled (without sensitive data)
- [ ] Error handling doesn't leak sensitive info
- [ ] Health check endpoint available
- [ ] Incident response process documented

---

## Verification Steps for Enterprises

Organizations evaluating Excaliframe can verify security by:

### 1. Code Audit (Recommended)
```bash
# Clone the repository
git clone https://github.com/[org]/excaliframe

# Review the small codebase
# - src/editor/ExcalidrawEditor.tsx (~200 lines)
# - src/renderer/ExcalidrawRenderer.tsx (~100 lines)
# - server.ts (~500 lines)

# Search for data exfiltration patterns
grep -r "fetch\|XMLHttpRequest\|sendBeacon\|WebSocket" src/
# Should return: only navigator.clipboard usage
```

### 2. Dependency Audit
```bash
# Check for known vulnerabilities
npm audit

# Generate SBOM
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
```

### 3. Network Monitoring
During pilot usage, monitor browser DevTools Network tab:
- Should see: Asset loads from Excaliframe server (HTML, JS, CSS)
- Should see: API calls to Confluence (`AP.*` methods)
- Should NOT see: POST/PUT requests with diagram data to Excaliframe

### 4. Build Verification
```bash
# Build locally
npm run build

# Compare checksums of dist/ files against deployed version
shasum -a 256 dist/*.js
```

---

## References

- [Atlassian Marketplace Security Requirements](https://developer.atlassian.com/platform/marketplace/security-requirements/)
- [Atlassian Cloud Fortified Program](https://developer.atlassian.com/platform/marketplace/cloud-fortified-apps/)
- [CycloneDX SBOM Standard](https://cyclonedx.org/)
- [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/)

---

## Changelog

| Date | Change |
|------|--------|
| 2024-XX-XX | Initial roadmap created |
