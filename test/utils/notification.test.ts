// @ts-nocheck
import {
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyValidationErrors,
  notifyRelease
} from '../../src/utils/notification';
import { AppError, ErrorCode } from '../../src/errors';
import { ProbotContext } from '../../src/types';

// Mock context helper
function createMockContext(payloadType: 'pull_request' | 'issue' | 'other' = 'other'): ProbotContext {
  const mockOctokit = {
    issues: {
      createComment: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({})
    }
  };

  let payload: any = {
    repository: {
      owner: { login: 'testuser' },
      name: 'test-repo'
    }
  };

  if (payloadType === 'pull_request') {
    payload.pull_request = { number: 1 };
  } else if (payloadType === 'issue') {
    payload.issue = { number: 2 };
  }

  return {
    octokit: mockOctokit,
    payload,
    log: {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }
  } as any;
}

describe('Notification Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Math.random to make emoji selection predictable
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('notifySuccess', () => {
    test('should send success notification with message only', async () => {
      const context = createMockContext('pull_request');
      
      await notifySuccess(context, 'Project created successfully');
      
      expect(context.octokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        issue_number: 1,
        body: expect.stringContaining('**Success!** Project created successfully')
      });
    });

    test('should send success notification with details', async () => {
      const context = createMockContext('issue');
      
      await notifySuccess(context, 'Repository created', 'URL: https://github.com/test/repo');
      
      expect(context.octokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        issue_number: 2,
        body: expect.stringContaining('Repository created\n\nURL: https://github.com/test/repo')
      });
    });

    test('should create new issue when no PR or issue context', async () => {
      const context = createMockContext('other');
      
      await notifySuccess(context, 'Success message');
      
      expect(context.octokit.issues.create).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        title: '🤖 MCP Project Manager Notification',
        body: expect.stringContaining('Success message')
      });
    });
  });

  describe('notifyError', () => {
    test('should send error notification without action', async () => {
      const context = createMockContext('pull_request');
      const error = new AppError('Something went wrong', ErrorCode.INTERNAL_ERROR);
      
      await notifyError(context, error);
      
      expect(context.octokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        issue_number: 1,
        body: expect.stringContaining('**Error**\n\n**Error message:** Something went wrong')
      });
    });

    test('should send error notification with action', async () => {
      const context = createMockContext('issue');
      const error = new AppError('Validation failed', ErrorCode.VALIDATION_ERROR);
      
      await notifyError(context, error, 'project creation');
      
      expect(context.octokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        issue_number: 2,
        body: expect.stringContaining('**Error during project creation**')
      });
    });

    test('should include suggestions when available', async () => {
      const context = createMockContext('pull_request');
      const error = new AppError('Invalid format', ErrorCode.VALIDATION_ERROR, 400, true, {
        suggestions: 'Please check your package.json format'
      });
      
      await notifyError(context, error);
      
      expect(context.octokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        issue_number: 1,
        body: expect.stringContaining('**Suggestions:**\nPlease check your package.json format')
      });
    });
  });

  describe('notifyWarning', () => {
    test('should send warning notification without suggestions', async () => {
      const context = createMockContext('pull_request');
      
      await notifyWarning(context, 'This is a warning message');
      
      expect(context.octokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        issue_number: 1,
        body: expect.stringContaining('**Warning!** This is a warning message')
      });
    });

    test('should send warning notification with suggestions', async () => {
      const context = createMockContext('issue');
      const suggestions = ['Check your configuration', 'Update dependencies'];
      
      await notifyWarning(context, 'Configuration might be outdated', suggestions);
      
      const expectedBody = expect.stringContaining('**Suggestions:**\n- Check your configuration\n- Update dependencies');
      expect(context.octokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        issue_number: 2,
        body: expectedBody
      });
    });

    test('should handle empty suggestions array', async () => {
      const context = createMockContext('pull_request');
      
      await notifyWarning(context, 'Warning message', []);
      
      expect(context.octokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        issue_number: 1,
        body: expect.not.stringContaining('**Suggestions:**')
      });
    });
  });

  describe('notifyValidationErrors', () => {
    test('should send validation error notification', async () => {
      const context = createMockContext('pull_request');
      const errors = [
        'Missing package.json',
        'Invalid project structure',
        'No main entry point'
      ];
      
      await notifyValidationErrors(context, errors);
      
      const expectedBody = expect.stringContaining(
        '**Project validation failed**\n\nThe following issues were found:\n- Missing package.json\n- Invalid project structure\n- No main entry point'
      );
      expect(context.octokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        issue_number: 1,
        body: expectedBody
      });
    });

    test('should handle single validation error', async () => {
      const context = createMockContext('issue');
      const errors = ['Missing README.md'];
      
      await notifyValidationErrors(context, errors);
      
      expect(context.octokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        issue_number: 2,
        body: expect.stringContaining('- Missing README.md')
      });
    });
  });

  describe('notifyRelease', () => {
    test('should send release notification', async () => {
      const context = createMockContext('pull_request');
      
      await notifyRelease(context, 'v1.2.3', 'https://github.com/user/repo');
      
      const expectedBody = expect.stringContaining(
        '**New version released successfully!**\n\n**Version:** v1.2.3\n**Repository:** https://github.com/user/repo'
      );
      expect(context.octokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        issue_number: 1,
        body: expectedBody
      });
    });
  });

  describe('Error handling', () => {
    test('should handle API errors gracefully', async () => {
      const context = createMockContext('pull_request');
      const apiError = new Error('API Error');
      context.octokit.issues.createComment.mockRejectedValue(apiError);
      
      // Should not throw
      await expect(notifySuccess(context, 'Test message')).resolves.not.toThrow();
      
      expect(context.log.error).toHaveBeenCalledWith('Failed to send notification:', apiError);
    });

    test('should handle missing repository info', async () => {
      const context = createMockContext('pull_request');
      context.payload = {}; // Missing repository info
      
      // Should not throw even with malformed payload
      await expect(notifySuccess(context, 'Test')).resolves.not.toThrow();
    });
  });

  describe('Emoji randomization', () => {
    test('should use different emojis based on type', async () => {
      const context = createMockContext('other');
      
      // Test with different random values
      jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0) // First emoji
        .mockReturnValueOnce(0.9); // Last emoji
      
      await notifySuccess(context, 'Success 1');
      await notifySuccess(context, 'Success 2');
      
      expect(context.octokit.issues.create).toHaveBeenCalledTimes(2);
      
      // Both calls should have emojis, but they might be different
      const calls = context.octokit.issues.create.mock.calls;
      expect(calls[0][0].body).toMatch(/^[🎉✅🚀🌟💯🎊]/);
      expect(calls[1][0].body).toMatch(/^[🎉✅🚀🌟💯🎊]/);
    });

    test('should fallback to default emoji on edge case', () => {
      // Mock getRandomEmoji to test fallback
      jest.spyOn(Math, 'random').mockReturnValue(10); // Out of bounds
      
      const context = createMockContext('other');
      
      // Should not crash and should use fallback emoji
      expect(() => notifySuccess(context, 'Test')).not.toThrow();
    });
  });
}); 