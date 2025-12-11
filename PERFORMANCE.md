# Performance Optimization Guide

## Confluence Startup Time

Confluence Server typically takes 60-120 seconds to start. Here are ways to optimize it:

### 1. JVM Tuning (Already Configured)

Current settings in `docker-compose.yml`:
- `SETENV_JVM_MINIMUM_MEMORY=2048m` - Initial heap
- `SETENV_JVM_MAXIMUM_MEMORY=4096m` - Max heap

**Optimization:** Use G1GC for faster startup:
```yaml
environment:
  - SETENV_JAVA_OPTS=-XX:+UseG1GC -XX:+UseStringDeduplication -XX:MaxGCPauseMillis=200
```

### 2. Disable Unnecessary Features

Add to environment variables:
```yaml
- ATL_TOMCAT_CONTEXTPATH=
- ATL_TOMCAT_PORT=8090
- ATL_TOMCAT_MGMTPORT=8091
# Disable clustering (not needed for local dev)
- ATL_CLUSTER_TYPE=none
# Skip some startup checks
- ATL_SKIP_BACKUP_CHECK=true
```

### 3. Database Connection Pooling

Optimize PostgreSQL for faster connections (already configured in docker-compose.yml):
```yaml
postgres:
  command: >
    postgres
    -c shared_buffers=256MB
    -c effective_cache_size=1GB
    -c max_connections=100
    # ... more optimizations
```

These settings reduce connection overhead and improve query performance.

### 4. Use Healthcheck Timeout

The healthcheck waits 120s (`start_period`), which is appropriate for slow startups.

### 5. Keep Container Running

**Best practice:** Don't stop/start Confluence frequently. Use:
```bash
# Suspend instead of stop (preserves JVM warmup)
docker pause confluence-server
docker unpause confluence-server
```

### 6. Increase Docker Resources

Ensure Docker Desktop has:
- **CPU:** At least 4 cores (8+ recommended)
- **Memory:** At least 8GB (12GB+ recommended)
- **Disk:** SSD preferred

Check: `make check-resources`

### 7. Development Mode Optimizations

Already enabled:
```yaml
- ATL_DEV_MODE=true
```

This disables some production checks.

### 8. Skip Plugin Scanning (Advanced)

For faster startup, you can disable automatic plugin scanning, but this may break some features.

### 9. Use Confluence Data Center (Faster)

Confluence Data Center has better startup performance, but requires a license.

### 10. Pre-warm JVM

Keep Confluence running during development instead of stopping/starting:
```bash
# Instead of: make confluence-stop && make confluence-start
# Use: make confluence-restart  # Faster than stop+start
```

## Expected Startup Times

- **First startup (with setup):** 2-5 minutes
- **Subsequent startups:** 60-120 seconds
- **With optimizations:** 45-90 seconds

## Monitoring Startup

Watch logs in real-time:
```bash
make logs | grep -E "(startup|Starting|Server startup)"
```

## Quick Wins

1. ✅ Increase Docker Desktop resources (CPU/Memory)
2. ✅ Use SSD storage
3. ✅ Keep Confluence running during development
4. ✅ Use `make confluence-restart` instead of stop+start
5. ✅ Enable G1GC (see optimized docker-compose.yml)
