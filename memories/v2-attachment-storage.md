# V2 Attachment-Based Storage

## Problem

Confluence macro config (`view.submit`) has a ~5.2MB payload limit, causing 413 errors for diagrams with embedded images (9.7MB+).

## Solution: V2 MacroConfig

Store drawing data as a Confluence page attachment, keep only a reference + preview in macro config.

### Config Shapes

```typescript
// V1 (no storageVersion field) — inline data
{ drawing: string; preview: string; }

// V2 — attachment reference
{ storageVersion: 2; attachmentFilename: string; preview: string; drawing: '{"_excaliframe_v2": true}'; }
```

### Attachment Naming

`excaliframe-{localId}.json` where `localId` = `context.localId` (Forge per-macro UUID).

### API Approach

**Hybrid v1/v2 Confluence REST API via `requestConfluence` from `@forge/bridge`:**
- **Read** (v2): `GET /api/v2/pages/{pageId}/attachments?filename=...`
- **Upload** (v1): `PUT /wiki/rest/api/content/{pageId}/child/attachment` with `X-Atlassian-Token: nocheck` + multipart FormData
- **Download**: follow `downloadLink` from v2 attachment metadata

### Files

| File | Role |
|------|------|
| `src/hosts/forge.ts` | V2 save/load logic, V1 fallback, type guards |
| `src/hosts/forge-attachments.ts` | Bridge/resolver upload/download, diagnostic |
| `src/resolver.js` | Server-side resolver (plain JS, not used by default) |
| `src/editor/index.tsx` | UpgradeWarningBanner for V1 fallback |
| `manifest.yml` | Scopes, resolver function, macro resolver reference |

### Save Flow

1. Upload drawing JSON as attachment via bridge `requestConfluence`
2. `view.submit({ config: V2MacroConfig })` with small stub
3. **Fallback**: if upload fails → save as V1 (inline) + amber warning banner

### Load Flow

1. No `storageVersion` → V1: return `config.drawing` inline
2. `storageVersion === 2` → download attachment by filename via v2 API

### Backward Compatibility

- Existing V1 macros load normally
- Auto-upgrade to V2 on every save (transparent)
- V1 fallback with warning if attachment upload fails

### Edge Cases

- **Macro copy**: new `localId` → attachment not found → empty drawing
- **App downgrade**: old code sees stub → preview still renders
- **Race condition**: attachment orphaned if `view.submit` fails → harmless, overwritten on next save

## PR

- Branch: `v2-attachment-storage`
- PR: #17
- Issue: #16
