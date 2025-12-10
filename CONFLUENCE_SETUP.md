# Confluence Setup Guide

This plugin connects to an **existing Confluence instance**. You have two options:

## Option 1: Use Confluence Cloud (Easiest) ⭐ Recommended

**Best for:** Quick testing and development

1. **Sign up for Confluence Cloud** (if you don't have access):
   - Go to https://www.atlassian.com/try/cloud
   - Sign up for a free trial (no credit card required for trial)
   - Or use your organization's existing Confluence Cloud instance

2. **Access your Confluence site**:
   - Your site URL will be something like: `https://your-site.atlassian.net`
   - Log in with your account

3. **Install the plugin**:
   - Go to Settings → Manage Apps
   - Click "Upload app" (or "Development" → "Upload app")
   - Enter your tunnel URL: `https://your-tunnel-url.ngrok.io/atlassian-connect.json`
   - Click "Upload"

**That's it!** You can now test the plugin in Confluence Cloud.

---

## Option 2: Run Confluence Server Locally ⭐ For "Real" Setup

**Best for:** Full control, offline development, production-like environment

**👉 See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for complete step-by-step guide**

### Quick Start with Docker

1. **Start Confluence Server**:
   ```bash
   npm run confluence:start
   ```
   Or manually:
   ```bash
   docker-compose up -d confluence
   ```

2. **Access Confluence**:
   - Open http://localhost:8090
   - Complete setup wizard (get evaluation license from Atlassian)
   - Configure for local development (see LOCAL_SETUP.md)

3. **Build and start plugin**:
   ```bash
   npm run build
   npm start
   ```

4. **Install plugin**:
   - Go to Settings → Manage Apps → Upload app
   - Enter: `http://localhost:3000/atlassian-connect.json`

### Manual Installation (Advanced)

If you prefer to install Confluence Server manually:

1. **Download Confluence Server**:
   - Go to https://www.atlassian.com/software/confluence/download
   - Download the installer for your OS

2. **Install and configure**:
   - Follow Atlassian's installation guide: https://confluence.atlassian.com/doc/installing-confluence-on-windows-linux-and-mac-143556824.html
   - Default port: 8090
   - Access at: http://localhost:8090

3. **Set up the plugin**:
   - Same as Docker option above

---

## Quick Comparison

| Feature | Confluence Cloud | Confluence Server (Local) |
|---------|-----------------|--------------------------|
| Setup Time | 5 minutes | 30+ minutes |
| Cost | Free trial | Free (evaluation license) |
| Internet Required | Yes | No (once installed) |
| License | Cloud subscription | Evaluation/Paid license |
| Best For | Quick testing | Full control, offline dev |

---

## Recommended Workflow

**For most developers:** Use Confluence Cloud + tunneling service

1. Use Confluence Cloud (free trial)
2. Run your plugin server locally: `npm start`
3. Expose it via tunnel: `npm run tunnel:ngrok`
4. Install plugin in Cloud using tunnel URL

This is the fastest way to get started!

---

## Troubleshooting

### Confluence Server won't start
- Check if port 8090 is already in use
- Ensure Docker has enough memory allocated (4GB+ recommended)
- Check Docker logs: `docker logs confluence-server`

### Plugin won't install in Server
- Make sure your plugin server is accessible from Confluence
- For localhost, ensure Confluence Server allows HTTP connections
- Check Confluence logs for errors

### Can't access Confluence Cloud
- Verify your account has admin permissions
- Check if your organization has restrictions on app installations
- Contact your Confluence administrator
