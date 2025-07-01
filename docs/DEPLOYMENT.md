# 部署指南 - 连接现有GitHub App

## 前提条件
✅ GitHub App已创建: [MCP Project Manager](https://github.com/apps/mcp-project-manager)  
✅ 代码开发完成  
🔲 需要配置部署

## 步骤1: 获取GitHub App配置信息

访问 GitHub App 设置页面：
```
https://github.com/settings/apps/mcp-project-manager
```

### 需要获取的信息：
1. **App ID**: 在设置页面顶部显示
2. **Client ID**: 在 OAuth 部分显示
3. **Client Secret**: 点击"Generate a new client secret"生成
4. **Private Key**: 点击"Generate a private key"下载 `.pem` 文件
5. **Webhook Secret**: 在 Webhooks 部分设置一个安全密钥

## 步骤2: 安全存储私钥

### ⚠️ 重要：私钥管理安全原则
- **绝不要**将私钥文件放在项目代码中
- **绝不要**提交私钥到Git仓库
- **使用环境变量**存储私钥内容

### 2.1 处理私钥文件
下载的 `private-key.pem` 文件内容看起来像这样：
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
[很长的base64编码内容]
...
-----END RSA PRIVATE KEY-----
```

### 2.2 本地开发环境变量
创建 `.env` 文件：
```env
APP_ID=你的App_ID
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
WEBHOOK_SECRET=你设置的webhook密钥
GITHUB_CLIENT_ID=你的Client_ID
GITHUB_CLIENT_SECRET=你的Client_Secret
NODE_ENV=development
```

**注意**: 私钥中的换行符需要用 `\n` 替换

## 步骤3: 更新代码以使用环境变量

需要修改代码以从环境变量读取私钥而不是文件：

### 3.1 更新 src/index.ts
```typescript
import { Probot } from "probot";

export = (app: Probot) => {
  // 从环境变量读取私钥
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }
  
  // 其他代码保持不变...
};
```

## 步骤4: 安装依赖和构建

```bash
npm install
npm run build
```

## 步骤5: 部署到Vercel

### 5.1 安装Vercel CLI
```bash
npm install -g vercel
```

### 5.2 配置Vercel环境变量
```bash
# 设置基本变量
vercel env add APP_ID
vercel env add WEBHOOK_SECRET
vercel env add GITHUB_CLIENT_ID
vercel env add GITHUB_CLIENT_SECRET

# 设置私钥（重要：复制完整的私钥内容包括BEGIN和END行）
vercel env add PRIVATE_KEY
```

当提示输入 `PRIVATE_KEY` 时，粘贴完整的私钥内容，包括：
```
-----BEGIN RSA PRIVATE KEY-----
[私钥内容]
-----END RSA PRIVATE KEY-----
```

### 5.3 部署
```bash
vercel --prod
```

## 步骤6: 更新GitHub App Webhook URL

部署完成后，Vercel会提供一个URL，例如：
```
https://mcp-project-manager.vercel.app
```

返回GitHub App设置页面，更新Webhook URL为：
```
https://mcp-project-manager.vercel.app/api/github/webhooks
```

## 步骤7: 安装到仓库

访问以下URL安装GitHub App到您的组织/仓库：
```
https://github.com/apps/mcp-project-manager/installations/new
```

选择要管理的仓库（建议先选择 `mcp-servers-hub` 仓库进行测试）。

## 步骤8: 测试验证

### 8.1 检查Webhook接收
在GitHub App设置页面的"Advanced"标签中，可以查看Webhook日志。

### 8.2 创建测试事件
在安装了App的仓库中：
1. 创建一个Issue - 应该触发自动标签
2. 创建一个Pull Request - 应该触发项目验证
3. Push代码 - 应该触发注册表更新

### 8.3 查看日志
在Vercel控制台中查看函数执行日志，确认事件正常处理。

## 私钥管理最佳实践

### ✅ 推荐做法
1. **环境变量存储**: 在Vercel/Heroku等平台使用环境变量
2. **密钥管理服务**: 使用AWS Secrets Manager、Azure Key Vault等
3. **本地开发**: 使用 `.env` 文件，但确保在 `.gitignore` 中
4. **定期轮换**: 定期生成新的私钥
5. **权限最小化**: 只给必要的最小权限

### ❌ 绝对不要做
1. **提交到Git**: 即使是私有仓库也不要提交私钥
2. **硬编码**: 不要直接写在代码中
3. **明文存储**: 不要以明文形式存储在任何地方
4. **共享**: 不要通过聊天工具、邮件等方式分享私钥
5. **日志输出**: 不要在日志中打印私钥内容

## 故障排除

### 常见问题：
1. **私钥格式错误**: 确保包含完整的BEGIN和END行
2. **换行符问题**: 在环境变量中使用 `\n` 替换实际换行符
3. **权限错误**: 确认GitHub App权限设置正确

### 调试方法：
1. 查看Vercel函数日志
2. 检查GitHub App Webhook日志
3. 使用环境变量验证私钥是否正确读取

## 安全注意事项
- ⚠️ **绝不要**提交私钥文件到Git
- ⚠️ **绝不要**在代码中硬编码私钥
- ⚠️ **定期轮换**私钥和其他密钥
- ⚠️ **监控访问**定期检查GitHub App的使用情况
- ⚠️ **限制权限**只授予必要的最小权限 