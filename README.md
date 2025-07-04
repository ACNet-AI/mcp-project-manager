# 🤖 MCP Project Manager

> **Automated GitHub App for MCP server project management and publishing**

[![CI/CD](https://github.com/mcp-servers-hub/mcp-project-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/mcp-servers-hub/mcp-project-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## 🚀 What is MCP Project Manager?

MCP Project Manager is a GitHub App that automates the entire lifecycle of MCP (Model Context Protocol) server projects:

- **🔄 Automated Publishing**: One-click repository creation and code publishing
- **📋 Smart Registration**: Automatic registration to MCP servers hub
- **🔍 Project Validation**: Intelligent project structure and code validation
- **⚡ Webhook Integration**: Real-time event processing and automation

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Repository Creation** | Automatically create GitHub repositories with proper structure |
| **Code Publishing** | Push project files with intelligent commit messages |
| **Hub Registration** | Auto-register projects to MCP servers hub via pull requests |
| **Project Validation** | Validate project structure, dependencies, and compliance |
| **Multi-language Support** | Support for Python, TypeScript, and JavaScript projects |
| **Webhook Automation** | Process GitHub events for continuous project management |

## 🎯 Quick Start

### For Users
1. **Install the App**: Visit [MCP Project Manager](https://github.com/apps/mcp-project-manager)
2. **Grant Permissions**: Install to your GitHub account/organization
3. **Publish Projects**: Use the API or create issues to trigger automation

### For Developers
1. **Clone Repository**: `git clone https://github.com/mcp-servers-hub/mcp-project-manager.git`
2. **Setup Environment**: Copy `.env.example` to `.env` and configure
3. **Install Dependencies**: `npm install`
4. **Start Development**: `npm run dev`

## 📚 Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| **[Quick Start Guide](docs/QUICK_START.md)** | Get started in 5 minutes | Everyone |
| **[API Reference](docs/API.md)** | REST API endpoints and usage | Developers & Integrators |
| **[Development Guide](docs/DEVELOPMENT.md)** | Setup, coding standards, testing | Contributors |
| **[Deployment Guide](docs/DEPLOYMENT.md)** | Production deployment steps | DevOps & Maintainers |

## 🔧 API Usage

### Publish a Project
```bash
curl -X POST https://your-domain.vercel.app/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "my-mcp-server",
    "description": "My awesome MCP server",
    "version": "1.0.0",
    "language": "python",
    "files": [
      {
        "path": "server.py",
        "content": "# MCP server implementation",
        "message": "Add main server file"
      }
    ]
  }'
```

### Check Service Status
```bash
curl https://your-domain.vercel.app/api/status
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub App    │    │  Webhook Events │    │   API Server    │
│                 │◄───┤                 ├───►│                 │
│ • Authentication│    │ • Issues        │    │ • /api/publish  │
│ • Permissions   │    │ • Pull Requests │    │ • /api/status   │
│ • Installation  │    │ • Push Events   │    │ • /health       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │ GitHub Utils    │              │
         └─────────────►│                 │◄─────────────┘
                        │ • Repo Creation │
                        │ • File Upload   │
                        │ • PR Management │
                        └─────────────────┘
```

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Probot (GitHub App framework)
- **Deployment**: Vercel (Serverless)
- **Testing**: Jest with 80%+ coverage
- **CI/CD**: GitHub Actions

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'feat: add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Standards
- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Maintain 80%+ test coverage
- Use TypeScript strict mode
- Pass all CI/CD checks

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- **[MCP Servers Hub](https://github.com/ACNet-AI/mcp-servers-hub)** - Official MCP server registry
- **[MCP SDK](https://github.com/modelcontextprotocol/sdk)** - Model Context Protocol SDK
- **[Probot](https://github.com/probot/probot)** - GitHub App framework

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/mcp-servers-hub/mcp-project-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mcp-servers-hub/mcp-project-manager/discussions)
- **Documentation**: [Project Wiki](https://github.com/mcp-servers-hub/mcp-project-manager/wiki)

---

<div align="center">
  <p>Built with ❤️ for the MCP community</p>
  <p>
    <a href="https://github.com/mcp-servers-hub/mcp-project-manager/stargazers">⭐ Star us on GitHub</a> •
    <a href="https://github.com/mcp-servers-hub/mcp-project-manager/issues">🐛 Report Bug</a> •
    <a href="https://github.com/mcp-servers-hub/mcp-project-manager/issues">💡 Request Feature</a>
  </p>
</div>
