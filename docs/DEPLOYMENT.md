# Deployment Guide

## Quick Deploy to Vercel

1. **Import Project**
   - Go to [vercel.com](https://vercel.com) → New Project
   - Import: `ACNet-AI/mcp-project-manager`

2. **Set Environment Variables**
   ```
   GITHUB_APP_ID=123456
   GITHUB_CLIENT_ID=Iv1.abc123
   GITHUB_CLIENT_SECRET=your_secret
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   GITHUB_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
   ```

3. **Deploy**
   - Click "Deploy" and wait for completion

4. **Update Webhook URL**
   - Go to [GitHub App Settings](https://github.com/settings/apps/mcp-project-manager)
   - Set Webhook URL: `https://your-app.vercel.app/webhooks`

## Test

```bash
curl https://your-app.vercel.app/health
```

Done! 🎉 