# Excaliframe Integration Justification

## Exec Summary

Excaliframe is a Confluence Cloud integration that embeds Excalidraw - an open-source whiteboarding and diagramming tool - directly into Confluence pages as a native macro. This integration enables teams to create, edit, and share technical diagrams, flowcharts, wireframes, and visual documentation without leaving Confluence. All data remains stored within Confluence infrastructure, requiring no external data storage or third-party services.

---

## Why Excaliframe? (Why Not Use Excalidraw Directly?)

Excalidraw is a standalone web application at excalidraw.com. While powerful, it cannot integrate directly into Confluence for several reasons:

| Challenge | Why Excaliframe Solves It |
|-----------|---------------------------|
| **No native Confluence integration** | Excalidraw.com is a separate website - diagrams must be exported as images and manually uploaded to Confluence | Excaliframe embeds Excalidraw as a native Confluence macro with direct save/load |
| **Forge integration requirement** | Atlassian requires apps to register via the Forge platform with a manifest and Custom UI resources | Excaliframe provides the Forge app manifest and UI bundles |
| **Data storage** | Excalidraw.com stores diagrams in browser localStorage or requires manual file management | Excaliframe stores diagrams directly in Confluence page content |
| **Seamless editing** | Using Excalidraw.com requires export → upload → replace workflow for every edit | Excaliframe enables click-to-edit within Confluence |
| **Permissions** | Excalidraw.com has no concept of Confluence page permissions | Excaliframe inherits Confluence's permission model |

**In short**: Excaliframe is the "glue" that makes Excalidraw work natively within Confluence. It runs as a Forge app — Atlassian hosts the static assets, no separate server required.

---

## Business Justification

### Cost Analysis

| Factor | Detail |
|--------|--------|
| **Licensing Cost** | $0 - Excalidraw is open-source |
| **Infrastructure Cost** | $0 - hosted on Atlassian's Forge platform, no separate server |
| **Training Cost** | Low - Excalidraw's interface is intuitive; most users self-serve |
| **Maintenance Cost** | Low - simple architecture, infrequent updates needed |
| **Opportunity Cost of Not Adding** | Engineers continue manual export/paste workflow, losing source files and version history |

**Note**: Excaliframe is additive - it does not replace existing Lucidchart investment. It serves a different use case (quick iteration) at near-zero incremental cost.

### Efficiency Gains

| Metric | Improvement |
|--------|-------------|
| **Reduced Cognitive Overhead** | No pressure to make diagrams "pretty" - engineers focus on content, not formatting |
| **Faster First Draft** | Hand-drawn aesthetic means "done" comes faster - no alignment tweaking, color matching, or perfectionism |
| **More Diagrams Created** | Lower barrier = more documentation; ideas that wouldn't warrant a "formal diagram" get captured |
| **Documentation Freshness** | Quick edits feel lightweight - diagrams stay current instead of rotting |
| **Legitimized Workflow** | Engineers already using Excalidraw manually now have native integration with version history |

### Qualitative Benefits

- **Data Sovereignty**: All drawing data remains within Confluence - no external data transfers
- **Simplified Compliance**: No additional vendor security reviews for diagram storage
- **Speed-First Design**: Excalidraw is built for rapid ideation - simple primitives, keyboard shortcuts, and minimal UI
- **Hand-Drawn Aesthetic**: The "sketchy" look signals "this is a working document" - encourages iteration and feedback
- **Open Format**: Native Excalidraw JSON is portable - diagrams can be edited in VS Code, excalidraw.com, or other tools
- **Zero Learning Curve**: Intuitive interface - most users productive within minutes

---

## Problem Statement & Challenges

### Current Challenges

1. **Quick Iteration Needs a Lightweight Option**
   - Many engineering diagrams are working documents - architecture sketches, design discussions, debug notes
   - These don't need polish; they need speed and easy updates
   - Full-featured diagramming tools can feel heavyweight for "I just need a quick box-and-arrow diagram"
   - The overhead discourages creating diagrams at all for smaller concepts

2. **Engineers Already Using Excalidraw - Manually**
   - Power users have discovered Excalidraw and prefer its speed for quick iteration
   - They willingly accept the manual export → paste workflow to get the tool they want
   - This signals real demand - users are choosing Excalidraw despite the friction
   - Without native integration, diagram source files are lost or stored inconsistently

3. **Gap in the Tooling Spectrum**
   - Lucidchart serves formal, polished diagram needs well
   - But there's no native option for quick, sketch-style diagrams in Confluence
   - Engineers fill this gap with manual workarounds (Excalidraw.com, whiteboard photos, hand-drawn scans)

