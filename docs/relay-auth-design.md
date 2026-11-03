# Relay Auth & DDoS Hardening — Design Document

> Context document for continuing this design conversation. Covers current state, proposed OAuth2 auth layer, and open questions.

## 1. Current Security Posture (What's Already Built)

Massrelay (`~/newstack/massrelay`) already has layered protections:

| Layer | Mechanism | Default |
|-------|-----------|---------|
| Global rate limit | Token bucket | 100 req/s (`RELAY_GLOBAL_RATE`) |
| Per-IP rate limit | Token bucket + auto-cleanup | 5/s, burst 3 (`RELAY_PER_IP_RATE`) |
| Per-client msg rate | Token bucket (join/leave exempt) | 30 msg/s |
| Connection limit | Atomic counter | 500 (`RELAY_MAX_CONNECTIONS`) |
| Origin validation | Allowlist + wildcard subdomains | `RELAY_ALLOWED_ORIGINS` |
| CORS | Origin reflection (not `*`) | Same allowlist |
| Trusted proxies | CIDR-based XFF validation | `RELAY_TRUSTED_PROXIES` |
| Room capacity | Peer count check | 10 (`MaxPeersPerRoom`) |
| Encryption enforcement | Protocol version gate | v2 required for E2EE rooms |
| Zombie cleanup | `watchClose()` goroutine | On context cancel |
| Message size | Payload validation | 1 MB |
| Slowloris defense | `ReadHeaderTimeout` | 10s |
| Keepalive | Ping/pong | 30s / 5min timeout |
| Panic recovery | Handler wrapper | Always active |
| Anti-spoofing | Trusted proxy CIDR for XFF | Prevents rate limit bypass |

**Key files:**
- `massrelay/web/middleware/` — ratelimit.go, connlimit.go, origin.go, clientip.go, cors.go, guard.go
- `massrelay/web/server/stream.go` — per-client rate limit, zombie cleanup
- `massrelay/services/collab_service.go` — room join validation, MaxPeers, encryption

**What's missing:** No authentication at all. Session IDs are the only access control. Any client that knows a relay URL can open WebSocket connections freely.

## 2. The Problem

Without auth:
- **Connection abuse**: Anyone can open hundreds of WebSocket connections. Rate limits are per-IP, which is crude (shared NATs, VPNs cause collateral damage).
- **Room creation spam**: Unlimited rooms per IP.
- **No accountability**: Can't ban a specific bad actor without banning their entire IP range.
- **Amplification**: A bad actor joining rooms triggers broadcasts to N peers — trackable only by IP.

## 3. Auth Options Considered

### Option A: Full OAuth2 with Identity (Google/GitHub login)
- User logs in → excaliframe.com verifies → mints relay token
- Maximum protection, real identity behind every connection
- **Rejected concern**: "breaks no-tracking promise"
- **Counter-argument (accepted)**: The privacy promise is about *data* ("we don't store your drawings centrally"). Knowing `alice@gmail.com` connected to a relay is fundamentally different from storing her drawings. Users already trust Google/GitHub with their identity.

### Option B: Anonymous OAuth2 Client Credentials
- The *app* authenticates, not the user. Relay knows "this is a legitimate excaliframe client."
- **Rejected**: Doesn't prevent bad actors from extracting the client secret. Security through obscurity.

### Option C: Ephemeral API Keys (JWT on page load, no login)
- Server issues short-lived JWT to anyone loading the page. No login required.
- **Rejected**: Attacker just hits the site, gets a token, and proceeds. Adds latency for legitimate users while barely slowing down attackers. Security theater.

### Option D: Proof-of-Work
- Client solves computational puzzle before connecting.
- Zero tracking, but also zero accountability.
- Could be a supplementary layer but not sufficient alone.

## 4. Chosen Direction: OAuth2 with Identity (Option A)

**Rationale**: If users want *connectivity* (sharing/collab), asking them to prove they're a real person is reasonable. We're already giving them full control of their data and not storing anything centrally. Auth != tracking.

### 4.1 Auth Chain

```
User ──OAuth2──▶ Google/GitHub
                    │
                    ▼ (id_token / authorization code)
              Excaliframe.com
                    │ (verifies OAuth2 flow)
                    │ (mints signed relay access token)
                    ▼
              Relay Access Token (JWT)
                    │
                    ▼ (presented on WebSocket upgrade)
              Relay Server
                    │ (verifies signature + claims)
                    ▼
              Connection accepted
```

### 4.2 Why This Is Secure

- **Relay never talks to Google/GitHub** — it only trusts tokens signed by excaliframe.com
- **Forged tokens fail** — attacker needs excaliframe.com's private signing key
- **A valid Google OAuth token is useless alone** — must go through excaliframe.com to get a relay token
- **Per-user rate limits and bans** become possible (by opaque user hash, not raw email)
- **Revocation** — rotate signing key or add deny-list
- **Abuse forensics** — correlate bad behavior to a real identity

