# Forge Debugging Playbook

## requestConfluence Diagnostics

The `window.__excaliframeDiag(pageId)` function tests all API path combinations from the browser console (must be run inside the Forge Custom UI iframe context, not the parent page).

### How to Access the Iframe Console

1. Open Chrome DevTools on the Confluence page
2. Click the **JavaScript context dropdown** (shows "top" by default)
3. Select the iframe context (forge-bridge / custom-ui-iframe / editor URL)
4. Run `window.__excaliframeDiag('PAGE_ID')`

### Bridge vs Resolver Toggle

```js
window.__excaliframeUseResolver = true   // server-side @forge/api
window.__excaliframeUseResolver = false  // client-side requestConfluence (default)
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 "scope does not match" | Missing or wrong scopes | Check manifest scopes, `forge deploy && forge install --upgrade` |
| 410 Gone | v1 REST API deprecated | Use v2 API paths (`/api/v2/pages/{id}`) |
| 413 Content Too Large | Payload exceeds limit | invoke: 500KB req limit; view.submit: ~5.2MB |

### Forge Deploy Checklist

1. `make build` (includes resolver type-check)
2. `forge deploy -e development`
3. `forge install --upgrade` (consent to new scopes)
4. Refresh Confluence page
5. Switch to iframe console context
6. Run diagnostic

### Logs

All V2 storage logs use prefixes:
- `[V2-FORGE]` — ForgeEditorHost save/load logic
- `[V2-ATTACH]` — Attachment API operations
- `[V2-RESOLVER]` — Server-side resolver (when used)