4. **Lost Source Files**
   - When engineers use Excalidraw manually, source files end up in browser localStorage or random folders
   - Updating a diagram means finding the source, hoping it wasn't cleared, re-exporting
   - Native integration would preserve editability within Confluence

### Future Challenges Addressed

1. **Scaling Documentation Practices**
   - As teams grow, consistent tooling becomes critical
   - Native integration scales with Confluence adoption

2. **Remote/Distributed Teams**
   - Diagrams accessible to all team members via Confluence
   - Asynchronous editing with version history through Confluence

3. **Knowledge Retention**
   - Diagrams tied to documentation context
   - Easier handoffs when team members transition

---

## Options Forward

### Option 1: Add Excaliframe (Recommended)

**Approach**: Deploy Excaliframe on company infrastructure as a Confluence Cloud app alongside existing tools.

| Pros | Cons |
|------|------|
| Zero additional licensing cost (open-source) | Requires initial setup and configuration |
| Data stays within Confluence | May require IT/Security review for new app |
| Self-hosted = full control over availability | Requires hosting infrastructure (minimal) |
| Native macro experience | |
| Fills gap for quick iteration use cases | |
| Supports users already using Excalidraw manually | |

**Impact**: High value, low cost, complements existing tooling.

**Hosting Note**: Excaliframe runs as a Forge app — Atlassian hosts the static assets on their infrastructure. No separate server deployment or maintenance required.

**Note**: This is additive - Excaliframe complements Lucidchart rather than replacing it. Users choose the right tool for each situation.

### Option 2: Status Quo (Lucidchart Only)

**Approach**: Continue with existing Lucidchart integration.

| Pros | Cons |
|------|------|
| No change management required | Engineers using Excalidraw manually lose source files |
| Teams already trained on Lucidchart | No native option for quick-sketch use cases |
| Vendor support included | Users who prefer Excalidraw continue workaround workflow |

**Impact**: Existing workflow continues; manual Excalidraw users remain unsupported.

### Option 3: Atlassian Native (Whiteboards)

**Approach**: Use Confluence Whiteboards for quick diagrams.

| Pros | Cons |
|------|------|
| Native Atlassian product | Different feature set than Excalidraw |
| No additional integration | Users familiar with Excalidraw would need to adapt |
| Included in Confluence license | Feature set controlled by Atlassian roadmap |

**Impact**: May serve some quick-diagram use cases; doesn't support existing Excalidraw users.

---

## Success Criteria

### Adoption Metrics
- [ ] 50% of new technical documentation pages include Excalidraw diagrams within 3 months of rollout
- [ ] Reduction in external diagramming tool usage by 30% within 6 months
- [ ] Zero data security incidents related to diagram storage

### Quality Metrics
- [ ] Diagram update frequency increases (measured via page edit history)
- [ ] Reduction in "stale diagram" feedback in documentation reviews
- [ ] User satisfaction score of 4+ out of 5 in post-rollout survey

### Operational Metrics
- [ ] Integration uptime of 99.5% or higher
- [ ] Average diagram load time under 3 seconds
- [ ] Support ticket volume for diagramming issues decreases

### Cost Metrics
- [ ] No increase in per-user tooling costs for diagramming
- [ ] Reduction in external tool licenses (quantify after baseline)

---

## How We Will Test

### Phase 1: Technical Validation
| Test | Method | Success Criteria |
|------|--------|------------------|
| Installation | Deploy to Confluence sandbox | App installs without errors |
| Basic Functionality | Create, edit, save diagram | Diagram persists across page reloads |
| Data Integrity | Export/import Excalidraw files | Full fidelity preservation |
| Performance | Load complex diagrams (100+ elements) | Renders in under 3 seconds |
| Security | Review data flow, storage location | All data confirmed in Confluence only |

### Phase 2: User Acceptance Testing (UAT)
| Test | Method | Success Criteria |
|------|--------|------------------|
| Usability | 5-10 pilot users create real diagrams | Task completion without assistance |
| Sequential Editing | Multiple users edit diagram (one at a time) | No data loss, changes persist correctly |
| Integration | Embed in existing documentation | Seamless experience with page content |
| Edge Cases | Large diagrams, embedded images | Graceful handling, clear error messages |

### Phase 3: Pilot Rollout
| Test | Method | Success Criteria |
|------|--------|------------------|
| Real-world Usage | Single team uses for 2-4 weeks | Positive feedback, no blockers |
| Support Load | Track questions/issues | Manageable without dedicated support |
| Performance at Scale | Monitor with increased usage | No degradation |

---

## In Terms of Numbers and Impact

### Scope of Impact

