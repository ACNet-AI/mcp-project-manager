// @ts-nocheck
import { WebhookHandler } from '../../src/webhook-handler';
import { ProbotContext } from '../../src/types';
import * as githubUtils from '../../src/utils/github-utils';

// Only mock github-utils functions that are actually called
jest.mock('../../src/utils/github-utils', () => ({
  createUserRepository: jest.fn(),
  pushFilesToRepository: jest.fn(),
  checkRepositoryExists: jest.fn(),
  registerToHub: jest.fn(),
}));

describe('WebhookHandler', () => {
  let handler: WebhookHandler;
  let mockContext: ProbotContext;

  beforeEach(() => {
    handler = new WebhookHandler();
    mockContext = {
      payload: {},
      octokit: {
        pulls: {
          listFiles: jest.fn(),
        },
        repos: {
          get: jest.fn(),
        },
        issues: {
          createComment: jest.fn(),
          create: jest.fn(),
        },
      },
      log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    } as any;
    jest.clearAllMocks();
  });

  describe('handleInstallation', () => {
    test('should handle installation created event', async () => {
      mockContext.payload = {
        action: 'created',
        installation: {
          account: { login: 'testuser' },
        },
      } as any;
      await handler.handleInstallation(mockContext);
      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Installation event: created')
      );
    });
    test('should handle installation deleted event', async () => {
      mockContext.payload = {
        action: 'deleted',
        installation: {
          account: { login: 'testuser' },
        },
      } as any;
      await handler.handleInstallation(mockContext);
      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Installation event: deleted')
      );
    });
  });

  describe('handlePublishRequest', () => {
    const validRequest = {
      projectName: 'test-project',
      description: 'Test description',
      version: '1.0.0',
      language: 'typescript',
      files: [{ path: 'index.ts', content: 'console.log("test");' }],
      packageJson: {
        name: 'test-project',
        description: 'Test description',
        main: 'index.ts',
        dependencies: {
          '@modelcontextprotocol/sdk': '^1.0.0'
        },
        keywords: ['mcp']
      }
    };
    beforeEach(() => {
      mockContext.payload = {
        installation: {
          account: { login: 'testuser' },
        },
      } as any;
      (githubUtils.checkRepositoryExists as jest.Mock).mockResolvedValue(true);
      (mockContext.octokit.repos.get as jest.Mock).mockResolvedValue({
        data: {
          html_url: 'https://github.com/testuser/test-project',
        },
      });
      (githubUtils.pushFilesToRepository as jest.Mock).mockResolvedValue(undefined);
      (githubUtils.registerToHub as jest.Mock).mockResolvedValue({
        url: 'https://github.com/testuser/test-project/pull/1',
      });
    });
    test('should publish project successfully', async () => {
      const result = await handler.handlePublishRequest(mockContext, validRequest);
      expect(result.success).toBe(true);
      expect(result.repoUrl).toBe('https://github.com/testuser/test-project');
      expect(result.registrationUrl).toBe('https://github.com/testuser/test-project/pull/1');
      expect(githubUtils.pushFilesToRepository).toHaveBeenCalled();
      expect(githubUtils.registerToHub).toHaveBeenCalled();
    });
    test('should handle validation errors', async () => {
      const invalidRequest = {
        ...validRequest,
        projectName: '',
      };
      const result = await handler.handlePublishRequest(mockContext, invalidRequest);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
    test('should handle missing installation', async () => {
      mockContext.payload = {} as any;
      const result = await handler.handlePublishRequest(mockContext, validRequest);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No installation found');
    });

    test('should create new repository when not exists', async () => {
      (githubUtils.checkRepositoryExists as jest.Mock).mockResolvedValue(false);
      (githubUtils.createUserRepository as jest.Mock).mockResolvedValue({
        html_url: 'https://github.com/testuser/test-project',
        full_name: 'testuser/test-project'
      });

      const result = await handler.handlePublishRequest(mockContext, validRequest);
      expect(result.success).toBe(true);
      expect(githubUtils.createUserRepository).toHaveBeenCalledWith(
        mockContext,
        'test-project',
        expect.objectContaining({
          description: 'Test description',
          private: false,
          autoInit: true
        })
      );
    });

    test('should handle non-MCP project validation failure', async () => {
      const nonMcpRequest = {
        ...validRequest,
        packageJson: {
          name: 'regular-project',
          description: 'Not an MCP project'
        }
      };

      const result = await handler.handlePublishRequest(mockContext, nonMcpRequest);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Project does not meet MCP server standards');
    });

    test('should handle errors during repository creation', async () => {
      (githubUtils.checkRepositoryExists as jest.Mock).mockResolvedValue(false);
      (githubUtils.createUserRepository as jest.Mock).mockRejectedValue(new Error('Creation failed'));

      const result = await handler.handlePublishRequest(mockContext, validRequest);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Creation failed');
    });

    test('should handle errors during file push', async () => {
      (githubUtils.pushFilesToRepository as jest.Mock).mockRejectedValue(new Error('Push failed'));

      const result = await handler.handlePublishRequest(mockContext, validRequest);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Push failed');
    });

    test('should handle errors during hub registration', async () => {
      (githubUtils.registerToHub as jest.Mock).mockRejectedValue(new Error('Registration failed'));

      const result = await handler.handlePublishRequest(mockContext, validRequest);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
    });
  });

  describe('handlePush', () => {
    test('should handle push to main branch', async () => {
      mockContext.payload = {
        ref: 'refs/heads/main',
        commits: [{ id: 'abc123' }],
        repository: {
          name: 'test-repo',
          owner: { login: 'testuser' }
        }
      } as any;

      await handler.handlePush(mockContext);
      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Push event: refs/heads/main')
      );
    });

    test('should ignore push to non-main branch', async () => {
      mockContext.payload = {
        ref: 'refs/heads/feature-branch',
        commits: [{ id: 'abc123' }],
        repository: {
          name: 'test-repo',
          owner: { login: 'testuser' }
        }
      } as any;

      await handler.handlePush(mockContext);
      expect(mockContext.log.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Main branch updated')
      );
    });
  });

  describe('handlePullRequest', () => {
    test('should handle pull request opened event', async () => {
      mockContext.payload = {
        action: 'opened',
        number: 1,
        pull_request: {
          title: 'Test PR',
          head: { sha: 'abc123' }
        },
        repository: {
          name: 'test-repo',
          owner: { login: 'testuser' }
        }
      } as any;

      (mockContext.octokit.pulls.listFiles as jest.Mock).mockResolvedValue({
        data: [{ filename: 'package.json' }]
      });

      await handler.handlePullRequest(mockContext);
      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.stringContaining('PR event: opened')
      );
    });
  });

  describe('handleRelease', () => {
    test('should handle release published event', async () => {
      mockContext.payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release v1.0.0'
        },
        repository: {
          name: 'test-repo',
          owner: { login: 'testuser' }
        }
      } as any;

      (mockContext.octokit.issues.create as jest.Mock).mockResolvedValue({
        data: { html_url: 'https://github.com/testuser/test-repo/issues/1' }
      });

      await handler.handleRelease(mockContext);
      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Release event: published')
      );
    });
  });

  describe('handleIssues', () => {
    test('should handle issues opened event', async () => {
      mockContext.payload = {
        action: 'opened',
        issue: {
          number: 1,
          title: 'Test issue with MCP'
        },
        repository: {
          name: 'test-repo',
          owner: { login: 'testuser' }
        }
      } as any;

      (mockContext.octokit.issues.createComment as jest.Mock).mockResolvedValue({
        data: { id: 1 }
      });

      await handler.handleIssues(mockContext);
      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Issues event: opened')
      );
    });
  });

  describe('handleRepository', () => {
    test('should handle repository created event', async () => {
      mockContext.payload = {
        action: 'created',
        repository: {
          name: 'new-repo',
          owner: { login: 'testuser' }
        }
      } as any;

      await handler.handleRepository(mockContext);
      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Repository event: created')
      );
    });
  });
}); 