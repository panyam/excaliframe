# Quick Reference Guide

## 🚀 Getting Started

```bash
# Check Docker resources first (recommended)
make check-resources

# One command to rule them all
make quick-start
```

## 📋 Common Commands

### Setup & Status
```bash
make help              # Show all available commands
make quick-start       # Automated full setup
make status            # Check all services status
make test-connectivity # Test connectivity
make info              # Show project information
```

### Confluence Management
```bash
make confluence-start     # Start PostgreSQL + Confluence
make confluence-stop      # Stop all services
make confluence-restart   # Restart all services
make logs                 # View Confluence logs
make logs-db              # View PostgreSQL logs
make logs-all             # View all logs
make confluence-status    # Check status of all services
make confluence-reset     # ⚠️ Remove all data and start fresh
```

### Plugin Development
```bash
make build            # Build plugin (webpack + server)
make build-webpack     # Build webpack bundles only
make build-server      # Build server TypeScript only
make dev               # Watch mode (webpack)
make dev-server        # Dev server (ts-node)
make start             # Production server
make stop              # Stop plugin server
make type-check        # Type check only
```

### Cleanup
```bash
make clean             # Remove build artifacts
make clean-all         # Clean everything except data
make reset             # ⚠️ Reset everything including data
```

## 🔗 URLs

- **Confluence:** http://localhost:8090
- **Plugin Server:** http://localhost:3000
- **Plugin Descriptor:** http://localhost:3000/atlassian-connect.json
- **Editor:** http://localhost:3000/editor.html
- **Renderer:** http://localhost:3000/renderer.html

## 📦 Install Plugin in Confluence

1. **Start plugin server locally:**
   ```bash
   make start
   ```

2. Open http://localhost:8090
3. Settings → Manage Apps → Upload app
4. Use: `http://host.docker.internal:3000/atlassian-connect.json`

## 🐛 Troubleshooting

### Check Status
```bash
make status
# or
make check-status
```

### Test Connectivity
```bash
make test-connectivity
```

### View Logs
```bash
# Confluence logs
make logs

# PostgreSQL logs
make logs-db

# All logs
make logs-all
```

### Common Issues

**Port 8090 in use:**
```bash
lsof -ti:8090 | xargs kill -9
```

**Port 3000 in use:**
```bash
make stop
# or manually:
lsof -ti:3000 | xargs kill -9
```

**Confluence won't start:**
- Check Docker has enough memory (4GB+)
- Check logs: `make logs`
- Check status: `make status`

**Plugin won't install:**
- Run: `npm run test:connectivity`
- Try different URLs (see LOCAL_SETUP.md)

## 🧹 Cleanup

```bash
# Stop everything (keeps data)
make confluence-stop
make stop

# Remove everything (⚠️ deletes all data!)
make reset
# or manually:
make confluence-reset
```

## 💾 Data Persistence

Data is stored locally in:
- `./data/postgres` - PostgreSQL database files
- `./data/confluence` - Confluence application data

**These directories persist across container restarts!**

## 🔑 Getting a License

Confluence Server needs a license. Get a **FREE 30-day evaluation license:**
- Quick link: https://my.atlassian.com/products/index?evaluation=true
- Detailed guide: [GET_LICENSE.md](./GET_LICENSE.md)

## 📚 Documentation

- **Full Local Setup:** [LOCAL_SETUP.md](./LOCAL_SETUP.md)
- **Getting License:** [GET_LICENSE.md](./GET_LICENSE.md)
- **Cloud Testing:** [TESTING.md](./TESTING.md)
- **Confluence Setup:** [CONFLUENCE_SETUP.md](./CONFLUENCE_SETUP.md)
