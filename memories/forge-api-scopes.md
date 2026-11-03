# Forge API Scopes & requestConfluence

## Key Learnings (2026-03-18)

### requestConfluence from @forge/bridge

The `requestConfluence` bridge method calls Confluence REST APIs from Custom UI. Critical findings:

1. **Confluence v1 REST API is deprecated** — `GET /rest/api/content/{id}` returns **410 Gone** (with or without `/wiki/` prefix)
2. **Confluence v2 API works** — `GET /api/v2/pages/{id}` returns 200
3. **v1 POST/PUT still works for uploads** — Only v1 GET is deprecated. Attachment upload via `PUT /wiki/rest/api/content/{id}/child/attachment` still works
4. **Hybrid approach required**: v2 for reads, v1 for writes (v2 has no upload endpoint yet)

### Required Scopes (manifest.yml)

Both classic AND granular scopes should be included:

```yaml
# Classic scopes
- read:confluence-content.all
- write:confluence-content
- write:confluence-file              # required for attachment uploads
- readonly:content.attachment:confluence  # required for attachment downloads

# Granular scopes
- read:content-details:confluence    # CRITICAL — required by all content endpoints
- read:content:confluence
- read:page:confluence
- write:content:confluence
- read:attachment:confluence
- write:attachment:confluence
```

**Common pitfall**: `read:content:confluence` is NOT the same as `read:content-details:confluence`. The latter is required by GET content, GET attachments, and PUT attachments endpoints.

### Scope Application

- After adding scopes: `forge deploy && forge install --upgrade` (both required)
- `forge tunnel` alone does NOT apply new scopes
- Admin must consent to new scopes during `--upgrade`

### invoke() Limits

- Request payload: **500KB** max
- Response payload: **5MB** max
- Sends full extension context (including macro config) alongside payload
- Not suitable for large data transfer

### Forge Resolver

- Handler file must be plain JS (not TypeScript) to avoid Forge's ts-loader picking up incompatible project types (d3, etc.)
- Handler path: `resolver.handler` → Forge looks at `src/resolver.js`
- Forge auto-prefixes `src/` to the handler path
