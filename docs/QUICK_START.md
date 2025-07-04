# ⚡ MCP Project Manager - Quick Start Guide

Get up and running with MCP Project Manager in under 5 minutes.

## 🎯 For Users (Publishing Projects)

### 1. Install GitHub App
Visit [MCP Project Manager](https://github.com/apps/mcp-project-manager) and install to your GitHub account.

### 2. Publish Your First Project
```bash
curl -X POST https://mcp-project-manager.vercel.app/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "my-first-mcp-server",
    "description": "My first MCP server project",
    "version": "1.0.0",
    "language": "python",
    "files": [
      {
        "path": "server.py",
        "content": "#!/usr/bin/env python3\n\nfrom mcp.server import Server\n\napp = Server(\"my-first-mcp-server\")\n\nif __name__ == \"__main__\":\n    app.run()",
        "message": "Add main server file"
      },
      {
        "path": "README.md",
        "content": "# My First MCP Server\n\nA simple MCP server implementation.\n\n## Installation\n\n```bash\npip install -r requirements.txt\n```\n\n## Usage\n\n```bash\npython server.py\n```",
        "message": "Add documentation"
      }
    ]
  }'
```

### 3. Check Result
✅ **Repository Created**: `https://github.com/yourusername/my-first-mcp-server`  
✅ **Auto-registered**: Pull request created in MCP servers hub  
✅ **Ready to Use**: Your MCP server is now available to the community

---

## 🛠️ For Developers (Contributing)

### 1. Clone & Setup
```bash
git clone https://github.com/mcp-servers-hub/mcp-project-manager.git
cd mcp-project-manager
npm install
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your GitHub App credentials
nano .env
```

Required variables:
```bash
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.1234567890abcdef
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_PRIVATE_KEY_PATH=./private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

### 3. Start Development
```bash
# Start dev server
npm run dev

# Run tests
npm test

# Build project
npm run build
```

### 4. Create GitHub App (Development)
1. Go to [GitHub Apps](https://github.com/settings/apps)
2. Click "New GitHub App"
3. Fill in:
   ```
   App name: mcp-project-manager-dev
   Homepage URL: http://localhost:3000
   Webhook URL: http://localhost:3000/api/github/webhooks
   ```
4. Set permissions:
   - Repository: `Contents: Write`, `Issues: Write`, `Pull requests: Write`
   - Account: `Email addresses: Read`
5. Download private key and save as `private-key.pem`

---

## 🚀 For DevOps (Deployment)

### 1. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 2. Set Environment Variables
In Vercel Dashboard, add:
- `GITHUB_APP_ID`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_PRIVATE_KEY` (full key content with `\n`)
- `GITHUB_WEBHOOK_SECRET`
- `NODE_ENV=production`

### 3. Update GitHub App Webhook
Update your GitHub App webhook URL to: `https://your-domain.vercel.app/api/github/webhooks`

---

## 📋 Common Use Cases

### Publish Python MCP Server
```json
{
  "projectName": "weather-mcp-server",
  "description": "MCP server for weather information",
  "version": "1.0.0",
  "language": "python",
  "files": [
    {
      "path": "server.py",
      "content": "# Weather MCP server implementation",
      "message": "Add weather server"
    },
    {
      "path": "requirements.txt",
      "content": "mcp>=0.1.0\nrequests>=2.25.0",
      "message": "Add dependencies"
    }
  ]
}
```

### Publish TypeScript MCP Server
```json
{
  "projectName": "database-mcp-server",
  "description": "MCP server for database operations",
  "version": "1.0.0",
  "language": "typescript",
  "files": [
    {
      "path": "src/index.ts",
      "content": "// Database MCP server implementation",
      "message": "Add database server"
    },
    {
      "path": "package.json",
      "content": "{\n  \"name\": \"database-mcp-server\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": {\n    \"@modelcontextprotocol/sdk\": \"^0.1.0\"\n  }\n}",
      "message": "Add package.json"
    }
  ]
}
```

---

## 🔧 Troubleshooting

### GitHub App Not Responding
- Check webhook URL is accessible
- Verify webhook secret matches
- Check GitHub App permissions

### API Errors
- Ensure all required fields are provided
- Check project name format (lowercase, hyphens)
- Verify authentication credentials

### Development Issues
- Run `npm run type-check` for TypeScript errors
- Check `.env` file configuration
- Verify GitHub App installation

---

## 📚 Next Steps

- **[Full API Documentation](API.md)** - Complete API reference
- **[Development Guide](DEVELOPMENT.md)** - Detailed development setup
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment

---

*Quick Start Guide Version: v1.0*  
*Last Updated: January 15, 2025* 