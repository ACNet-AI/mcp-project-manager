// @ts-nocheck
import { validateProject, detectMCPProject } from '../../src/utils/validation';
import { ProbotContext, PackageJsonType } from '../../src/types';

// Mock context helper
function createMockContext(): ProbotContext {
  return {
    octokit: {
      repos: {
        getContent: jest.fn()
      }
    },
    payload: {
      repository: {
        owner: { login: 'testuser' },
        name: 'test-repo'
      }
    },
    log: {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }
  } as any;
}

describe('Validation Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateProject', () => {
    test('should validate project with all required files', async () => {
      const context = createMockContext();
      
      // Mock package.json content
      const packageJsonContent = JSON.stringify({
        name: 'test-project',
        description: 'A test project',
        main: 'index.js'
      });
      
      // Mock README content
      const readmeContent = '# Test Project\n\nThis is a test project.';
      
      context.octokit.repos.getContent
        .mockResolvedValueOnce({
          data: { content: Buffer.from(packageJsonContent).toString('base64') }
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from(readmeContent).toString('base64') }
        });

      const result = await validateProject(context, 'src');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(context.octokit.repos.getContent).toHaveBeenCalledTimes(2);
      expect(context.octokit.repos.getContent).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        path: 'src/package.json'
      });
    });

    test('should validate project with sha parameter', async () => {
      const context = createMockContext();
      
      const packageJsonContent = JSON.stringify({
        name: 'test-project',
        description: 'A test project',
        exports: './dist/index.js'
      });
      
      context.octokit.repos.getContent
        .mockResolvedValueOnce({
          data: { content: Buffer.from(packageJsonContent).toString('base64') }
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from('# README').toString('base64') }
        });

      const result = await validateProject(context, 'src', 'abc123');
      
      expect(result.isValid).toBe(true);
      expect(context.octokit.repos.getContent).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        path: 'src/package.json',
        ref: 'abc123'
      });
    });

    test('should fail validation when package.json is missing', async () => {
      const context = createMockContext();
      
      context.octokit.repos.getContent
        .mockRejectedValueOnce(new Error('Not Found'))
        .mockResolvedValueOnce({
          data: { content: Buffer.from('# README').toString('base64') }
        });

      const result = await validateProject(context, 'src');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing package.json file');
    });

    test('should fail validation when package.json has invalid JSON', async () => {
      const context = createMockContext();
      
      const invalidJson = '{ invalid json }';
      
      context.octokit.repos.getContent
        .mockResolvedValueOnce({
          data: { content: Buffer.from(invalidJson).toString('base64') }
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from('# README').toString('base64') }
        });

      const result = await validateProject(context, 'src');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('package.json format error');
    });

    test('should fail validation when package.json is missing required fields', async () => {
      const context = createMockContext();
      
      const packageJsonContent = JSON.stringify({
        // Missing name, description, main, and exports
        version: '1.0.0'
      });
      
      context.octokit.repos.getContent
        .mockResolvedValueOnce({
          data: { content: Buffer.from(packageJsonContent).toString('base64') }
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from('# README').toString('base64') }
        });

      const result = await validateProject(context, 'src');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('package.json missing name field');
      expect(result.errors).toContain('package.json missing description field');
      expect(result.errors).toContain('package.json missing main or exports field');
    });

    test('should fail validation when README.md is missing', async () => {
      const context = createMockContext();
      
      const packageJsonContent = JSON.stringify({
        name: 'test-project',
        description: 'A test project',
        main: 'index.js'
      });
      
      context.octokit.repos.getContent
        .mockResolvedValueOnce({
          data: { content: Buffer.from(packageJsonContent).toString('base64') }
        })
        .mockRejectedValueOnce(new Error('Not Found'));

      const result = await validateProject(context, 'src');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing README.md file');
    });

    test('should handle API errors gracefully', async () => {
      const context = createMockContext();
      
      context.octokit.repos.getContent.mockRejectedValue(new Error('API Error'));

      const result = await validateProject(context, 'src');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle non-file content responses', async () => {
      const context = createMockContext();
      
      // Mock response without content (e.g., directory)
      context.octokit.repos.getContent
        .mockResolvedValueOnce({
          data: { type: 'dir' } // No content field
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from('# README').toString('base64') }
        });

      const result = await validateProject(context, 'src');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing package.json file');
    });
  });

  describe('detectMCPProject', () => {
    test('should detect MCP project with SDK dependency', () => {
      const packageJson: PackageJsonType = {
        name: 'my-mcp-server',
        description: 'A test MCP server',
        dependencies: {
          '@modelcontextprotocol/sdk': '^1.0.0'
        }
      };
      
      const files = ['index.js', 'package.json'];
      
      const result = detectMCPProject(packageJson, files);
      
      expect(result.isMCP).toBe(true);
      expect(result.type).toBe('mcp-server');
      expect(result.confidence).toBeGreaterThanOrEqual(60); // 50 (SDK) + 10 (index file)
    });

    test('should detect MCP project with dev dependency', () => {
      const packageJson: PackageJsonType = {
        name: 'my-project',
        description: 'A project',
        devDependencies: {
          '@modelcontextprotocol/sdk': '^1.0.0'
        }
      };
      
      const files = ['main.ts', 'package.json'];
      
      const result = detectMCPProject(packageJson, files);
      
      expect(result.isMCP).toBe(true);
      expect(result.type).toBe('mcp-server');
      expect(result.confidence).toBe(60); // 50 (SDK) + 10 (main file)
    });

    test('should detect MCP project with keywords', () => {
      const packageJson: PackageJsonType = {
        name: 'my-project',
        description: 'A project',
        keywords: ['mcp', 'automation']
      };
      
      const files = ['index.js', 'mcp-config.json'];
      
      const result = detectMCPProject(packageJson, files);
      
      expect(result.isMCP).toBe(true);
      expect(result.confidence).toBe(50); // 30 (keywords) + 10 (index) + 10 (config)
    });

    test('should detect MCP project with model-context-protocol keyword', () => {
      const packageJson: PackageJsonType = {
        name: 'my-project',
        description: 'A project',
        keywords: ['model-context-protocol']
      };
      
      const files = ['index.js'];
      
      const result = detectMCPProject(packageJson, files);
      
      expect(result.isMCP).toBe(true);
      expect(result.confidence).toBe(40); // 30 (keywords) + 10 (index)
    });

    test('should not detect non-MCP project', () => {
      const packageJson: PackageJsonType = {
        name: 'regular-app',
        description: 'A regular application',
        dependencies: {
          'express': '^4.0.0'
        }
      };
      
      const files = ['app.js', 'package.json'];
      
      const result = detectMCPProject(packageJson, files);
      
      expect(result.isMCP).toBe(false);
      expect(result.type).toBe('unknown');
      expect(result.confidence).toBeLessThan(40);
    });

    test('should handle null package.json', () => {
      const result = detectMCPProject(null, ['index.js']);
      
      expect(result.isMCP).toBe(false);
      expect(result.type).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    test('should handle missing dependencies and keywords', () => {
      const packageJson: PackageJsonType = {
        name: 'my-project',
        description: 'A project'
        // No dependencies, devDependencies, or keywords
      };
      
      const files = ['app.js'];
      
      const result = detectMCPProject(packageJson, files);
      
      expect(result.isMCP).toBe(false);
      expect(result.confidence).toBeLessThan(40);
    });

    test('should give bonus points for config files', () => {
      const packageJson: PackageJsonType = {
        name: 'my-project',
        description: 'A project',
        keywords: ['mcp']
      };
      
      const files = ['index.js', 'mcp-config.yaml', 'config.json'];
      
      const result = detectMCPProject(packageJson, files);
      
      expect(result.isMCP).toBe(true);
      expect(result.confidence).toBe(50); // 30 (keywords) + 10 (index) + 10 (config)
    });

    test('should handle edge case with exact 40 confidence threshold', () => {
      const packageJson: PackageJsonType = {
        name: 'my-project',
        description: 'A project',
        keywords: ['mcp']
      };
      
      const files = ['index.js']; // 30 + 10 = 40
      
      const result = detectMCPProject(packageJson, files);
      
      expect(result.isMCP).toBe(true);
      expect(result.confidence).toBe(40);
    });

    test('should handle just below threshold', () => {
      const packageJson: PackageJsonType = {
        name: 'my-project',
        description: 'A project',
        keywords: ['automation'] // No MCP keyword
      };
      
      const files = ['index.js']; // Only 10 points
      
      const result = detectMCPProject(packageJson, files);
      
      expect(result.isMCP).toBe(false);
      expect(result.confidence).toBe(10);
    });
  });
}); 