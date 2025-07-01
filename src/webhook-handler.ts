import { 
  getRepoInfo, 
  createIssue, 
  createComment, 
  getFileContent,
  reportError
} from './utils/github-utils';

/**
 * 统一的Webhook事件处理器
 * 合并所有事件处理逻辑，减少代码重复
 */
export class WebhookHandler {
  
  /**
   * 处理Issues事件
   */
  async handleIssues(context: any) {
    const { action, issue } = context.payload;
    
    context.log.info(`🐛 Issues事件: ${action} - ${issue.title}`);
    
    try {
      switch (action) {
        case 'opened':
          await this.handleIssueOpened(context);
          break;
        case 'labeled':
          await this.handleIssueLabeled(context);
          break;
        default:
          context.log.info(`ℹ️ 忽略Issues动作: ${action}`);
      }
    } catch (error) {
      await reportError(context, `处理Issues事件(${action})`, error, false);
    }
  }
  
  /**
   * 处理Pull Request事件  
   */
  async handlePullRequest(context: any) {
    const { action, pull_request: pr } = context.payload;
    
    context.log.info(`🔀 PR事件: ${action} - ${pr.title} (#${pr.number})`);
    
    try {
      switch (action) {
        case 'opened':
        case 'synchronize':
          await this.handlePRValidation(context);
          break;
        case 'closed':
          if (pr.merged) {
            await this.handlePRMerged(context);
          }
          break;
        default:
          context.log.info(`ℹ️ 忽略PR动作: ${action}`);
      }
    } catch (error) {
      await reportError(context, `处理PR事件(${action})`, error, false);
    }
  }
  
  /**
   * 处理Push事件
   */
  async handlePush(context: any) {
    const { ref, commits } = context.payload;
    
    // 只处理主分支推送
    if (!ref.endsWith('/main') && !ref.endsWith('/master')) {
      return;
    }
    
    context.log.info(`📤 Push事件: ${commits.length}个提交到${ref}`);
    
    try {
      await this.handleMainBranchPush(context);
    } catch (error) {
      await reportError(context, '处理Push事件', error, true);
    }
  }
  
  /**
   * 处理Release事件
   */
  async handleRelease(context: any) {
    const { action, release } = context.payload;
    
    context.log.info(`🚀 Release事件: ${action} - ${release.tag_name}`);
    
    try {
      if (action === 'published') {
        await this.handleReleasePublished(context);
      }
    } catch (error) {
      await reportError(context, `处理Release事件(${action})`, error, true);
    }
  }
  
  /**
   * 处理Repository事件
   */
  async handleRepository(context: any) {
    const { action } = context.payload;
    
    context.log.info(`📁 Repository事件: ${action}`);
    
    try {
      if (action === 'created') {
        await this.handleRepositoryCreated(context);
      }
    } catch (error) {
      await reportError(context, `处理Repository事件(${action})`, error, false);
    }
  }
  
  // =============
  // 私有方法实现
  // =============
  
  /**
   * 处理新Issue创建
   */
  private async handleIssueOpened(context: any) {
    const { issue } = context.payload;
    
    // 检查是否是项目提交请求
    if (issue.title.toLowerCase().includes('添加项目') || 
        issue.title.toLowerCase().includes('新增项目')) {
      
      await createComment(
        context,
        issue.number,
        `👋 感谢您想要添加新的MCP项目！

请按照以下步骤提交您的项目：

1. **Fork** 本仓库
2. 在 \`projects/\` 目录下创建您的项目文件夹
3. 添加必要的配置文件 (\`package.json\`, \`README.md\` 等)
4. 提交 **Pull Request**

我们的自动化系统会验证您的项目并自动合并。

参考: [项目提交指南](../blob/main/CONTRIBUTING.md)`
      );
    }
  }
  
  /**
   * 处理Issue标签变更
   */
  private async handleIssueLabeled(context: any) {
    const payload = context.payload as any;
    const { issue, label } = payload;
    
    if (label?.name === 'help-wanted') {
      await createComment(
        context,
        issue.number,
        `🆘 **寻求帮助**

这个问题已标记为寻求帮助。如果您能提供协助，请：

1. 留言说明您的想法
2. 如果需要更多信息，请直接询问
3. 准备好后可以开始工作

感谢您对MCP生态系统的贡献！🎉`
      );
    }
  }
  
