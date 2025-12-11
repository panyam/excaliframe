# Docker Setup Guide

**Note:** This guide is for the old Docker-based plugin server setup. The current setup runs the plugin server locally for easier development.

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for the current architecture.

## Current Architecture

- **PostgreSQL** - Runs in Docker
- **Confluence Server** - Runs in Docker  
- **Plugin Server** - Runs locally on host (NOT in Docker)
- **Confluence accesses plugin via:** `http://host.docker.internal:3000`
