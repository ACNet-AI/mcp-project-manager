import {
  AppError,
  GitHubApiError,
  ValidationError,
  ProjectNotFoundError,
  RateLimitError,
  ErrorCode,
  ErrorHandler,
  withRetry
} from '../../src/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    test('should create AppError with default values', () => {
      const error = new AppError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.context).toBeUndefined();
      expect(error.name).toBe('AppError');
    });

    test('should create AppError with custom values', () => {
      const context = { userId: 123 };
      const error = new AppError(
        'Custom error',
        ErrorCode.VALIDATION_ERROR,
        400,
        false,
        context
      );
      
      expect(error.message).toBe('Custom error');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(false);
      expect(error.context).toEqual(context);
    });

    test('should serialize to JSON correctly', () => {
      const context = { test: 'value' };
      const error = new AppError('Test', ErrorCode.GITHUB_API_ERROR, 503, true, context);
      
      const json = error.toJSON();
      
      expect(json.name).toBe('AppError');
      expect(json.message).toBe('Test');
      expect(json.code).toBe(ErrorCode.GITHUB_API_ERROR);
      expect(json.statusCode).toBe(503);
      expect(json.context).toEqual(context);
      expect(json.stack).toBeDefined();
    });
  });

  describe('GitHubApiError', () => {
    test('should create GitHubApiError with default values', () => {
      const error = new GitHubApiError('API failed');
      
      expect(error.message).toBe('API failed');
      expect(error.code).toBe(ErrorCode.GITHUB_API_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('GitHubApiError');
    });

    test('should create GitHubApiError with custom values', () => {
      const context = { endpoint: '/repos' };
      const error = new GitHubApiError('Not found', 404, context);
      
      expect(error.statusCode).toBe(404);
      expect(error.context).toEqual(context);
    });
  });

  describe('ValidationError', () => {
    test('should create ValidationError correctly', () => {
      const context = { field: 'projectName' };
      const error = new ValidationError('Invalid project name', context);
      
      expect(error.message).toBe('Invalid project name');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.context).toEqual(context);
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('ProjectNotFoundError', () => {
    test('should create ProjectNotFoundError correctly', () => {
      const error = new ProjectNotFoundError('my-project');
      
      expect(error.message).toBe("Project 'my-project' not found");
      expect(error.code).toBe(ErrorCode.PROJECT_NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.context).toEqual({ projectName: 'my-project' });
      expect(error.name).toBe('ProjectNotFoundError');
    });
  });

  describe('RateLimitError', () => {
    test('should create RateLimitError with default values', () => {
      const error = new RateLimitError();
      
      expect(error.message).toBe('GitHub API rate limit exceeded');
      expect(error.code).toBe(ErrorCode.GITHUB_RATE_LIMIT);
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe('RateLimitError');
    });

    test('should create RateLimitError with reset time', () => {
      const resetTime = new Date('2024-01-01T12:00:00Z');
      const context = { remaining: 0 };
      const error = new RateLimitError(resetTime, context);
      
      expect(error.context).toEqual({ resetTime, remaining: 0 });
    });
  });
});

describe('ErrorHandler', () => {
  describe('normalize', () => {
    test('should return AppError as-is', () => {
      const originalError = new AppError('Test', ErrorCode.VALIDATION_ERROR);
      const normalized = ErrorHandler.normalize(originalError);
      
      expect(normalized).toBe(originalError);
    });

    test('should convert rate limit error', () => {
      const error = new Error('rate limit exceeded');
      const normalized = ErrorHandler.normalize(error);
      
      expect(normalized).toBeInstanceOf(RateLimitError);
      expect(normalized.code).toBe(ErrorCode.GITHUB_RATE_LIMIT);
    });

    test('should convert Not Found error', () => {
      const error = new Error('Not Found: Repository does not exist');
      const normalized = ErrorHandler.normalize(error);
      
      expect(normalized.code).toBe(ErrorCode.PROJECT_NOT_FOUND);
      expect(normalized.statusCode).toBe(404);
    });

    test('should convert Unauthorized error', () => {
      const error = new Error('Unauthorized: Bad credentials');
      const normalized = ErrorHandler.normalize(error);
      
      expect(normalized.code).toBe(ErrorCode.GITHUB_UNAUTHORIZED);
      expect(normalized.statusCode).toBe(401);
    });

    test('should convert network errors', () => {
      const error = new Error('ENOTFOUND github.com');
      const normalized = ErrorHandler.normalize(error);
      
      expect(normalized.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(normalized.statusCode).toBe(503);
      expect(normalized.message).toBe('Network connection failed');
    });

    test('should convert timeout errors', () => {
      const error = new Error('Request timeout after 30s');
      const normalized = ErrorHandler.normalize(error);
      
      expect(normalized.code).toBe(ErrorCode.TIMEOUT_ERROR);
      expect(normalized.statusCode).toBe(408);
      expect(normalized.message).toBe('Request timeout');
    });

    test('should convert generic Error to AppError', () => {
      const error = new Error('Something went wrong');
      const normalized = ErrorHandler.normalize(error);
      
      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(normalized.message).toBe('Something went wrong');
      expect(normalized.context?.['originalError']).toBe('Error');
    });

    test('should handle non-Error objects', () => {
      const normalized = ErrorHandler.normalize('String error');
      
      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(normalized.message).toBe('An unexpected error occurred');
      expect(normalized.isOperational).toBe(false);
      expect(normalized.context?.['originalError']).toBe('String error');
    });

    test('should use custom fallback message', () => {
      const normalized = ErrorHandler.normalize(null, 'Custom fallback');
      
      expect(normalized.message).toBe('Custom fallback');
    });
  });

  describe('isRetryable', () => {
    test('should identify retryable errors', () => {
      const rateLimitError = new AppError('Rate limit', ErrorCode.GITHUB_RATE_LIMIT);
      const networkError = new AppError('Network', ErrorCode.NETWORK_ERROR);
      const timeoutError = new AppError('Timeout', ErrorCode.TIMEOUT_ERROR);
      
      expect(ErrorHandler.isRetryable(rateLimitError)).toBe(true);
      expect(ErrorHandler.isRetryable(networkError)).toBe(true);
      expect(ErrorHandler.isRetryable(timeoutError)).toBe(true);
    });

    test('should identify non-retryable errors', () => {
      const validationError = new AppError('Validation', ErrorCode.VALIDATION_ERROR);
      const notFoundError = new AppError('Not found', ErrorCode.PROJECT_NOT_FOUND);
      
      expect(ErrorHandler.isRetryable(validationError)).toBe(false);
      expect(ErrorHandler.isRetryable(notFoundError)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    test('should return reset time delay for rate limit errors', () => {
      const resetTime = new Date(Date.now() + 5000); // 5 seconds in future
      const error = new AppError('Rate limit', ErrorCode.GITHUB_RATE_LIMIT, 429, true, { resetTime });
      
      const delay = ErrorHandler.getRetryDelay(error, 1);
      
      expect(delay).toBeGreaterThan(4000);
      expect(delay).toBeLessThan(6000);
    });

    test('should return 0 for past reset time', () => {
      const resetTime = new Date(Date.now() - 1000); // 1 second in past
      const error = new AppError('Rate limit', ErrorCode.GITHUB_RATE_LIMIT, 429, true, { resetTime });
      
      const delay = ErrorHandler.getRetryDelay(error, 1);
      
      expect(delay).toBe(0);
    });

    test('should use exponential backoff for other errors', () => {
      const error = new AppError('Network', ErrorCode.NETWORK_ERROR);
      
      expect(ErrorHandler.getRetryDelay(error, 1)).toBe(2000);
      expect(ErrorHandler.getRetryDelay(error, 2)).toBe(4000);
      expect(ErrorHandler.getRetryDelay(error, 3)).toBe(8000);
    });

    test('should cap delay at 60 seconds', () => {
      const error = new AppError('Network', ErrorCode.NETWORK_ERROR);
      
      const delay = ErrorHandler.getRetryDelay(error, 10);
      
      expect(delay).toBe(60000);
    });
  });

  describe('formatForLogging', () => {
    test('should format error without context', () => {
      const error = new AppError('Test error', ErrorCode.VALIDATION_ERROR);
      const formatted = ErrorHandler.formatForLogging(error, 'create repository');
      
      expect(formatted).toBe('[VALIDATION_ERROR] create repository failed: Test error');
    });

    test('should format error with context', () => {
      const error = new AppError('Test error', ErrorCode.GITHUB_API_ERROR, 500, true, { repo: 'test' });
      const formatted = ErrorHandler.formatForLogging(error, 'push files');
      
      expect(formatted).toBe('[GITHUB_API_ERROR] push files failed: Test error | Context: {"repo":"test"}');
    });
  });
});

describe('withRetry decorator', () => {
  test('should succeed on first attempt', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    const retryFn = withRetry(mockFn, 3);
    
    const result = await retryFn('arg1', 'arg2');
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  test('should retry on retryable errors', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValue('success');
    
    const retryFn = withRetry(mockFn, 3);
    
    const result = await retryFn();
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  test('should not retry on non-retryable errors', async () => {
    const mockFn = jest.fn().mockRejectedValue(new ValidationError('Invalid input'));
    const retryFn = withRetry(mockFn, 3);
    
    await expect(retryFn()).rejects.toThrow(ValidationError);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test('should respect max attempts', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('ENOTFOUND'));
    const retryFn = withRetry(mockFn, 2);
    
    await expect(retryFn()).rejects.toThrow();
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  test('should use custom retry condition', async () => {
    const mockFn = jest.fn().mockRejectedValue(new ValidationError('Invalid'));
    const customRetry = (error: AppError) => error.code === ErrorCode.VALIDATION_ERROR;
    const retryFn = withRetry(mockFn, 2, customRetry); // Reduce attempts to avoid timeout
    
    await expect(retryFn()).rejects.toThrow();
    expect(mockFn).toHaveBeenCalledTimes(2); // Should retry because custom condition allows it
  }, 10000);

  test('should handle delay for rate limit errors', async () => {
    const resetTime = new Date(Date.now() + 100); // 100ms in future
    const rateLimitError = new RateLimitError(resetTime);
    const mockFn = jest.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue('success');
    
    const retryFn = withRetry(mockFn, 2);
    
    const startTime = Date.now();
    const result = await retryFn();
    const endTime = Date.now();
    
    expect(result).toBe('success');
    expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Should have waited
  });
}); 