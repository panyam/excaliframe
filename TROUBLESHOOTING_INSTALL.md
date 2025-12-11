# Troubleshooting Plugin Installation

## Error: "Could not install the file... Check that the file is valid"

This error means Confluence can reach your server but the JSON file has issues.

### Step 1: Validate JSON Schema

```bash
make validate-json
```

This checks:
- Required fields are present
- Field types are correct
- URLs are properly formatted
- Schema compliance

### Step 2: Test Endpoint from Confluence

```bash
make test-endpoint
```

This simulates what Confluence sees when fetching the descriptor.

### Step 3: Common Schema Issues

#### Issue: apiVersion not first
**Fix:** `apiVersion` should be the first field in the JSON (already fixed)

#### Issue: Missing required fields
**Required fields:**
- `apiVersion` (must be 1)
- `key` (reverse domain notation)
- `name`
- `baseUrl`
- `version`
- `authentication.type`
- `scopes` (array)
- `modules.customContent` (array)

#### Issue: Invalid URLs
**Check:**
- All URLs must start with `/` (relative to baseUrl)
- `baseUrl` must be accessible from browser
- Referenced files must exist:
  - `/editor.html`
  - `/renderer.html`
  - `/images/excalidraw-icon.svg`

#### Issue: Content-Type header
**Fix:** Server should return `Content-Type: application/json` (already configured)

### Step 4: Verify Files Exist

```bash
# Check all referenced files
curl http://localhost:3000/editor.html
curl http://localhost:3000/renderer.html
curl http://localhost:3000/images/excalidraw-icon.svg
curl http://localhost:3000/atlassian-connect.json
```

All should return content (not 404).

### Step 5: Check Confluence Logs

```bash
make logs | grep -i "connect\|app\|install"
```

Look for specific error messages about what's wrong.

### Step 6: Common Fixes

1. **Rebuild and restart:**
   ```bash
   make build
   make stop
   make start
   ```

2. **Verify JSON is served correctly:**
   ```bash
   curl -I http://localhost:3000/atlassian-connect.json
   # Should show: Content-Type: application/json
   ```

3. **Check JSON is valid:**
   ```bash
   curl -s http://localhost:3000/atlassian-connect.json | python3 -m json.tool
   ```

4. **Test from Confluence container:**
   ```bash
   docker exec confluence-server curl -s http://host.docker.internal:3000/atlassian-connect.json | python3 -m json.tool
   ```

### Step 7: Confluence-Specific Issues

#### Issue: baseUrl mismatch
**Problem:** `baseUrl` is `http://localhost:3000` but Confluence uses `host.docker.internal:3000`

**Solution:** This is correct! The `baseUrl` is for the browser (which uses localhost). Confluence internally resolves it correctly.

#### Issue: HTTPS required
**Problem:** Some Confluence versions require HTTPS

**Solution:** For local development, HTTP is fine. If needed, use a tunnel:
```bash
make tunnel-ngrok
# Use the HTTPS URL from ngrok
```

#### Issue: CORS errors
**Problem:** Browser blocks requests due to CORS

**Solution:** Confluence Connect apps don't have CORS issues - they're loaded in iframes with proper headers.

### Step 8: Still Not Working?

1. **Check Confluence version:**
   - Custom content types require Confluence 7.0+
   - Check: http://localhost:8090/admin/viewsysteminfo.action

2. **Enable development mode:**
   - Settings → Manage Apps → Settings
   - Enable "Development mode"

3. **Try manual upload:**
   - Download the JSON: `curl http://localhost:3000/atlassian-connect.json > descriptor.json`
   - Upload the file directly instead of using URL

4. **Check for conflicting apps:**
   - Uninstall any existing versions of the plugin
   - Clear browser cache

5. **Review Confluence logs:**
   ```bash
   make logs | tail -100
   ```