### 4.3 Token Design (Proposed)

**Format**: JWT (RS256 — asymmetric so relays only need the public key)

**Claims**:
```json
{
  "iss": "excaliframe.com",
  "sub": "<opaque-hash-of-user-id>",
  "exp": "<issued + 1-2 hours>",
  "iat": "<issued-at>",
  "jti": "<random-nonce>",
  "quota": {
    "max_rooms": 5,
    "max_msg_rate": 30
  }
}
```

- `sub` is an opaque hash — relay doesn't know the email, just a stable identifier for rate limiting/banning
- `quota` allows per-user limits (free vs paid tiers later)
- Short TTL (1-2h) — client refreshes periodically

### 4.4 Relay-Side Verification

On WebSocket upgrade (`/ws/v1/{session_id}/sync`):

1. Extract `Authorization: Bearer <token>` header (or `?token=` query param for WebSocket compatibility)
2. Verify JWT signature against excaliframe.com's public key
3. Check `exp` not passed, `iss` matches
4. Check `sub` not on deny-list
5. Apply per-`sub` rate limits (replaces crude per-IP limits for authenticated users)
6. Accept connection

**Key distribution options**:
- **Baked in**: Public key compiled into relay binary (simplest, requires redeploy to rotate)
- **JWKS endpoint**: Relay fetches `https://excaliframe.com/.well-known/jwks.json` on startup + periodic refresh (standard, supports rotation)
- **Shared secret via env var**: Simpler but symmetric (HMAC) — less ideal for distributed relays

## 5. Open Design Questions

### 5.1 OAuth2 Providers
- Google only? GitHub? Both?
- Multiple providers increases reach but adds implementation surface

### 5.2 Token Refresh Flow
- When the 1-2h JWT expires mid-session, how does the client refresh?
- Options: background refresh via excaliframe.com API, or longer TTL with sliding window

### 5.3 Anonymous/Guest Access
- Do we still allow unauthenticated connections for local-only use (no collab)?
- Proposal: Auth required ONLY for relay connections. Solo editing needs no auth.

### 5.4 Key Distribution
- JWKS endpoint is the standard approach but adds an HTTP dependency on startup
- For the relay pool (10-50 cheap VMs), JWKS with caching is probably the right call

### 5.5 Deny-List Propagation
- How do relays learn about banned users?
- Options: short JWT TTL (ban takes effect on expiry), or push-based deny-list update

### 5.6 Backward Compatibility
- Existing unauthenticated clients will break — need a migration period?
- Or ship auth as mandatory from day one (product is pre-launch anyway)

### 5.7 Where Auth State Lives
- Cookie/session on excaliframe.com?
- Or stateless — excaliframe.com just validates OAuth2 and returns a JWT, no server-side session

### 5.8 Remaining DDoS Vectors (Even With Auth)
- Legitimate authenticated user flooding — per-`sub` rate limits handle this
- Sock puppet accounts — OAuth2 raises the cost significantly vs raw connections
- Application-layer attacks on excaliframe.com's token endpoint — standard web protections (Cloudflare, etc.)
- Relay health/availability — relay pool with client-side failover (existing issue #4)

## 6. Implementation Sequence (Suggested)

1. **JWKS endpoint on excaliframe.com** — serve the public key
2. **JWT minting endpoint** — `POST /auth/relay-token` (requires valid OAuth2 session)
3. **OAuth2 login flow** — Google first, GitHub later
4. **Relay JWT middleware** — new middleware in massrelay `web/middleware/auth.go`
5. **Client-side token handling** — fetch token after OAuth2 login, attach to WebSocket upgrade
6. **Per-sub rate limiting** — extend `ratelimit.go` to support subject-based buckets
7. **Deny-list** — simple in-memory set, loaded from config or API
8. **UI changes** — login prompt before Share, token refresh background task

## 7. Existing Architecture Reference

- **Massrelay** is a standalone library: `github.com/panyam/massrelay` (Go), `@panyam/massrelay` (npm)
- Lives at `~/newstack/massrelay`; excaliframe uses `link:` for local dev
- E2EE is client-side (AES-256-GCM via PBKDF2) — relay is a dumb pipe
- Relay pool strategy (issue #4): static `relay-pool.json`, client probes for lowest latency
- Share codes encode relay URL — followers connect directly to the right relay
- `ENABLE_RELAY` env var controls relay mounting; `ENABLE_SHARING` controls UI
- Distributed relay architecture (issue #6): memberlist gossip + gRPC mesh (future)
