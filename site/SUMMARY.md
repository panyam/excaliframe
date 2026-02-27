# Excaliframe Marketing Site

Marketing and support website for the Excaliframe Confluence plugin.

## Overview

A simple Go web application built with [goapplib](https://github.com/panyam/goapplib) and deployed to Google App Engine.

**Canonical URL:** `https://excaliframe.com`

## Pages

- **Home** (`/`) - Landing page with feature highlights, screenshots, and installation link
- **Playground List** (`/playground/`) - Multi-drawing list page with grid/table view toggle
- **Playground Detail** (`/playground/{drawingId}/`) - Drawing preview with metadata and edit/delete buttons
- **Playground Edit** (`/playground/{drawingId}/edit`) - Full-screen Excalidraw editor with inline-editable drawing title
- **Documentation** (`/docs/`) - Installation guide, FAQ, and tips
- **Privacy Policy** (`/privacy/`) - Privacy policy (no data collection, all data stays in Confluence)
- **Terms of Service** (`/terms/`) - MIT license terms and disclaimers
- **Contact Us** (`/contact/`) - Links to GitHub Issues

## SEO Configuration

### Canonical URLs & Redirects
- All pages specify canonical URLs via `CanonicalUrl` field in `goal.BasePage`
- Middleware handles redirects: `www.` → non-www, `http://` → `https://`
- Trailing slash redirects for consistency (e.g., `/docs` → `/docs/`)

### Meta Tags
Each page sets:
- `MetaDescription` - SEO description for search results
- `CanonicalUrl` - Preferred URL for the page
- Open Graph tags (og:title, og:description, og:url, og:image)
- Twitter Card tags

### Sitemap & Robots
- `/robots.txt` - Crawler directives
- `/sitemap.xml` - All pages with priorities

## Architecture

### Framework
- **goapplib** - Go web application framework with page-based routing
- **templar** - Template engine with namespace/include support

### Templates
- Uses Templar's `@goapplib/` namespace for base templates
- `templar.yaml` configures vendored dependencies from goapplib
- Run `templar get` to fetch dependencies into `templar_modules/`

### Styling
- Tailwind CSS via CDN
- Custom styles in `static/css/style.css`
- Dark mode support

## Playground Frontend

The `site/` directory is self-contained for frontend builds with its own `package.json`, `tsconfig.json`, and `webpack.config.js`. Playground page source lives in `site/pages/` and imports shared core code from `../src/` via the `@excaliframe/*` path alias.

```bash
cd site/
npm install        # Install site-specific deps (React, Excalidraw, jsx-dom, webpack)
npm run build      # Build playground bundles to static/playground/
npm run watch      # Watch mode for development
```

The `@excaliframe/*` alias maps to `../src/*` in both `tsconfig.json` and `webpack.config.js`. If `site/` ever moves to its own repo, only the alias config changes — no source code changes needed.

### Editable Drawing Title

The playground editor page includes an inline-editable drawing title in the site header bar, positioned after "Excaliframe /". The implementation uses a portal pattern:

1. `PlaygroundEditPage.html` injects a `#drawing-title-slot` element into the header's logo area via inline script
2. `site/pages/excalidraw/index.tsx` renders the `DrawingTitle` component (from `src/core/DrawingTitle.tsx`) into the slot via a separate React root
3. Title changes persist immediately to IndexedDB via `WebEditorHost.setTitle()`, independently of the drawing save cycle
4. The `DrawingTitle` component is standalone and reusable — it accepts `initialTitle` + `onRename` callback and has no knowledge of hosts or editors

## Development

```bash
# Install dependencies and run locally
make run

# Deploy to App Engine
make deploy
```

## Deployment

Deployed to Google App Engine:
- Project: `excaliframe`
- Canonical URL: `https://excaliframe.com`
- App Engine URL: `https://excaliframe.appspot.com`

For App Engine deployment, the `replace` directives in go.mod are used only for local development. The deployment process handles copying local dependencies.
