# Getting a Confluence Server License

Confluence Server requires a license, but Atlassian provides **free 30-day evaluation licenses** for development and testing.

## Quick Steps

### Option 1: Get Evaluation License (Recommended) ⭐

1. **Go to Atlassian License Center:**
   - Visit: https://my.atlassian.com/products/index?evaluation=true
   - Or directly: https://www.atlassian.com/software/confluence/download-evaluation

2. **Sign in or Create Account:**
   - If you don't have an Atlassian account, create one (free)
   - Use any email address

3. **Request Evaluation License:**
   - Select "Confluence Server"
   - Choose "30-day evaluation"
   - Fill in your details (name, email, company)
   - Click "Generate License"

4. **Copy the License Key:**
   - You'll get a long license key (starts with something like `AAAB...`)
   - Copy the entire key

5. **Enter in Confluence:**
   - Go to http://localhost:8090
   - Paste the license key when prompted
   - Complete the setup wizard

### Option 2: Use Developer License (For Open Source)

If you're developing an open-source plugin:

1. **Apply for Developer License:**
   - Visit: https://www.atlassian.com/software/developer
   - Fill out the application form
   - Usually approved within 24-48 hours
   - Provides free licenses for development

### Option 3: Use Existing License (If You Have One)

If your organization already has a Confluence Server license:
- Contact your Atlassian administrator
- They can provide you with a license key

## Step-by-Step with Screenshots Guide

### 1. Navigate to License Center

Go to: https://my.atlassian.com/products/index?evaluation=true

You'll see a page with various Atlassian products.

### 2. Find Confluence Server

- Look for "Confluence Server" (not Confluence Cloud)
- Click on it or search for it

### 3. Request Evaluation

- Click "Start free trial" or "Get evaluation license"
- Select "30-day evaluation"
- Fill in:
  - Your name
  - Email address
  - Organization name (can be "Personal" or your company)
  - Country

### 4. Get Your License Key

After submitting, you'll receive:
- A license key (long alphanumeric string)
- Email confirmation with the license key
- The key will look like: `AAABAg0ODQoPeNqNkE1PwzAMh...` (much longer)

### 5. Enter License in Confluence

1. **Open Confluence Setup:**
   - Go to http://localhost:8090
   - You should see the license entry screen

2. **Enter License:**
   - Paste the entire license key
   - Click "Next" or "Continue"

3. **Complete Setup:**
   - Follow the remaining setup wizard steps
   - Create an admin account
   - Configure your instance

## Troubleshooting

### License Key Not Working

**Check:**
- Did you copy the entire key? (it's very long)
- No extra spaces before/after
- Using Confluence Server license (not Cloud)

**Solution:**
- Try copying again from the email
- Or regenerate a new evaluation license

### License Expired

**Evaluation licenses last 30 days:**
- Request a new evaluation license
- Or apply for developer license (longer term)

**To check expiration:**
- Go to Settings → General Configuration → License Details
- Shows expiration date

### Can't Access License Center

**If the website is blocked:**
- Use a VPN if needed
- Or request license from a different network
- Contact Atlassian support if issues persist

## License Types Comparison

| License Type | Duration | Cost | Best For |
|-------------|----------|------|----------|
| Evaluation | 30 days | Free | Testing, evaluation |
| Developer | 1 year | Free | Open source development |
| Commercial | Perpetual | Paid | Production use |

## After Getting License

Once you have your license:

1. **Enter it in Confluence** (if not done already)
2. **Complete setup wizard:**
   - Create admin account
   - Set up your first space
   - Configure basic settings

3. **Install your plugin:**
   ```bash
   # Make sure plugin server is running
   npm start
   
   # Then in Confluence:
   # Settings → Manage Apps → Upload app
   # Use: http://host.docker.internal:3000/atlassian-connect.json
   ```

## Quick Links

- **Evaluation License:** https://my.atlassian.com/products/index?evaluation=true
- **Developer License:** https://www.atlassian.com/software/developer
- **License Center:** https://my.atlassian.com
- **Confluence Downloads:** https://www.atlassian.com/software/confluence/download

## Notes

- Evaluation licenses are **free** and **legitimate** for testing
- You can request multiple evaluation licenses if needed
- Developer licenses are better for long-term development
- Commercial licenses are only needed for production deployments
