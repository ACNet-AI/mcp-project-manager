# 🤖 MCP Project Manager

**自动化管理MCP服务器项目的注册、验证和发布** 

一个基于GitHub App的智能项目管理器，专为[MCP（Model Context Protocol）](https://docs.mcp.dev/)服务器生态系统设计。

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Probot](https://img.shields.io/badge/Probot-000000?style=flat&logo=github&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## 🌟 核心功能

### 🔍 **自动化项目验证**
- **项目结构检查**: 验证`pyproject.toml`、`package.json`、`README.md`等文件
- **MCP规范验证**: 确保项目符合MCP服务器标准
- **代码质量检查**: 基本的语法和结构验证
- **文档完整性**: README、配置说明、使用示例检查

### 🚀 **Pull Request自动化**
- **智能评审**: 自动检查新提交的MCP项目
- **反馈生成**: 详细的验证报告和改进建议  
- **自动合并**: 符合标准的项目自动通过审核
- **状态检查**: 集成GitHub Checks API

### 📊 **注册表管理**
- **自动更新**: 从`projects/`目录同步到`registry.json`
- **项目统计**: 语言分布、分类统计、增长趋势
- **版本跟踪**: 自动检测和记录项目版本变化
- **元数据提取**: 从配置文件自动提取项目信息

### 🎯 **GitHub App集成**
- **多事件处理**: Pull Request、Push、Release、Issues
- **智能分类**: 自动添加标签和里程碑
- **通知系统**: 项目状态变更通知
- **模板生成**: 为新仓库自动添加MCP项目模板

## 🏗️ 技术架构

```
mcp-project-manager/
├── src/
│   ├── index.ts                 # 应用入口
│   ├── handlers/                # 事件处理器
│   │   ├── pullRequest.ts      # PR处理
│   │   ├── push.ts             # Push事件
│   │   ├── release.ts          # Release处理
│   │   ├── repository.ts       # 仓库事件
│   │   └── issues.ts           # Issues处理
│   └── utils/                   # 工具模块
│       ├── projectValidator.ts # 项目验证器
│       └── registryManager.ts  # 注册表管理
├── app.yml                      # GitHub App配置
├── package.json                 # 项目配置
├── tsconfig.json               # TypeScript配置
└── vercel.json                 # 部署配置
```

### 🛠️ **技术栈**
- **[Probot](https://probot.github.io/)**: GitHub App开发框架
- **[TypeScript](https://www.typescriptlang.org/)**: 类型安全的JavaScript
- **[Vercel](https://vercel.com/)**: 无服务器部署平台
- **[GitHub API](https://docs.github.com/en/rest)**: 完整的GitHub集成

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone https://github.com/mcp-servers-hub/mcp-project-manager.git
cd mcp-project-manager

# 安装依赖
npm install

# 构建项目
npm run build
```

### 2. GitHub App配置

1. **创建GitHub App**:
   - 访问 [GitHub Apps设置](https://github.com/settings/apps)
   - 使用`app.yml`中的配置创建新应用

2. **配置环境变量**:
   ```bash
   # 复制环境变量模板
   cp .env.template .env
   
   # 填入GitHub App信息
   GITHUB_APP_ID=your_app_id
   GITHUB_PRIVATE_KEY="your_private_key"
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   ```

3. **本地开发**:
   ```bash
   # 启动开发服务器
   npm run dev
   
   # 使用Smee.io进行webhook代理
   npx smee -u https://smee.io/your-unique-url -t http://localhost:3000
   ```

### 3. Vercel部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mcp-servers-hub/mcp-project-manager)

```bash
# 部署到Vercel
vercel --prod

# 配置环境变量
vercel env add GITHUB_APP_ID
vercel env add GITHUB_PRIVATE_KEY
vercel env add GITHUB_WEBHOOK_SECRET
```

## 📋 使用指南

### 项目验证流程

1. **提交PR**: 在`projects/`目录下添加新的MCP项目
2. **自动验证**: GitHub App自动检查项目结构和配置
3. **获得反馈**: 收到详细的验证报告和改进建议
4. **修复问题**: 根据反馈调整项目结构
5. **自动合并**: 通过验证后自动合并到主分支

### 项目结构要求

```
projects/your-mcp-server/
├── pyproject.toml or package.json    # 项目配置（必需）
├── README.md                         # 项目说明（必需）
├── server.py or index.js            # 服务器代码
├── requirements.txt                  # Python依赖（可选）
└── config.yaml                      # 配置文件（可选）
```

### 验证标准

- ✅ **配置文件**: 包含`name`、`version`、`description`字段
- ✅ **README文档**: 包含安装、配置、使用说明
- ✅ **MCP集成**: 使用MCP相关依赖和API
- ✅ **代码质量**: 基本的语法和结构检查

## 🔧 开发指南

### 本地开发

```bash
# 启动开发模式
npm run dev

# 运行测试
npm test

# 代码检查
npm run lint

# 代码格式化
npm run format
```

### 添加新功能

1. **事件处理器**: 在`src/handlers/`中添加新的事件处理逻辑
2. **工具模块**: 在`src/utils/`中添加通用工具函数
3. **测试**: 为新功能添加单元测试
4. **文档**: 更新README和代码注释

### 调试技巧

```bash
# 查看webhook负载
curl -X POST http://localhost:3000/webhooks/github \\
  -H "Content-Type: application/json" \\
  -d @test-payload.json

# 本地测试特定事件
npm run test -- --grep "pull_request"
```

## 📊 功能展示

### Pull Request验证示例

```markdown
## 🔍 项目验证报告

### ✅ 通过检查
- ✅ 包含README.md文件
- ✅ 包含配置文件: pyproject.toml
- ✅ 包含MCP相关依赖
- ✅ README内容充实 (>200字符)

### ⚠️ 改进建议
- ⚠️ 建议添加使用说明
- ⚠️ 建议添加配置说明

### 📋 项目信息
- **语言**: Python
- **分类**: AI/工具
- **版本**: 1.0.0
```

### 注册表自动更新

```json
{
  "name": "MCP Servers Hub",
  "version": "1.0.0",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "projects": [
    {
      "name": "weather-server",
      "description": "获取天气信息的MCP服务器",
      "language": "Python",
      "category": "web",
      "version": "1.2.0",
      "author": "MCP Team",
      "repository": "https://github.com/mcp-servers-hub/mcp-servers-hub/tree/main/projects/weather-server"
    }
  ]
}
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 贡献方式

1. **报告问题**: [创建Issue](https://github.com/mcp-servers-hub/mcp-project-manager/issues)
2. **功能建议**: 提出新功能想法
3. **代码贡献**: 提交Pull Request
4. **文档改进**: 完善项目文档

### 开发流程

1. Fork本仓库
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 创建Pull Request

### 代码规范

- 使用TypeScript进行类型检查
- 遵循ESLint和Prettier配置
- 添加适当的测试覆盖
- 编写清晰的提交信息

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

## 🔗 相关链接

- 📚 [MCP官方文档](https://docs.mcp.dev/)
- 🏠 [MCP服务器生态系统](https://github.com/mcp-servers-hub/mcp-servers-hub)
- 🤖 [Probot文档](https://probot.github.io/docs/)
- ⚡ [Vercel部署指南](https://vercel.com/docs)
- 💬 [社区讨论](https://github.com/mcp-servers-hub/mcp-servers-hub/discussions)

## 📞 支持

遇到问题？我们来帮你！

- 🐛 [报告Bug](https://github.com/mcp-servers-hub/mcp-project-manager/issues)
- 💡 [功能请求](https://github.com/mcp-servers-hub/mcp-project-manager/issues)
- 💬 [社区讨论](https://github.com/mcp-servers-hub/mcp-servers-hub/discussions)
- 📧 [邮件联系](mailto:mcp@example.com)

---

<div align="center">

**让MCP生态系统管理变得简单高效！** 🚀

Made with ❤️ by the MCP Community

</div>