| Dimension | Estimate | Notes |
|-----------|----------|-------|
| **Potential Users** | All Confluence users in organization | Scales with Confluence license |
| **Use Cases** | Architecture diagrams, flowcharts, wireframes, process maps, org charts, technical illustrations | Primary: Engineering, Product, Design |
| **Pages Affected** | Any Confluence page can embed diagrams | No migration - additive capability |
| **Systems Integrated** | Confluence Cloud only | No additional integrations required |

### Efficiency Gains for Quick-Iteration Use Cases

| Activity | Manual Excalidraw Workflow | With Excaliframe |
|----------|---------------------------|------------------|
| Create quick diagram | Open excalidraw.com → draw → export PNG → upload to Confluence | Type /Excalidraw → draw → save |
| Update existing diagram | Find source file (if saved) → open → edit → re-export → re-upload | Click edit → modify → save |
| Source file management | Browser localStorage or manual file saving | Automatic - stored in Confluence |

### Value Proposition

| Benefit | Description |
|---------|-------------|
| **Minimal context switching** | Excalidraw's lightweight UI means quick in-and-out - open, sketch, save, back to writing |
| **More diagrams get created** | Lower friction means ideas that "aren't worth a formal diagram" get captured |
| **Source files preserved** | No more lost localStorage or missing .excalidraw files |
| **Version history** | Diagram changes tracked via Confluence page history |
| **Legitimized workflow** | Engineers already using Excalidraw get supported tooling |

### Cost Summary

| Item | Cost |
|------|------|
| Excaliframe licensing | $0 (open-source) |
| Hosting (self-hosted) | ~$0-20/month on internal infrastructure or cloud platform |
| Implementation effort | Low - straightforward Confluence app installation |
| **Total incremental cost** | **Near zero** |

**Forge Hosting Benefits**: Excaliframe runs on Atlassian's Forge platform — no separate server to deploy or maintain. Assets are hosted by Atlassian alongside Confluence.

---

## Execution Plan / Updates

### High-Level Timeline

```
Phase 1: Initial Setup (Days)
├── Security review of integration (stateless, minimal surface area)
├── Install using public endpoint for initial validation
└── Test in sandbox environment

Phase 2: Pilot (2-4 weeks)
├── Enable for pilot team (engineers already using Excalidraw)
├── Brief announcement with quick-start guide
├── Monitor usage and gather feedback
└── Address any issues

Phase 3: Broader Rollout (1-2 weeks)
├── Enable organization-wide
├── Announce availability
└── Continue monitoring adoption

Phase 4: Migration to Internal Hosting (When Ready)
├── Deploy Excaliframe to internal infrastructure
├── Update Confluence app to point to internal endpoint
├── Decommission dependency on public endpoint
└── Full control over availability and updates
```

### Milestones

1. **Security Approval**: Integration cleared for use
2. **Pilot Launch**: Available to initial team
3. **GA Rollout**: Available to all users
4. **Internal Hosting**: Migrated to company infrastructure

---

## Partnerships and Teams Involved

| Team | Role | Engagement |
|------|------|------------|
| **IT/Platform** | App installation, Confluence administration | Required for deployment |
| **Security** | Review data handling, approve integration | Required before deployment |
| **Engineering** | Primary users, pilot participants | Pilot and feedback |
| **Product** | Users for wireframes, product documentation | Pilot and feedback |
| **Design** | Users for visual documentation | Pilot and feedback |
| **Documentation/Tech Writing** | Power users, documentation standards | Training and adoption |
| **Procurement** (if applicable) | Marketplace purchase approval | If using paid listing |
| **Legal** (if applicable) | Review terms of service | If required by policy |

---

## Open Questions

1. **Pilot Team**: Which team should pilot first?
   - Engineering teams already using Excalidraw manually (recommended)
   - Teams with high documentation volume

2. **Support Model**: Who handles user questions and issues?
   - Self-service documentation? (Recommended - Excalidraw is intuitive)
   - Community Slack channel?

3. **Internal Hosting (Phase 4)**: Which platform for eventual migration?
   - GCP (App Engine, Cloud Run)
   - AWS (ECS, Fargate)
   - Azure (App Service)
   - Internal Kubernetes
   - Note: Decision can wait until after pilot validates usage

---

## Security & Trust Model

### How Data Flows

```
User Browser                    Confluence Cloud (Forge)
     │                                │
     │ ──── Views/Edits page ───────► │
     │                                │ ── Loads Custom UI iframe ──►  (Forge-hosted assets)
     │ ◄─────────────────────────────── Serves HTML/JS/CSS
     │                                │
     │ ── @forge/bridge save ────────►│  (Data saved TO Confluence macro config)
     │                                │
     │  All data stays within Confluence/Atlassian infrastructure
```

