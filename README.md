# 🤖 MCP Project Manager

> **Automated GitHub App for MCP server project management and publishing**

[![CI/CD](https://github.com/ACNet-AI/mcp-project-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/ACNet-AI/mcp-project-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## What is this?

A GitHub App that automates MCP (Model Context Protocol) server project lifecycle:
- **🔄 One-click Publishing**: Create repos and push code automatically
- **📋 Hub Registration**: Auto-register to MCP servers hub
- **🔍 Smart Validation**: Validate project structure and compliance
- **⚡ Event Automation**: Real-time GitHub webhook processing

## Quick Start

### For Users
1. Install the [GitHub App](https://github.com/apps/mcp-project-manager)
2. Use the API to publish projects

### For Developers
```bash
git clone https://github.com/ACNet-AI/mcp-project-manager.git
cd mcp-project-manager
npm install
cp .env.example .env  # Configure your GitHub App
npm run dev
```

## Documentation

| Guide | Purpose |
|-------|---------|
| [Quick Start](docs/QUICK_START.md) | 5-minute setup |
| [API Reference](docs/API.md) | REST API docs |
| [Development](docs/DEVELOPMENT.md) | Contributing guide |
| [Deployment](docs/DEPLOYMENT.md) | Production setup |

## API Example

```bash
curl -X POST https://mcp-project-manager-1234.vercel.app/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "my-mcp-server",
    "description": "My MCP server",
    "version": "1.0.0",
    "language": "python",
    "files": [{"path": "server.py", "content": "# Server code", "message": "Add server"}]
  }'
```

## Tech Stack

- **Node.js 18+** with TypeScript
- **Probot** (GitHub App framework)
- **Vercel** (Serverless deployment)
- **Jest** (Testing with 80%+ coverage)

## Contributing

1. Fork → Create branch → Make changes → Test → Submit PR
2. Follow [Conventional Commits](https://www.conventionalcommits.org/)
3. Maintain test coverage

## License

MIT License - see [LICENSE](LICENSE)

---

<div align="center">
  <p>Built with ❤️ for the MCP community</p>
  <p>
    <a href="https://github.com/ACNet-AI/mcp-project-manager/stargazers">⭐ Star</a> •
    <a href="https://github.com/ACNet-AI/mcp-project-manager/issues">🐛 Issues</a> •
    <a href="https://github.com/ACNet-AI/mcp-project-manager/issues">💡 Features</a>
  </p>
</div>
