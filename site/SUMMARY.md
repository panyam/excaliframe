# Excaliframe Marketing Site

Marketing and support website for the Excaliframe Confluence plugin.

## Overview

A simple Go web application built with [goapplib](https://github.com/panyam/goapplib) and deployed to Google App Engine.

**Canonical URL:** `https://excaliframe.com`

## Pages

- **Home** (`/`) - Landing page with feature highlights, screenshots, and installation link
- **Playground** (`/playground/`) - Interactive Excalidraw editor (no install, localStorage persistence)
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
