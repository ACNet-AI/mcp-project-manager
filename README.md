# MCP Project Manager

> 🚀 **Simplified GitHub Repository Creation API + MCP Project Automation Management**  

## ✨ Core Features

- **Unified Authentication** - Only need one `installation-id`, automatically select the most suitable Token
- **Smart Creation** - Personal repositories use OAuth Token, organization repositories use Installation Token
- **MCP Integration** - Automatically detect and register MCP Factory projects
- **Serverless** - Perfect compatibility with Vercel and other serverless environments

## 🚀 Quick Start

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ACNet-AI/mcp-project-manager)

### Environment Variables Configuration

```bash
# GitHub App Configuration (Required)
APP_ID=your-github-app-id
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# OAuth Configuration (Personal repository support, optional)
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret

# Redis Configuration (Token storage, recommend Upstash)
KV_REST_API_URL=https://your-redis-url
KV_REST_API_TOKEN=your-redis-token
```

### GitHub App Setup

1. Create GitHub App: https://github.com/settings/apps/new
2. Permission settings: Repository (Contents: Write, Metadata: Read)
3. Enable OAuth: "Request user authorization during installation"
4. Callback URL: `https://your-domain.vercel.app/api/github/callback`

## 📚 API Usage

### 1. Start Installation

```bash
curl "https://your-domain.vercel.app/api/github/install?project_name=my-project"
```

Returns `install_url`, visit to complete GitHub App installation and get `installation-id`

### 2. Create Repository

**Personal Repository:**
```bash
curl -X POST "https://your-domain.vercel.app/api/publish" \
  -H "Content-Type: application/json" \
  -H "installation-id: 12345678" \
  -d '{
    "name": "my-repo",
    "description": "My project",
    "private": false
  }'
```

**Organization Repository:**
```bash
curl -X POST "https://your-domain.vercel.app/api/publish" \
  -H "Content-Type: application/json" \
  -H "installation-id: 12345678" \
  -d '{
    "name": "team-repo",
    "description": "Team project",
    "owner": "my-organization",
    "private": true
  }'
```

### Success Response

```json
{
  "success": true,
  "repository": {
    "id": 123456789,
    "name": "my-repo",
    "full_name": "username/my-repo",
    "html_url": "https://github.com/username/my-repo",
    "clone_url": "https://github.com/username/my-repo.git"
  },
  "auth_method": "user_token",
  "message": "Repository created successfully"
}
```

## 🤖 MCP Factory Features

When you push MCP Factory projects, the system will:

1. **Auto Detection** - Identify MCP Factory project structure
2. **Quality Validation** - Check project files and configuration
3. **Auto Registration** - High-quality projects automatically register to MCP Hub
4. **Create Feedback** - Provide detailed feedback in GitHub Issues

## 🔧 Local Development

```bash
# Clone project
git clone https://github.com/ACNet-AI/mcp-project-manager
cd mcp-project-manager

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env file

# Start development
npm run dev
```

## 📊 API Endpoints

| Endpoint | Method | Function |
|----------|--------|----------|
| `/api/publish` | POST | Create repository |
| `/api/github/install` | GET | Start installation |
| `/api/health` | GET | Health check |
| `/api/check-env` | GET | Environment check |

## 🔒 Security Features

- OAuth Token securely stored in Redis (30 days valid)
- Installation Token generated on demand (no storage)
- Principle of least privilege
- HTTPS encrypted transmission

## 📄 License

MIT License

## 🔗 Related Links

- **GitHub App**: https://github.com/apps/mcp-project-manager
- **MCP Servers Hub**: https://github.com/ACNet-AI/mcp-servers-hub
- **Technical Architecture**: [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md)

---

**Status**: ✅ Production Ready | **Version**: 1.0.0 | **Updated**: July 24, 2025
