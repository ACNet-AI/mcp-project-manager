# 🚀 MCP Project Manager - Deployment Guide

## Production Deployment

### Prerequisites
- **GitHub App**: Production-ready GitHub App with proper permissions
- **Vercel Account**: For serverless deployment
- **Domain**: Custom domain (optional but recommended)

---

## Vercel Deployment

### 1. Initial Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Login and link project
vercel login
vercel link
```

### 2. Environment Variables

Set the following environment variables in Vercel Dashboard:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.1234567890abcdef
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Production Configuration
NODE_ENV=production
LOG_LEVEL=info
```

**Important**: Use the full private key content (with `\n` for line breaks) in `GITHUB_PRIVATE_KEY`, not a file path.

### 3. Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

### 4. Custom Domain (Optional)

```bash
# Add custom domain
vercel domains add your-domain.com
vercel alias your-deployment-url.vercel.app your-domain.com
```

---

## GitHub App Configuration

### Production GitHub App Setup

1. **Create Production App**:
   - Go to [GitHub Apps](https://github.com/settings/apps)
   - Click "New GitHub App"
   - Use production domain for URLs

2. **App Configuration**:
   ```
   App name: mcp-project-manager
   Homepage URL: https://your-domain.com
   Webhook URL: https://your-domain.com/api/github/webhooks
   ```

3. **Permissions**:
   - Repository: `Contents: Write`, `Issues: Write`, `Metadata: Read`, `Pull requests: Write`
   - Account: `Email addresses: Read`

4. **Events**:
   - Issues: `opened`, `closed`
   - Pull requests: `opened`, `closed`
   - Push: `repository`

### Update Webhook URL

After deployment, update your GitHub App webhook URL:
1. Go to your GitHub App settings
2. Update Webhook URL to: `https://your-domain.vercel.app/api/github/webhooks`
3. Save changes

---

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `GITHUB_APP_ID` | GitHub App ID | ✅ | `123456` |
| `GITHUB_CLIENT_ID` | GitHub App Client ID | ✅ | `Iv1.1234567890abcdef` |
| `GITHUB_CLIENT_SECRET` | GitHub App Client Secret | ✅ | `your_client_secret` |
| `GITHUB_PRIVATE_KEY` | GitHub App Private Key | ✅ | `-----BEGIN RSA...` |
| `GITHUB_WEBHOOK_SECRET` | Webhook Secret | ✅ | `your_webhook_secret` |
| `NODE_ENV` | Environment | ✅ | `production` |
| `LOG_LEVEL` | Logging Level | ❌ | `info` |
| `MCP_HUB_REPO` | MCP Hub Repository | ❌ | `ACNet-AI/mcp-servers-hub` |

---

## Security Best Practices

### 1. Private Key Management
- **Never commit private keys to version control**
- Store private key securely in environment variables
- Use Vercel's encrypted environment variables
- Rotate keys regularly

### 2. Webhook Security
- Use a strong, random webhook secret
- Validate webhook signatures
- Implement rate limiting
- Monitor webhook events

### 3. Permissions
- Grant minimum required permissions
- Review GitHub App permissions regularly
- Monitor app installations
- Implement proper error handling

---

## Monitoring & Observability

### 1. Logging
```typescript
// Production logging configuration
const logger = getLogger('production', {
  level: 'info',
  format: 'json',
  transports: ['console']
});
```

### 2. Error Tracking
Integrate with error tracking services:
- **Sentry**: For error monitoring
- **LogRocket**: For session replay
- **Datadog**: For APM

### 3. Health Checks
Monitor these endpoints:
- `GET /health` - Basic health check
- `GET /api/status` - Service status
- `GET /api/info` - App information

---

## Scaling Considerations

### 1. Rate Limiting
GitHub API has rate limits:
- **Primary rate limit**: 5,000 requests per hour
- **Secondary rate limit**: 100 requests per minute
- Implement exponential backoff

### 2. Concurrent Processing
```typescript
// Limit concurrent operations
const pLimit = require('p-limit');
const limit = pLimit(5); // Max 5 concurrent operations

const results = await Promise.all(
  tasks.map(task => limit(() => processTask(task)))
);
```

### 3. Database Considerations
For high-volume usage, consider:
- Redis for caching
- PostgreSQL for persistent data
- Connection pooling

---

## Backup & Recovery

### 1. Configuration Backup
- Export GitHub App configuration
- Document environment variables
- Store private keys securely

### 2. Monitoring Alerts
Set up alerts for:
- Deployment failures
- High error rates
- API rate limit exceeded
- Webhook failures

---

## Troubleshooting

### Common Production Issues

**1. Webhook Not Receiving Events**
- Check webhook URL accessibility
- Verify webhook secret matches
- Check GitHub App event subscriptions

**2. GitHub API Rate Limits**
- Implement exponential backoff
- Use conditional requests
- Cache responses when possible

**3. Private Key Issues**
- Ensure proper key format in environment variables
- Check for newline characters (`\n`)
- Verify key permissions

### Debug Commands

```bash
# Check deployment status
vercel ls

# View deployment logs
vercel logs your-deployment-url.vercel.app

# Test webhook endpoint
curl -X POST https://your-domain.com/api/github/webhooks \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## Performance Optimization

### 1. Cold Start Mitigation
- Keep functions warm with scheduled requests
- Minimize bundle size
- Use efficient imports

### 2. Caching Strategy
```typescript
// Cache GitHub API responses
const cache = new Map();

async function getCachedData(key: string, fetcher: () => Promise<any>) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const data = await fetcher();
  cache.set(key, data);
  return data;
}
```

### 3. Bundle Optimization
- Use tree shaking
- Minimize dependencies
- Implement code splitting

---

## Maintenance

### Regular Tasks
- **Weekly**: Review error logs and performance metrics
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and rotate secrets
- **Annually**: Review GitHub App permissions and configuration

### Update Process
1. Test changes in staging environment
2. Deploy to production during low-traffic periods
3. Monitor for errors post-deployment
4. Have rollback plan ready

---

*Deployment Guide Version: v1.0*  
*Last Updated: January 15, 2025* 