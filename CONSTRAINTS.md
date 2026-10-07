# Constraints

> Architectural rules for this project. Validated by `/stack-audit`.
> Component-level constraints (if any) are in each component's CONSTRAINTS.md and checked automatically.

## Constraints

### Zero Backend State
**Rule**: The Go server must not persist user data. No database, no Redis, no session cookies, no server-side storage. All drawing data lives in Confluence (plugin) or IndexedDB (playground).
**Why**: Core design principle — keeps the server stateless and deployable as a simple App Engine app. User data ownership stays with the platform (Confluence) or the browser.
**Verify**: `grep -rn 'database/sql\|sqlx\|gorm\|redis\|\.SetCookie\|gorilla/sessions' --include='*.go' site/`
**Scope**: site/

### Host-Agnostic Core
**Rule**: Files in src/core/ must not import from src/hosts/, @forge/bridge, or any platform-specific module. Core components receive platform capabilities via host adapter props (EditorHost, RendererHost).
**Why**: Core must be reusable across Forge plugin, web playground, and any future host. Direct platform imports break this portability.
**Verify**: `grep -rn '@forge\|from.*hosts/' --include='*.ts' --include='*.tsx' src/core/`
**Scope**: src/core/

### Host-Agnostic Collab
**Rule**: Files in src/collab/ must not import from src/hosts/ or @forge/bridge. Collab is a domain layer that sits between core and hosts.
**Why**: Same reason as host-agnostic core — collab must work identically in Forge and playground environments.
**Verify**: `grep -rn '@forge\|from.*hosts/' --include='*.ts' --include='*.tsx' src/collab/`
**Scope**: src/collab/

### Dynamic Diagram Type Loading
**Rule**: Diagram type libraries (Excalidraw, Mermaid) must be loaded via dynamic import through boot wrappers. Editor dispatchers must never statically import a diagram library directly.
**Why**: Each diagram type is a separate webpack chunk. Mermaid users should never download Excalidraw, and vice versa. Static imports in dispatchers would bundle everything together.
**Verify**: `grep -rn "from '@excalidraw\|from 'mermaid\|require.*excalidraw\|require.*mermaid" --include='*.ts' --include='*.tsx' src/editor/index.tsx site/pages/editor/index.tsx`
**Scope**: src/editor/index.tsx, site/pages/editor/index.tsx

### Host Adapters Are the Only Bridge
**Rule**: Platform-specific APIs (@forge/bridge, IndexedDB via PlaygroundStore) must only be used inside src/hosts/. All other code accesses platform capabilities through the EditorHost/RendererHost interfaces.
**Why**: Adding platform calls outside hosts/ creates hidden coupling that breaks when porting to a new platform.
**Verify**: `grep -rn '@forge/bridge\|PlaygroundStore' --include='*.ts' --include='*.tsx' src/ | grep -v 'src/hosts/' | grep -v '__tests__'`
**Scope**: src/

### Relay Server Is Stateless
**Rule**: The MassRelay integration must treat the relay server as a stateless message router. No collaboration state (document content, peer lists, cursor positions) should be persisted server-side.
**Why**: E2EE design means the server cannot read message content. State reconstruction happens client-side from the sync protocol.
**Verify**: manual
**Scope**: src/collab/
<!-- Candidate for promotion to massrelay/CONSTRAINTS.md if seen in other projects -->
