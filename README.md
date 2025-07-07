# MCP Project Manager

> 🚀 **Intelligent MCP Server Project Management and Publishing Platform**  
> A GitHub App built with [Probot](https://github.com/probot/probot) that provides automated management, validation, and publishing features for Model Context Protocol (MCP) server projects.

## ✨ Core Features

### 🔍 Intelligent Project Detection
- **Automatic Recognition** of MCP server projects (based on dependency analysis)
- **Project Quality Assessment** using multi-dimensional scoring system
- **Structure Validation** checking package.json, README and other key files
- **Real-time Monitoring** listening to GitHub repository changes

### 🤖 Automated Workflows
- **Push Event Processing** automatically validates projects on main branch updates
- **Pull Request Integration** provides project improvement suggestions and validation results
- **Release Management** automatically updates registration information on version releases
- **Issue Tracking** automatically creates project status and improvement suggestions

### 🌐 MCP Hub Integration
- **One-click Registration** automatically registers qualified projects to MCP Hub
- **Information Synchronization** real-time updates of project information to registry
- **Version Management** automated version release and update processes

### 📡 External API
- **Publishing Interface** `/api/publish` - supports external system calls
- **Project Validation** provides project quality check API
- **Status Query** supports project registration status queries

## 🚀 Quick Start

### Requirements
- Node.js 18+
- GitHub App permissions configuration

### Installation & Deployment

```bash
# 1. Clone the project
git clone https://github.com/ACNet-AI/mcp-project-manager
cd mcp-project-manager

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Configure environment variables
cp .env.example .env
# Edit .env file to configure GitHub App information

# 5. Start the service
npm start
```

### Environment Variables Configuration

```bash
# GitHub App Configuration
GITHUB_APP_ID=your_app_id
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nyour_private_key_content\n-----END RSA PRIVATE KEY-----"

# Production Environment Configuration
NODE_ENV=production
```

## 🐳 Docker Deployment

```bash
# 1. Build image
docker build -t mcp-project-manager .

# 2. Run container
docker run -d \
  -e GITHUB_APP_ID=<app-id> \
  -e GITHUB_PRIVATE_KEY=<pem-value> \
  -e GITHUB_WEBHOOK_SECRET=<webhook-secret> \
  -p 3000:3000 \
  mcp-project-manager
```

## ☁️ Vercel Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ACNet-AI/mcp-project-manager)

1. Click the button above or manually import the project to Vercel
2. Configure environment variables (same as above)
3. Update GitHub App Webhook URL after deployment completion

## 🧪 Development & Testing

```bash
# Run tests
npm test

# Test coverage report
npm run test:coverage

# Type checking
npm run build

# Development mode
npm run dev
```

### Test Coverage
- **Overall Coverage**: 89.28% 🎯
- **Statement Coverage**: 89.28%
- **Branch Coverage**: 81.81%
- **Function Coverage**: 100% ✅
- **Line Coverage**: 89.28%

## 📚 API Documentation

### POST `/api/publish`
Publish MCP project to GitHub and register to Hub

```javascript
// Request example
{
  "projectName": "my-mcp-server",
  "description": "An excellent MCP server",
  "version": "1.0.0",
  "language": "typescript",
  "category": "utility",
  "tags": ["automation", "api"],
  "files": [
    {
      "path": "package.json",
      "content": "{ ... }",
      "message": "Add package configuration"
    }
  ]
}

// Response example
{
  "success": true,
  "repoUrl": "https://github.com/user/my-mcp-server",
  "registrationUrl": "https://hub.mcp.org/servers/my-mcp-server"
}
```

## 🤝 Contributing

We welcome all forms of contributions!

1. **Fork** this repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Create** a Pull Request

For detailed information, please check the [Contributing Guide](CONTRIBUTING.md).

## 📄 License

This project is licensed under the [MIT](LICENSE) License © 2025 ACNet AI

## 🔗 Related Links

- [MCP Official Documentation](https://modelcontextprotocol.io/)
- [Probot Framework Documentation](https://probot.github.io/)
- [MCP Factory](https://github.com/ACNet-AI/mcp-factory) - Factory framework for MCP server creation and management
- [MCP Servers Hub](https://github.com/ACNet-AI/mcp-servers-hub) - Community registry for discovering and sharing MCP server projects


---

⭐ If this project helps you, please give us a Star!
