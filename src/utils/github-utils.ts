import { Context } from 'probot';

/**
 * GitHub API 公共工具函数
 * 减少重复代码，统一错误处理
 */

// 统一的仓库信息提取
export function getRepoInfo(context: Context) {
  const { repository } = context.payload as any;
  return {
    owner: repository.owner.login,
    repo: repository.name,
    fullName: `${repository.owner.login}/${repository.name}`
  };
}

// 统一的issue创建
export async function createIssue(
  context: Context, 
  title: string, 
  body: string, 
  labels: string[] = []
) {
  const { owner, repo } = getRepoInfo(context);
  
  try {
    return await context.octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels
    });
  } catch (error) {
    context.log.error(`Failed to create issue: ${error}`);
    throw error;
  }
}

// 统一的评论创建
export async function createComment(
  context: Context,
  issueNumber: number,
  body: string
) {
  const { owner, repo } = getRepoInfo(context);
  
  try {
    return await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body
    });
  } catch (error) {
    context.log.error(`Failed to create comment: ${error}`);
    throw error;
  }
}

// 统一的文件获取
export async function getFileContent(
  context: Context,
  path: string,
  ref?: string
) {
  const { owner, repo } = getRepoInfo(context);
  
  try {
    const response = await context.octokit.repos.getContent({
      owner,
      repo,
      path,
      ...(ref && { ref })
    });
    
    if (Array.isArray(response.data)) {
      throw new Error(`Path ${path} is a directory, not a file`);
    }
    
    if (response.data.type !== 'file') {
      throw new Error(`Path ${path} is not a file`);
    }
    
    const fileData = response.data as any;
    return Buffer.from(fileData.content, 'base64').toString('utf-8');
  } catch (error) {
    context.log.error(`Failed to get file content for ${path}: ${error}`);
    return null;
  }
}

// 统一的错误处理和问题报告
export async function reportError(
  context: Context,
  action: string,
  error: any,
  shouldCreateIssue = false
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const logMessage = `${action} failed: ${errorMessage}`;
  
  context.log.error(logMessage);
  
  if (shouldCreateIssue) {
    try {
      await createIssue(
        context,
        `🚨 Automation Error: ${action}`,
        `An error occurred during ${action}:\n\n\`\`\`\n${errorMessage}\n\`\`\`\n\nPlease check the logs for more details.`,
        ['bug', 'automation']
      );
    } catch (issueError) {
      context.log.error(`Failed to create error report issue: ${issueError}`);
    }
  }
}

// MCP项目验证 (简化版)
export function validateMCPProject(packageJson: any): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 基本检查
  if (!packageJson.name) errors.push('Missing package name');
  if (!packageJson.description) warnings.push('Missing package description');
  if (!packageJson.main && !packageJson.module) errors.push('Missing entry point');
  
  // MCP特定检查
  if (!packageJson.name?.includes('mcp')) {
    warnings.push('Package name should include "mcp" for better discoverability');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// 标签管理
export const LABELS = {
  MCP_SERVER: 'mcp-server',
  VALIDATION_PASSED: 'validation-passed',
  VALIDATION_FAILED: 'validation-failed',
  AUTO_MERGED: 'auto-merged',
  NEEDS_REVIEW: 'needs-review',
  BUG: 'bug',
  AUTOMATION: 'automation'
} as const;
