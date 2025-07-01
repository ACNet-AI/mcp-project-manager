import { Probot } from "probot";
import { WebhookHandler } from "./webhook-handler";

/**
 * MCP项目管理器
 * 自动化管理MCP服务器项目的注册、验证和发布流程
 */
export default (app: Probot) => {
  app.log.info("🚀 MCP项目管理器启动中...");

  // 创建统一的事件处理器实例
  const webhookHandler = new WebhookHandler();

  /**
   * Issues事件处理
   * - 项目支持和反馈
   * - 自动化问题分类
   */
  app.on("issues.opened", async (context) => {
    await webhookHandler.handleIssues(context);
  });
  
  app.on("issues.labeled", async (context) => {
    await webhookHandler.handleIssues(context);
  });

  /**
   * Pull Request事件处理
   * - 验证项目结构
   * - 检查配置文件
   * - 自动合并符合条件的PR
   */
  app.on("pull_request.opened", async (context) => {
    await webhookHandler.handlePullRequest(context);
  });
  
  app.on("pull_request.synchronize", async (context) => {
    await webhookHandler.handlePullRequest(context);
  });
  
  app.on("pull_request.closed", async (context) => {
    await webhookHandler.handlePullRequest(context);
  });

  /**
   * Push事件处理
   * - 更新注册表
   * - 触发CI/CD流程
   */
  app.on("push", async (context) => {
    await webhookHandler.handlePush(context);
  });

  /**
   * Release事件处理
   * - 版本发布通知
   * - 更新版本信息
   */
  app.on("release.published", async (context) => {
    await webhookHandler.handleRelease(context);
  });

  /**
   * Repository事件处理
   * - 新项目初始化
   * - 自动添加到注册表
   */
  app.on("repository.created", async (context) => {
    await webhookHandler.handleRepository(context);
  });

  /**
   * 错误处理
   */
  app.onError(async (error) => {
    app.log.error("❌ MCP项目管理器出错:", error);
  });

  /**
   * 通用事件监听（调试用）
   */
  app.onAny(async (context) => {
    app.log.info(`📡 收到事件: ${context.name}.${(context.payload as any).action || 'unknown'}`);
  });

  app.log.info("✅ MCP项目管理器已准备就绪!");

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
