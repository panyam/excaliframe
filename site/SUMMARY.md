# Excaliframe Marketing Site

Marketing and support website for the Excaliframe Confluence plugin.

## Overview

A simple Go web application built with [goapplib](https://github.com/panyam/goapplib) and deployed to Google App Engine at `excaliframe.appspot.com`.

## Pages

- **Home** (`/`) - Landing page with feature highlights, screenshots, and installation link
- **Privacy Policy** (`/privacy/`) - Privacy policy (no data collection, all data stays in Confluence)
- **Terms of Service** (`/terms/`) - MIT license terms and disclaimers
- **Contact Us** (`/contact/`) - Links to GitHub Issues and email contact

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
- URL: `https://excaliframe.appspot.com`

For App Engine deployment, the `replace` directives in go.mod are used only for local development. The deployment process handles copying local dependencies.
