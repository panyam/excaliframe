# Why Do We Need a Server? (Excalidraw is Client-Side!)

Great question! Excalidraw **is** fully client-side, but we still need a server due to **Confluence Connect architecture requirements**.

## The Short Answer

**Confluence Connect requires a registered app server** - it's not about Excalidraw, it's about how Confluence loads and validates Connect apps.

## Why Confluence Connect Needs a Server

### 1. **App Registration & Descriptor**

Confluence needs to fetch `atlassian-connect.json` from a URL:
- When you install the app, Confluence makes an HTTP request to `baseUrl/atlassian-connect.json`
- This tells Confluence what the app does, what URLs to load, etc.
- **Can't be a static file** - Confluence validates it's accessible

### 2. **Lifecycle Endpoints**

Confluence calls these endpoints:
- `POST /confluence/lifecycle/installed` - When app is installed
- `POST /confluence/lifecycle/uninstalled` - When app is removed
- These need to be actual HTTP endpoints (even if they just return 204)

### 3. **Custom Content Type URLs**

In `atlassian-connect.json`, we specify:
```json
{
  "editor": { "url": "/excalidraw/editor" },
  "url": "/excalidraw/renderer"
}
```

Confluence loads these as **iframes** from `baseUrl + url`:
- Browser loads: `http://localhost:3000/excalidraw/editor`
- Confluence validates the origin matches the registered app
- **Security requirement**: Files must be served from the registered `baseUrl`

### 4. **Same-Origin Policy**

Confluence Connect enforces that:
- HTML files are served from the registered app domain
- The `AP` (Atlassian Platform) JavaScript API is injected based on the origin
- Cross-origin restrictions apply

## What the Server Actually Does

Looking at `server.ts`, it's **very minimal**:

1. **Serves static files** (`dist/editor.html`, `dist/renderer.html`, etc.)
2. **Serves descriptor** (`/confluence/atlassian-connect.json`)
3. **Lifecycle endpoints** (`/confluence/lifecycle/*` - just return 200)
4. **Serves images** (`/images/excalidraw-icon.svg`)

That's it! No backend logic, no API, no database - just a static file server + a few endpoints.

## Could We Simplify?

**Yes!** We could use a simpler static file server:

### Option 1: Use `http-server` or `serve`
```bash
npm install -g http-server
http-server dist -p 3000
```

But we'd still need:
- A way to serve `atlassian-connect.json` from root
- Lifecycle endpoints (could use a simple Express server just for those)

### Option 2: Minimal Express Server (Current)
- Serves everything we need
- Easy to extend if needed
- Already set up

### Option 3: Production Static Hosting
In production, you'd typically:
- Build static files
- Host on CDN/static hosting (S3, CloudFront, etc.)
- Use a lightweight serverless function for lifecycle endpoints
- Or use a simple Express server on a cloud platform

## The Architecture Flow

```
1. Install App in Confluence
   ↓
2. Confluence fetches: http://your-server/confluence/atlassian-connect.json
   ↓
3. Confluence registers app with baseUrl
   ↓
4. User creates Excalidraw Drawing
   ↓
5. Confluence loads iframe: http://your-server/excalidraw/editor
   ↓
6. Browser loads editor.html (client-side React + Excalidraw)
   ↓
7. User draws (all client-side)
   ↓
8. Editor saves via Confluence API (AP.confluence.saveMacro)
   ↓
9. Data stored in Confluence (not our server!)
```

**Key Point**: The server never touches the drawing data - it's all stored in Confluence via the Connect API.

## Why Not Just Static Files?

You might think: "Why not just host `editor.html` on a CDN?"

**Because Confluence Connect requires:**
1. A registered `baseUrl` that Confluence can validate
2. Lifecycle endpoints that Confluence can call
3. Same-origin enforcement for security

Even if the HTML/JS is static, Confluence needs to "know" about your app through the Connect framework.

## Summary

- **Excalidraw**: 100% client-side ✅
- **Server needed**: For Confluence Connect architecture requirements
- **Server does**: Static file serving + lifecycle endpoints (minimal)
- **Could simplify**: Yes, but Express is already lightweight and flexible

The server is essentially a "glue layer" between Confluence's Connect framework and your client-side React/Excalidraw app.