**Key architectural point**: Forge hosts Excaliframe's static assets (HTML, JavaScript, CSS) on Atlassian infrastructure. Diagram data flows between the browser and Confluence via `@forge/bridge` — there is no external server.

### Trust Model - Be Explicit About What You're Trusting

The JavaScript served by Excaliframe runs in the browser and **has access to diagram data** (it must, to render and edit diagrams). This means:

| Trust Layer | What You're Trusting | Verifiable? |
|-------------|---------------------|-------------|
| Confluence/Atlassian | Platform security, data storage, access control | SOC2, compliance docs |
| Excaliframe code | ~300 lines of React components don't exfiltrate data | Yes - code audit |
| Excalidraw library | Open-source library doesn't exfiltrate data | Partially - large codebase, widely used |
| npm dependencies | Transitive dependencies are not malicious | Partially - `npm audit`, lockfiles |

**This trust model applies to ANY browser-based application** - Lucidchart, draw.io, or any Confluence Forge/Connect app. You are always trusting the JavaScript you run.

### What the Excaliframe Code Actually Does

**Verified by code audit** - the Excaliframe source contains:
- ✅ No `fetch()` or `XMLHttpRequest` calls that send data externally
- ✅ No `WebSocket` connections
- ✅ No `navigator.sendBeacon()` calls
- ✅ Only `navigator.clipboard` usage (user-initiated copy/paste)
- ✅ Only network activity is loading assets and Confluence API calls

**What would need ongoing verification:**
- Excalidraw library updates (third-party dependency)
- npm dependency updates (supply chain risk)

### Real vs. Perceived Risks

| Concern | Reality |
|---------|---------|
| "Data stored on external server" | **False** - no external server; all data stored in Confluence macro config via Forge |
| "Excaliframe can read our diagrams" | **Partially true** - the JS code CAN access data, but current code doesn't transmit it externally (verifiable via audit) |
| "Unauthorized access to diagrams" | **Mitigated** - inherits Confluence page permissions, no separate auth |
| "Data in transit exposure" | **Mitigated** - data flows to Confluence over TLS, not through Excaliframe server |
| "Malicious code injection" | **Primary risk** - mitigated by self-hosting + code audit |

### Recommended Security Controls

| Control | Purpose | Effort |
|---------|---------|--------|
| **Self-host on internal infrastructure** | Eliminate external dependency, control asset delivery | Medium |
| **Code audit of Excaliframe** | Verify no data exfiltration (~300 lines, straightforward) | Low |
| **Dependency scanning** | Monitor npm dependencies for vulnerabilities | Low (automated) |
| **Network monitoring during pilot** | Verify no unexpected external requests | Low |
| **Pin dependency versions** | Prevent unexpected updates introducing risk | Low |
| **Periodic re-audit on updates** | Maintain trust as code evolves | Low |

### Comparison to Alternatives

| Tool | JS has data access? | Can audit code? | Data storage |
|------|---------------------|-----------------|--------------|
| Excaliframe | Yes | Yes (~300 lines) | Confluence only |
| Lucidchart | Yes | No (proprietary) | Lucidchart servers |
| draw.io | Yes | Partially (open-source) | Configurable |
| Miro | Yes | No (proprietary) | Miro servers |

---

## Concerns

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance with very large diagrams | Low | Medium | Document size guidelines, test limits |
| Browser compatibility issues | Low | Medium | Test on supported browsers, document requirements |
| Integration downtime | Low | Low | Diagrams render as static PNG when editing unavailable |

### Adoption Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| User resistance to new tool | Medium | Medium | Pilot with enthusiastic team, gather champions |
| Insufficient training | Medium | Medium | Create quick-start guide, office hours |
| Feature gaps vs. current tools | Medium | Low | Document limitations, allow exceptions |

### Security Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Malicious code served | Low (if self-hosted) | High | Self-host + code audit + dependency scanning |
| Supply chain attack (npm) | Low | High | Pin versions, monitor advisories, `npm audit` |
| Dependency vulnerability | Medium | Medium | Regular dependency updates, automated scanning |

### Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Service unavailability | Low | Low | Self-host for control; PNG fallback for viewing |
| Breaking changes in updates | Low | Medium | Test updates in sandbox before production |
| Lack of vendor support | Medium | Low | Open-source, auditable, internal expertise |

---

## Appendix: Technical Architecture Summary

![Excaliframe Architecture](docs/architecture-diagram.png)

*This diagram was created using Excaliframe on a test Confluence environment. Meta, right?*

**Key Security Points**:
- All drawing data stored in Confluence page content
- Server is stateless - no user data persisted
- Forge platform authentication (Atlassian-managed)
- Inherits Confluence page-level permissions