  /**
   * 处理PR验证
   */
  private async handlePRValidation(context: any) {
    const { pull_request: pr } = context.payload;
    const { owner, repo } = getRepoInfo(context);
    
    // 获取变更文件
    const files = await context.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number
    });
    
    const changedFiles = files.data.map((file: any) => file.filename);
    
    // 检查是否是新项目
    const hasNewProject = changedFiles.some((file: any) => 
      file.startsWith('projects/') && file.includes('/')
    );
    
    if (hasNewProject) {
      await this.validateNewProject(context, changedFiles);
    } else if (changedFiles.includes('registry.json')) {
      await this.validateRegistryUpdate(context);
    } else {
      await this.handleGeneralPR(context);
    }
  }
  
  /**
   * 验证新项目
   */
  private async validateNewProject(context: any, changedFiles: string[]) {
    const { pull_request: pr } = context.payload;
    
    // 提取项目名
    const projectFiles = changedFiles.filter(file => file.startsWith('projects/'));
    const projectName = projectFiles[0]?.split('/')[1];
    
    if (!projectName) {
      await createComment(
        context,
        pr.number,
        "❌ **无法识别项目名称**\n\n请确保项目文件位于 `projects/{项目名}/` 目录下。"
      );
      return;
    }
    
    // 简化的项目验证
    const validation = await this.validateProjectStructure(context, projectName, pr.head.sha);
    
    if (validation.isValid) {
      await createComment(
        context,
        pr.number,
        `✅ **项目验证通过: ${projectName}**\n\n项目符合所有要求，将自动合并！🎉`
      );
      await this.autoMergePR(context);
    } else {
      const errorList = validation.errors.map(e => `- ❌ ${e}`).join('\n');
      await createComment(
        context,
        pr.number,
        `❌ **项目验证失败: ${projectName}**\n\n请修复以下问题：\n\n${errorList}`
      );
    }
  }
  
  /**
   * 简化的项目结构验证
   */
  private async validateProjectStructure(context: any, projectName: string, sha: string) {
    const errors: string[] = [];
    
    try {
      // 检查package.json
      const packageJsonContent = await getFileContent(context, `projects/${projectName}/package.json`, sha);
      if (!packageJsonContent) {
        errors.push('缺少 package.json 文件');
      } else {
        try {
          const packageJson = JSON.parse(packageJsonContent);
          if (!packageJson.name) errors.push('package.json 缺少 name 字段');
          if (!packageJson.description) errors.push('package.json 缺少 description 字段');
        } catch {
          errors.push('package.json 格式错误');
        }
      }
      
      // 检查README.md
      const readmeContent = await getFileContent(context, `projects/${projectName}/README.md`, sha);
      if (!readmeContent) {
        errors.push('缺少 README.md 文件');
      }
      
    } catch (error) {
      errors.push(`验证过程出错: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * 验证注册表更新
   */
  private async validateRegistryUpdate(context: any) {
    const { pull_request: pr } = context.payload;
    
    // 简化的注册表验证
    const registryContent = await getFileContent(context, 'registry.json', pr.head.sha);
    
    if (!registryContent) {
      await createComment(context, pr.number, "❌ **无法读取registry.json文件**");
      return;
    }
    
    try {
      JSON.parse(registryContent);
      await createComment(context, pr.number, "✅ **注册表格式验证通过**\n\n可以合并。");
      await this.autoMergePR(context);
    } catch {
      await createComment(context, pr.number, "❌ **registry.json格式错误**\n\n请检查JSON格式。");
    }
  }
  
  /**
   * 处理一般PR
   */
  private async handleGeneralPR(context: any) {
    const { pull_request: pr } = context.payload;
    
    await createComment(
      context,
      pr.number,
      `👋 **感谢您的贡献！**

您的PR已收到并正在审核中。

如果您是在添加新的MCP服务器项目，请确保项目位于 \`projects/{项目名}/\` 目录。

感谢您对MCP生态系统的贡献！🎉`
    );
  }
  
  /**
   * 自动合并PR
   */
  private async autoMergePR(context: any) {
    const { pull_request: pr } = context.payload;
    const { owner, repo } = getRepoInfo(context);
    
    try {
      await context.octokit.pulls.merge({
        owner,
        repo,
        pull_number: pr.number,
        commit_title: `🤖 自动合并: ${pr.title}`,
        commit_message: "通过自动验证，已自动合并。",
        merge_method: "squash"
      });
      
      context.log.info(`✅ PR #${pr.number} 已自动合并`);
    } catch (error) {
      context.log.error("❌ 自动合并失败:", error);
    }
  }
  
  /**
   * 处理PR合并
   */
  private async handlePRMerged(context: any) {
    const { pull_request: pr } = context.payload;
    context.log.info(`✅ PR已合并: ${pr.title}`);
  }
  
  /**
   * 处理主分支推送
   */
  private async handleMainBranchPush(context: any) {
    const { commits } = context.payload;
    context.log.info(`📝 主分支收到${commits.length}个新提交`);
  }
  
  /**
   * 处理Release发布
   */
  private async handleReleasePublished(context: any) {
    const { release } = context.payload;
    
    await createIssue(
      context,
      `🎉 新版本发布: ${release.tag_name}`,
      `新版本 **${release.tag_name}** 已发布！

## 发布信息
- **版本**: ${release.tag_name}
- **发布时间**: ${release.published_at}
- **发布者**: @${release.author?.login}

## 更新内容
${release.body || '暂无更新说明'}

---
*此Issue由自动化系统创建*`,
      ['release', 'announcement']
    );
  }
  
  /**
   * 处理仓库创建
   */
  private async handleRepositoryCreated(context: any) {
    const { repository } = context.payload;
    context.log.info(`🎉 新仓库创建: ${repository.full_name}`);
  }
} 