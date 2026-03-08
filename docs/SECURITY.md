# Security Design

This document describes Excaliframe's security architecture, trust model, data flows, threat analysis, and mitigations. It covers both the Confluence plugin (Forge) and the web playground, with particular focus on the real-time collaboration system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Operating Modes](#operating-modes)
3. [Data Storage](#data-storage)
4. [Collaboration System](#collaboration-system)
5. [Relay Server](#relay-server)
6. [Trust Model](#trust-model)
7. [Threat Analysis](#threat-analysis)
8. [Mitigations](#mitigations)
9. [Verification Guide](#verification-guide)
10. [Future Work](#future-work)

---

## Architecture Overview

Excaliframe operates in two independent modes with fundamentally different security properties:

```
┌──────────────────────────────────────┐     ┌──────────────────────────────────┐
│       Forge Mode (Confluence)        │     │     Web Mode (Playground)        │
│                                      │     │                                  │
│  Browser ←──forge/bridge──→ Atlassian│     │  Browser ←──IndexedDB──→ Browser │
│  (iframe sandbox)           Cloud    │     │  (no server storage)             │
│                                      │     │                                  │
│  Drawing data: Confluence macro      │     │  Drawing data: browser-local     │
│  Access control: Confluence perms    │     │  Access control: none (local)    │
│  Auth: Atlassian-managed             │     │  Auth: none (anonymous)          │
└───────────────┬──────────────────────┘     └──────────────┬───────────────────┘
                │                                           │
                │    ┌─────────────────────────┐            │
                └────┤  Relay Server (opt-in)  ├────────────┘
                     │  Stateless msg router   │
                     │  In-memory only         │
                     │  No auth (link-based)   │
                     └─────────────────────────┘
```

Key property: the collaboration relay is the **only component** that transmits drawing data between browsers. Without collab, drawing data never leaves the browser (web mode) or the Confluence platform (Forge mode).

---

## Operating Modes

### Forge Mode (Confluence Plugin)

**Security boundary:** Atlassian's Forge Custom UI sandbox.

The Forge app runs inside a sandboxed iframe hosted on Atlassian's CDN. All interaction with Confluence happens through `@forge/bridge`, an Atlassian-controlled IPC channel (`window.__bridge.callBridge`).

**Permissions declared in `manifest.yml`:**

```yaml
permissions:
  scopes: []           # Zero Confluence API scopes
  content:
    scripts:
      - 'unsafe-eval'  # Required by Excalidraw canvas and Mermaid renderer
    styles:
      - 'unsafe-inline' # Required by Excalidraw inline styles
```

`scopes: []` is the strongest possible permission declaration — the app cannot call any Confluence REST API. It cannot read or write pages, users, spaces, attachments, or any data beyond the current macro's config.

**Bridge calls used (exhaustive list):**

| Call | Direction | Purpose |
|------|-----------|---------|
| `view.getContext()` | Read | Load macro config + module key |
| `view.submit({ config })` | Write | Save drawing + close editor |
| `view.close()` | Signal | Close editor without saving |

There is no backend resolver (`@forge/resolver`), no server-side code, and no `@forge/api` usage. The app is entirely client-side static assets.

**CSP overrides:** `unsafe-eval` is required because Excalidraw performs canvas operations and Mermaid uses dynamic rendering that triggers eval-like patterns. `unsafe-inline` is needed for Excalidraw's programmatic inline styles. These relaxations apply only within the sandboxed iframe and cannot be widened by the app code.

### Web Mode (Playground)

**Security boundary:** Same-origin browser policy.

Drawings are stored in the browser's IndexedDB (`excaliframe-playground` database). The site server (`excaliframe.com`) serves page skeletons and static assets — it never sees, stores, or processes drawing content.

There is no authentication. The playground is anonymous and public. Drawing data is purely local until collaboration is explicitly activated.

**Relay server choice:** When starting a collab session, the user selects a relay server from a list or enters a custom URL. Default options are "This server" (`/relay` — the embedded relay on the same origin) and `excaliframe.com/relay`. Users can also type in any arbitrary WebSocket URL (e.g. a self-hosted relay on their own infrastructure). The last-used relay URL is persisted in `localStorage` for convenience. This means the user controls where their drawing data is routed — choosing a custom relay directs all content through that third-party endpoint. See [T3: Relay Operator Snooping](#t3-relay-operator-snooping) and [T4: Man-in-the-Middle on WebSocket](#t4-man-in-the-middle-on-websocket) for trust implications.

---

## Data Storage

### Forge: Confluence Macro Config

```
DrawingEnvelope { tool, version, data, preview }
    → MacroConfig { drawing: envelope.data, preview: envelope.preview }
    → view.submit({ config: macroConfig })
    → Confluence macro config store (Atlassian-managed)
```

Properties:
- Stored inside Confluence Cloud, subject to Confluence page permissions
- Encrypted at rest by Atlassian
- Versioned with Confluence page history
- Included in Confluence exports/backups
- Never transmitted to excaliframe.com

### Web: Browser IndexedDB

```
DrawingEnvelope → PlaygroundStore → IndexedDB (browser-local)
```

Properties:
- Stored entirely in the user's browser
- Not accessible from other origins
- Not backed up to any server
- Lost if browser data is cleared
- Legacy localStorage data auto-migrated on first access

### Neither mode stores data on Excaliframe servers.

---

## Collaboration System

Collaboration is **opt-in** — it is never activated automatically. The user must explicitly click Share and connect to a relay server. Once active, drawing data transits through the relay in real time.

### How Sharing Works

**Owner starts a session:**
1. User clicks Share in the editor toolbar
2. Selects a relay server (default: `excaliframe.com/relay`, or a custom URL)
3. Client opens a WebSocket to `wss://relay-host/ws/v1/_new/sync`
4. Sends `JoinRoom` action with `is_owner: true` and a `client_hint` (browserId + drawingId)
5. Relay creates a room, generates a UUID `sessionId`, returns `RoomJoined`
6. Owner receives a join code: `base64url(relayWsUrl) + ":" + sessionId`

**Peer joins a session:**
1. Peer receives the join code (via copy-paste, link, etc.)
2. Client opens a WebSocket to `wss://relay-host/ws/v1/{sessionId}/sync`
3. Sends `JoinRoom` with the known `sessionId` and `is_owner: false`
4. Relay returns `RoomJoined` with the existing peer list
5. Peer sends `SceneInitRequest` — the owner responds with a full scene snapshot
6. Peer renders the scene and receives live updates from that point

**Session ends when:**
- Owner disconnects and no same-browser tab can take ownership → `SessionEnded` broadcast to all peers, room is deleted
- Owner disconnects but another tab with the same `browserId` exists → ownership transfers via `OwnerChanged`

### What Is Transmitted

Every collaborative update transits through the relay as JSON-over-WebSocket:

| Editor | Update Type | Content Visible to Relay |
|--------|------------|--------------------------|
| Excalidraw | `SceneUpdate` | Full element JSON (positions, text, styles) |
| Excalidraw | `SceneInitResponse` | Complete scene snapshot |
| Mermaid | `TextUpdate` | Full diagram source text |
| Mermaid | `SceneInitResponse` | Complete diagram text |
| Both | `CursorUpdate` | Pointer coordinates, tool, peer identity |
| Both | `JoinRoom` | Username, browserId, drawingId (in client_hint), tool |

**The relay sees all content in plaintext.** There is no end-to-end encryption. This is the primary security trade-off of the collaboration system.

### Join Codes

A join code has the format: `base64url(relayWebSocketUrl) + ":" + sessionId`

Example: `d3NzOi8vZXhjYWxpZnJhbWUuY29tL3JlbGF5:3f9a2b71-...`

Properties:
- The relay URL is base64url encoded (reversible, not encrypted)
- The sessionId is a UUID (128-bit, not guessable)
- Anyone with the code can join the session — there is no password or token
- The code is valid as long as the room exists (owner is connected)
- There is no revocation mechanism short of the owner disconnecting
- There is no expiry on join codes

### Identity

All identity in the collaboration system is self-declared and unverified:

| Field | Source | Verified by relay? |
|-------|--------|--------------------|
| `username` | User input or random `Anon-xxxx` | No |
| `browserId` | `localStorage` UUID via `crypto.randomUUID()` | No |
| `isOwner` | Client self-declares | Partially (see below) |
| `clientType` | Hardcoded `"browser"` | No |
| `tool` | `"excalidraw"` or `"mermaid"` | No |

The only server-side identity check: if a room already has an owner, a new client claiming `is_owner: true` with a different `browserId` is rejected. This prevents a second browser from hijacking ownership but is bypassable since `browserId` is a self-reported value.

---

## Relay Server

The relay server is the [`massrelay`](https://github.com/panyam/massrelay) library — a standalone Go service that routes messages between WebSocket clients in named rooms.

### What the Relay Stores

**In-memory only, no persistence:**
- `rooms` map: room state, connected client metadata, owner info
- `hintIndex` map: `clientHint` → `sessionId` for session reuse
- Per-client send channel: buffered at 64 events, drops on overflow

All state evaporates on server restart. There is no database, no disk writes, no message history, no replay capability.

### What the Relay Does NOT Do

- **No authentication.** No JWT, API key, OAuth, or any credential check.
- **No authorization beyond ownership.** Any client with a valid `sessionId` can join any room.
- **No encryption.** Content is plaintext JSON. TLS is the transport-level protection (`wss://`).
- **No rate limiting.** No throttle on connections or messages.
- **No message size limits.** The 64-event channel provides back-pressure but not protection.
- **No content inspection or filtering.** The relay forwards messages without examining payloads.
- **No logging of content.** The relay does not log message payloads (only connection events).

### REST API (Unauthenticated)

The relay exposes REST endpoints for room discovery:

| Endpoint | Returns |
|----------|---------|
| `GET /api/v1/rooms` | All active session IDs and peer counts |
| `GET /api/v1/rooms/{sessionId}` | Room details: peers (username, client type, is_owner), owner ID, tool, created_at |
| `GET /api/v1/session-by-hint?hint=...` | Session lookup by `browserId:drawingId` |

These endpoints have no authentication. Anyone who can reach the relay can enumerate active sessions and their peer details.

### CORS Policy

```go
w.Header().Set("Access-Control-Allow-Origin", "*")
```

The relay uses wildcard CORS, allowing connections from any origin. This is by design — the relay is intended to be usable from any domain (Forge, playground, custom deployments).

### Embedded Relay

The excaliframe.com site server embeds the relay at `/relay/`:

```go
relayApp := relayserver.NewRelayApp()
mux.Handle("/relay/", http.StripPrefix("/relay", relayApp))
```

The relay shares the same Go process as the web server. There is no network isolation between them. The relay is a single global in-memory state with no tenant isolation.

### Self-Hosting

Users can run their own relay server for full control over the message routing layer:

```bash
# Clone and build
git clone https://github.com/panyam/massrelay
cd massrelay && go build -o relay ./cmd/relay

# Run on internal network
./relay --port 8080
```

When using a self-hosted relay, drawing data never touches excaliframe.com. The SharePanel in the editor supports entering a custom relay URL.

---

## Trust Model

### What You Are Trusting

| Layer | What You Trust | Verifiable? | Risk Level |
|-------|---------------|-------------|------------|
| **Atlassian/Forge** (Forge mode) | Platform security, data storage, access control | SOC 2, ISO 27001 | Low |
| **Excaliframe code** | ~2000 lines of TypeScript don't exfiltrate data | Yes — code audit | Low |
| **Excalidraw library** | Open-source library doesn't exfiltrate data | Partially — large codebase, widely used | Low |
| **Mermaid library** | Rendering library doesn't exfiltrate data | Partially — large codebase, widely used | Low |
| **npm dependencies** | Transitive dependencies are not malicious | Partially — `npm audit`, lockfiles | Medium |
| **Relay server** (collab) | Routes messages without storing/leaking content | If self-hosted: fully verifiable. Default relay (`excaliframe.com`): trust the operator. Custom relay: trust whoever runs it | Medium |
| **TLS transport** (collab) | WebSocket connection is encrypted in transit | Standard browser TLS | Low |

### Trust Boundaries

```
                     ┌─────────────────────────────────────┐
                     │          Trust Boundary 1            │
                     │     Atlassian Forge Sandbox          │
                     │                                     │
                     │  Excaliframe code runs here          │
                     │  Can only call view.getContext(),     │
                     │  view.submit(), view.close()         │
                     │  Cannot access any Confluence API    │
                     └─────────────────┬───────────────────┘
                                       │ @forge/bridge (IPC)
                     ┌─────────────────┴───────────────────┐
                     │          Trust Boundary 2            │
                     │     Confluence Cloud                 │
                     │                                     │
                     │  Stores drawing in macro config      │
                     │  Enforces page permissions            │
                     │  Atlassian-managed infrastructure    │
                     └─────────────────────────────────────┘

                     ┌─────────────────────────────────────┐
                     │          Trust Boundary 3            │
                     │     Relay Server (opt-in)            │
                     │                                     │
  Browser A ────wss────→  Routes messages between peers  ←────wss──── Browser B
                     │     Sees all content in plaintext   │
                     │     Stores nothing to disk           │
                     │     No authentication                │
                     └─────────────────────────────────────┘
```

### Key Asymmetry

In Forge mode, drawings are protected by Confluence access control. In web mode, drawings are purely local. But once collaboration is activated in either mode, content flows through the relay — **bypassing Confluence permissions entirely**. A Confluence user can share a relay join code with anyone outside the organization, giving them full access to the drawing content for the duration of the session.

---

## Threat Analysis

### T1: Unauthorized Session Join

**Threat:** An attacker obtains a join code and connects to the relay to view/modify a drawing.

**Likelihood:** Low — requires the join code (128-bit UUID sessionId).

**Impact:** High — full read/write access to the drawing for the session duration.

**Current mitigation:** SessionId is a UUID (128 bits of entropy, not guessable). Join codes are shared explicitly by the owner.

**Residual risk:** If a join code is leaked (screenshot, chat history, URL bar), anyone can use it.

### T2: Session Enumeration

**Threat:** An attacker polls `GET /api/v1/rooms` to discover active sessions, then joins them.

**Likelihood:** Medium — the endpoint is unauthenticated and returns all active session IDs.

**Impact:** High — attacker can join any discovered session.

**Current mitigation:** None. The REST API is open.

**Recommended mitigation:** Restrict or remove the list-rooms endpoint in production. See [Future Work](#future-work).

### T3: Relay Operator Snooping

**Threat:** The operator of the relay server reads drawing content from messages in transit.

**Likelihood:** Depends on relay operator trust. For `excaliframe.com/relay`, this is the Excaliframe maintainer. For self-hosted relays, this is whoever runs the server.

**Impact:** High — full visibility into all drawing content.

**Current mitigation:** Users can self-host the relay on their own infrastructure. The relay code is open-source and auditable.

**Recommended mitigation:** End-to-end encryption. See [Future Work](#future-work).

### T4: Man-in-the-Middle on WebSocket

**Threat:** An attacker intercepts WebSocket traffic between a browser and the relay.

**Likelihood:** Low in production (`wss://` enforced). Higher if a user enters a `ws://` custom relay URL.

**Impact:** High — full read/write of all messages.

**Current mitigation:** Production relay uses `wss://` (TLS). The site enforces HTTPS redirects.

**Residual risk:** Custom relay URLs may use `ws://` (unencrypted). The UI does not warn about this.

### T5: Owner Impersonation

**Threat:** An attacker connects to a room claiming `is_owner: true` with a forged `browserId`.

**Likelihood:** Low — requires knowing the current owner's `browserId` (a random UUID in localStorage).

**Impact:** Medium — could take ownership of the session, kick the real owner.

**Current mitigation:** The relay checks that a new owner claim matches the existing `OwnerBrowserId`. However, `browserId` is self-reported and can be forged if known.

### T6: Supply Chain Attack (npm)

**Threat:** A compromised npm dependency exfiltrates drawing data.

**Likelihood:** Low but non-zero — Excalidraw and Mermaid are large dependency trees.

**Impact:** High — could exfiltrate all drawing data silently.

**Current mitigation:** `npm audit`, lockfiles. Forge's iframe sandbox limits but does not eliminate this risk (the compromised code runs inside the same iframe as the drawing data).

**Recommended mitigation:** Automated dependency scanning in CI, SBOM generation, pinned versions. See `SECURITY_ROADMAP.md`.

### T7: SVG Injection via Renderer

**Threat:** Malicious SVG content stored in a Confluence macro config is rendered inline in the renderer.

**Likelihood:** Very low — SVG content is generated by Mermaid's renderer and stored in Confluence. An attacker would need write access to the Confluence page (which already gives them full page control).

**Impact:** Low — the SVG renders inside the Forge iframe sandbox with Atlassian's CSP.

**Current mitigation:** Forge CSP, iframe sandbox. SVG originates from Mermaid (not user-supplied HTML). Adding DOMPurify sanitization is tracked as issue [#2](https://github.com/panyam/excaliframe/issues/2).

### T8: Forge CSP Bypass via `unsafe-eval`

**Threat:** The `unsafe-eval` CSP override could amplify an XSS attack if malicious code is injected (e.g., via a supply chain compromise of Excalidraw or Mermaid).

**Likelihood:** Very low — requires compromising a widely-used open-source library.

**Impact:** High — arbitrary code execution within the Forge iframe, with access to drawing data and the `@forge/bridge`.

**Current mitigation:** `unsafe-eval` is scoped to the iframe. The bridge only exposes three calls (getContext, submit, close). Even with arbitrary code execution, the attacker can only read/write the current macro's config.

### T9: Cross-Session Data Leakage on Relay

**Threat:** A bug in the relay routes messages to the wrong room.

**Likelihood:** Very low — the routing is a simple map lookup by sessionId.

**Impact:** High — drawing data sent to unintended recipients.

**Current mitigation:** Simple, auditable routing code. Room isolation is enforced by the `rooms` map structure. Each room has its own client set and broadcast is scoped to the room.

### T10: Denial of Service on Relay

**Threat:** An attacker floods the relay with connections or messages, degrading service for all users.

**Likelihood:** Medium — no rate limiting exists.

**Impact:** Medium — collaboration becomes unavailable. Drawings themselves are unaffected (stored locally or in Confluence).

**Current mitigation:** None currently. The 64-event channel buffer provides minimal back-pressure.

**Recommended mitigation:** Rate limiting on connections and messages. See [Future Work](#future-work).

---

## Mitigations

### Currently Implemented

| Mitigation | Protects Against | Where |
|-----------|-----------------|-------|
| UUID session IDs (128-bit) | Session guessing (T1) | Relay server |
| `wss://` in production | MITM (T4) | Transport layer |
| HTTPS redirect middleware | Downgrade attacks | Site server |
| Forge iframe sandbox | Code escape | Atlassian platform |
| `scopes: []` in manifest | API abuse | Forge app config |
| Owner-browserId check | Owner hijacking (T5) | Relay server |
| Stateless relay (in-memory only) | Persistent data exposure | Relay design |
| Open-source code | Auditability | All components |
| Self-hostable relay | Relay trust (T3) | Relay design |
| Opt-in collaboration | Accidental data exposure | Editor UX |

### Defense in Depth Layers

1. **No data at rest on Excaliframe servers** — drawings live in Confluence or the browser, never on excaliframe.com
2. **Forge sandbox** — even compromised code can only access the current macro's config via three bridge calls
3. **Relay is stateless** — server restart destroys all room state; no historical data to breach
4. **Collaboration is opt-in** — users must explicitly share; no automatic syncing
5. **Self-hostable** — organizations can run the relay on their own infrastructure, eliminating third-party trust

---

## Verification Guide

### For Security Teams Evaluating Excaliframe

#### 1. Verify No Data Exfiltration (Forge Plugin)

```bash
# Clone and search for network calls in the app source
git clone https://github.com/panyam/excaliframe
cd excaliframe

# Search for outbound network patterns
grep -r "fetch\|XMLHttpRequest\|sendBeacon" src/
# Expected: zero results

# Search for WebSocket usage (only in collab code, opt-in)
grep -r "WebSocket\|ws://" src/
# Expected: only in src/collab/ (collaboration, opt-in feature)

# Verify Forge bridge is the only Confluence API
grep -r "@forge/api\|@forge/resolver" src/
# Expected: zero results (no server-side code)

# Verify zero API scopes
grep "scopes" manifest.yml
# Expected: scopes: []
```

#### 2. Verify Relay Behavior

```bash
# Clone the relay library
git clone https://github.com/panyam/massrelay

# Verify no disk writes
grep -r "os.Create\|os.OpenFile\|ioutil.WriteFile\|os.WriteFile" massrelay/
# Expected: zero results in services/

# Verify no database usage
grep -r "sql\|database\|redis\|mongo\|postgres" massrelay/services/
# Expected: zero results
```

#### 3. Monitor Network During Pilot

Open browser DevTools Network tab while using the editor:

**Without collaboration:**
- Should see: static asset loads (JS, CSS, fonts)
- Should see: Forge bridge calls (Confluence API, internal)
- Should NOT see: any requests to excaliframe.com with drawing data

**With collaboration:**
- Should see: WebSocket connection to the relay URL
- WebSocket messages contain drawing data (inspect in DevTools WS tab)
- All data is JSON, human-readable in the inspector

#### 4. Test Relay Isolation

```bash
# Start two separate sessions on a self-hosted relay
# Verify Session A cannot see Session B's messages
# Monitor relay logs to confirm no cross-room routing
```

---

## Future Work

Improvements that would strengthen the security posture, roughly in priority order:

### Near Term

| Item | Addresses | Effort |
|------|-----------|--------|
| **Remove/restrict list-rooms endpoint** | T2 (session enumeration) | Low |
| **Rate limiting on relay** | T10 (DoS) | Low |
| **Message size limits** | T10 (DoS) | Low |
| **Warn on `ws://` relay URLs** | T4 (MITM) | Low |
| **Security headers on site server** (CSP, HSTS, X-Frame-Options) | General hardening | Low |
| **Automated dependency scanning in CI** | T6 (supply chain) | Low |
| **SBOM generation on releases** | T6 (supply chain) | Low |
| **DOMPurify for Mermaid SVG preview** | T7 (SVG injection) | Low |

### Medium Term

| Item | Addresses | Effort |
|------|-----------|--------|
| **Session passwords/tokens** | T1 (unauthorized join), T2 (enumeration) | Medium |
| **Session expiry** | T1 (stale codes) | Medium |
| **Read-only join mode** | Principle of least privilege | Medium |
| **Join code revocation** | T1 (leaked codes) | Medium |
| **Relay authentication** (API keys or tokens for room creation) | T2, T10 | Medium |

### Long Term

| Item | Addresses | Effort |
|------|-----------|--------|
| **End-to-end encryption** (E2EE) | T3 (relay snooping), T4 (MITM) | High |
| **Signed messages** (peer-to-peer integrity) | T5 (impersonation) | High |
| **Audit logging** (connection events, no content) | Compliance, incident response | Medium |
| **Atlassian Cloud Fortified certification** | Enterprise trust | High |

### E2EE Design Notes

End-to-end encryption would eliminate the need to trust the relay operator. A possible approach:

1. Owner generates a symmetric key (AES-GCM) when creating a session
2. Key is embedded in the join code (e.g., appended after the sessionId, never sent to the relay)
3. All `SceneUpdate`, `TextUpdate`, and `SceneInitResponse` payloads are encrypted client-side before sending
4. The relay routes opaque ciphertext — it can see metadata (who is connected, message sizes, timing) but not content
5. `CursorUpdate` could remain unencrypted (low sensitivity) or be encrypted (full protection)

Trade-offs: key distribution for late joiners, key rotation, performance overhead on large scenes. Worth a dedicated design document before implementation.

---

## Summary

| Mode | Data at Rest | Data in Transit (no collab) | Data in Transit (collab) |
|------|-------------|---------------------------|--------------------------|
| **Forge** | Confluence macro config (Atlassian-managed, encrypted) | None (all via Forge bridge) | Plaintext JSON via relay WebSocket (TLS) |
| **Web** | Browser IndexedDB (local only) | None | Plaintext JSON via relay WebSocket (TLS) |

**Without collaboration:** Excaliframe is a zero-trust, zero-server-state application. Drawing data never leaves the browser (web) or the Confluence platform (Forge).

**With collaboration:** Drawing data transits through the relay server in plaintext JSON over TLS. The relay is stateless and stores nothing to disk. Users can self-host the relay for full control. End-to-end encryption is a planned future improvement.
