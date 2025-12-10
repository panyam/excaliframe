# Troubleshooting Guide

## PostgreSQL Errors During Setup

### "relation does not exist" Errors

**Symptom:** You see many PostgreSQL errors like:
```
ERROR: relation "attachments" does not exist
ERROR: relation "content" does not exist
ERROR: relation "spaces" does not exist
```

**Cause:** This is **normal** during Confluence initialization. Confluence checks for tables before creating them.

**Solution:**
1. **Complete the Confluence setup wizard** - This will create all required tables
2. Go to http://localhost:8090
3. When prompted for database configuration:
   - Database Type: **PostgreSQL**
   - Hostname: `postgres`
   - Port: `5432`
   - Database: `confluence`
   - Username: `confluence`
   - Password: `confluence`
4. Click "Test connection" - should succeed
5. Click "Next" - Confluence will create all tables automatically

**After setup completes:** These errors should stop appearing in logs.

### Database Connection Issues

**Symptom:** Confluence can't connect to PostgreSQL

**Check:**
```bash
# Check if PostgreSQL is running
make status

# Check PostgreSQL logs
make logs-db

# Test connection from Confluence container
docker exec confluence-server curl -s http://localhost:8090/setup/setupstart.action
```

**Solutions:**
1. Ensure PostgreSQL is running: `make confluence-start`
2. Wait for PostgreSQL to be ready (healthcheck passes)
3. Verify database credentials match docker-compose.yml
4. Check network connectivity between containers

## Port Already in Use

**Symptom:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Stop existing process
make stop

# Or kill specific port
make kill-port PORT=3000

# Then start again
make start
```

## Confluence Won't Start

**Symptom:** Confluence container exits or won't start

**Check:**
```bash
# Check status
make status

# View logs
make logs

# Check Docker resources
docker stats confluence-server
```

**Solutions:**
1. **Increase Docker memory:**
   - Docker Desktop → Settings → Resources → Memory
   - Increase to at least 4GB (8GB recommended)

2. **Check port availability:**
   ```bash
   lsof -i :8090  # Confluence
   lsof -i :5432  # PostgreSQL
   ```

3. **Check disk space:**
   ```bash
   df -h
   ```

4. **Reset and start fresh:**
   ```bash
   make reset
   make quick-start
   ```

## Plugin Won't Install

**Symptom:** Can't install plugin in Confluence

**Check connectivity:**
```bash
make test-connectivity
```

**Solutions:**

1. **Use correct URL:**
   - Try: `http://host.docker.internal:3000/atlassian-connect.json`
   - Or: `http://172.17.0.1:3000/atlassian-connect.json`
   - Or: `http://localhost:3000/atlassian-connect.json`

2. **Verify plugin server is running:**
   ```bash
   curl http://localhost:3000/atlassian-connect.json
   ```

3. **Check Confluence can reach plugin:**
   ```bash
   docker exec confluence-server curl http://host.docker.internal:3000/atlassian-connect.json
   ```

4. **Enable development mode** (if available):
   - Settings → Manage Apps → Settings
   - Enable "Development mode"

## Plugin Editor/Renderer Won't Load

**Symptom:** Editor or renderer shows blank/error

**Check:**
1. **Browser console** (F12):
   - Look for JavaScript errors
   - Check Network tab for failed requests

2. **Verify files are built:**
   ```bash
   ls -lh dist/editor.html dist/renderer.html
   ```

3. **Rebuild plugin:**
   ```bash
   make build
   ```

4. **Check CORS/security:**
   - Ensure Confluence allows HTTP connections
   - Check browser console for CORS errors

## Data Not Persisting

**Symptom:** Data lost after restart

**Check:**
```bash
# Verify data directories exist
ls -la data/postgres data/confluence

# Check permissions
ls -ld data/postgres data/confluence
```

**Solutions:**
1. Ensure data directories exist: `make setup-dirs`
2. Check Docker volume mounts in docker-compose.yml
3. Verify data directories have correct permissions

## Performance Issues

**Symptom:** Confluence is slow

**Solutions:**
1. **Increase memory:**
   - Edit docker-compose.yml:
     ```yaml
     environment:
       - SETENV_JVM_MINIMUM_MEMORY=2048m
       - SETENV_JVM_MAXIMUM_MEMORY=4096m
     ```
   - Restart: `make confluence-restart`

2. **Check system resources:**
   ```bash
   docker stats confluence-server confluence-postgres
   ```

3. **Reduce Confluence features:**
   - Disable unused plugins
   - Reduce indexing frequency

## Common Commands for Debugging

```bash
# Check everything
make status

# View all logs
make logs-all

# Test connectivity
make test-connectivity

# Reset everything
make reset

# Check specific service
docker logs confluence-server
docker logs confluence-postgres
docker exec confluence-postgres pg_isready -U confluence
```

## Still Having Issues?

1. **Check logs:**
   ```bash
   make logs-all
   ```

2. **Reset and start fresh:**
   ```bash
   make reset
   make quick-start
   ```

3. **Verify prerequisites:**
   - Docker Desktop running
   - At least 4GB RAM allocated
   - Ports 3000, 5432, 8090 available

4. **Check Confluence documentation:**
   - https://confluence.atlassian.com/doc/troubleshooting-confluence-139283.html
