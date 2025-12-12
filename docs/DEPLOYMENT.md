# Deployment Guide

For production use, your plugin server needs to be publicly accessible via HTTPS.

## Production Requirements

### What Confluence Needs

1. **Public HTTPS URL** - Confluence must be able to reach your server
2. **Accessible 24/7** - Confluence may call lifecycle endpoints at any time
3. **Valid SSL Certificate** - HTTPS is required (not HTTP)
4. **Stable URL** - The `baseUrl` in `atlassian-connect.json` must remain constant

## Deployment Options

### Option 1: Cloud Platform (Recommended) ⭐

Deploy to a cloud platform that supports Node.js:

#### Heroku
```bash
# Add Procfile
echo "web: node dist/server.js" > Procfile

# Deploy
heroku create excaliframe
git push heroku main
```

#### Railway
```bash
# Connect GitHub repo
# Railway auto-detects Node.js and deploys
```

#### Render
```bash
# Connect GitHub repo
# Set build command: npm run build
# Set start command: node dist/server.js
```

#### Fly.io
```bash
fly launch
fly deploy
```

#### AWS/GCP/Azure
- Use App Service, Cloud Run, or similar
- Deploy Express server
- Point domain to service

### Option 2: VPS/Server

If you have your own server:

1. **Set up Node.js** on the server
2. **Build the plugin:**
   ```bash
   npm run build
   ```
3. **Run with PM2** (process manager):
   ```bash
   npm install -g pm2
   pm2 start dist/server.js --name excaliframe
   pm2 save
   pm2 startup
   ```
4. **Set up Nginx** as reverse proxy:
   ```nginx
   server {
       listen 443 ssl;
       server_name excaliframe.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```
5. **Get SSL certificate** (Let's Encrypt):
   ```bash
   certbot --nginx -d excaliframe.com
   ```

### Option 3: Serverless Functions

For minimal cost, use serverless:

#### AWS Lambda + API Gateway
- Package Express app for Lambda
- Use `serverless-http` or `@vendia/serverless-express`
- Deploy via Serverless Framework

#### Vercel/Netlify Functions
- Convert Express routes to serverless functions
- Deploy static files to CDN
- Use functions for lifecycle endpoints

## Updating for Production

### 1. Update `atlassian-connect.json`

Change `baseUrl` to your production URL:

```json
{
  "baseUrl": "https://excaliframe.com",
  ...
}
```

Or use environment variable in your deployment.

### 2. Build for Production

```bash
# Build optimized production bundle
npm run build

# The dist/ folder contains everything needed
```

### 3. Set Environment Variables

```bash
# Production server
PORT=3000
NODE_ENV=production
```

### 4. Install in Confluence

1. Go to Confluence → Settings → Manage Apps
2. Click "Upload app"
3. Enter: `https://excaliframe.com/confluence/atlassian-connect.json`
4. Click "Upload"

## Production Checklist

- [ ] Server is publicly accessible via HTTPS
- [ ] SSL certificate is valid and not expired
- [ ] `baseUrl` in `atlassian-connect.json` points to production URL
- [ ] Server is running 24/7 (or use a process manager like PM2)
- [ ] Build is optimized (`npm run build` in production mode)
- [ ] Environment variables are set correctly
- [ ] Server logs are monitored
- [ ] Health checks are in place

## Example: Heroku Deployment

### 1. Create Heroku App

```bash
heroku create excaliframe
```

### 2. Add Buildpack

```bash
heroku buildpacks:set heroku/nodejs
```

### 3. Set Environment Variables

```bash
heroku config:set NODE_ENV=production
```

### 4. Update atlassian-connect.json

```json
{
  "baseUrl": "https://excaliframe.herokuapp.com"
}
```

### 5. Deploy

```bash
git push heroku main
```

### 6. Install in Confluence

Use: `https://excaliframe.herokuapp.com/confluence/atlassian-connect.json`

## Custom Domain Setup

If you want `https://excaliframe.com` instead of a platform URL:

1. **Get a domain** (e.g., from Namecheap, Google Domains)
2. **Point DNS** to your hosting:
   - Heroku: Add domain in dashboard, update DNS records
   - Railway/Render: Add custom domain in settings
3. **Update baseUrl** in `atlassian-connect.json`
4. **SSL** is usually handled automatically by the platform

## Monitoring & Maintenance

### Health Checks

Your server should respond to:
- `GET /confluence/atlassian-connect.json` - Should return descriptor
- `GET /excalidraw/editor` - Should return editor page
- `GET /excalidraw/renderer` - Should return renderer page

### Logging

Set up logging to monitor:
- Lifecycle events (installs/uninstalls)
- Errors
- Request patterns

### Updates

When updating the plugin:
1. Build new version: `npm run build`
2. Deploy to server
3. Users may need to reload the app in Confluence (Settings → Manage Apps → Reload)

## Cost Considerations

- **Free tier options**: Heroku (limited), Railway (free tier), Render (free tier)
- **VPS**: ~$5-10/month (DigitalOcean, Linode)
- **Serverless**: Pay per request (very cheap for low traffic)
- **CDN**: Consider CloudFront/Cloudflare for static assets

## Security Notes

- Use HTTPS (required by Confluence)
- Keep dependencies updated
- Use environment variables for secrets (if needed later)
- Consider rate limiting for lifecycle endpoints
- Monitor for abuse

## Quick Start: Railway (Easiest)

1. **Push to GitHub**
2. **Go to Railway.app**
3. **New Project → Deploy from GitHub**
4. **Select your repo**
5. **Railway auto-detects Node.js**
6. **Set build command**: `npm run build`
7. **Set start command**: `node dist/server.js`
8. **Get URL**: `https://your-app.railway.app`
9. **Update `atlassian-connect.json`** baseUrl
10. **Deploy!**

Railway provides:
- ✅ HTTPS automatically
- ✅ Auto-deploy from Git
- ✅ Free tier available
- ✅ Custom domains supported
