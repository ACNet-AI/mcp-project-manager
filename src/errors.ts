/**
 * Unified error handling system
 */

export enum ErrorCode {
  // GitHub API related errors
  GITHUB_API_ERROR = "GITHUB_API_ERROR",
  GITHUB_RATE_LIMIT = "GITHUB_RATE_LIMIT",
  GITHUB_UNAUTHORIZED = "GITHUB_UNAUTHORIZED",

  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_PROJECT_STRUCTURE = "INVALID_PROJECT_STRUCTURE",
  INVALID_CONFIGURATION = "INVALID_CONFIGURATION",

  // Business logic errors
  PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND",
  REPOSITORY_EXISTS = "REPOSITORY_EXISTS",
  INSTALLATION_NOT_FOUND = "INSTALLATION_NOT_FOUND",

  // System errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    // Ensure stack trace is correct
    Error.captureStackTrace(this, AppError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack,
    };
  }
}

export class GitHubApiError extends AppError {
  constructor(message: string, statusCode: number = 500, context?: Record<string, unknown>) {
    super(message, ErrorCode.GITHUB_API_ERROR, statusCode, true, context);
    this.name = "GitHubApiError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, true, context);
    this.name = "ValidationError";
  }
}

export class ProjectNotFoundError extends AppError {
  constructor(projectName: string) {
    super(`Project '${projectName}' not found`, ErrorCode.PROJECT_NOT_FOUND, 404, true, {
      projectName,
    });
    this.name = "ProjectNotFoundError";
  }
}

export class RateLimitError extends AppError {
  constructor(resetTime?: Date, context?: Record<string, unknown>) {
    super("GitHub API rate limit exceeded", ErrorCode.GITHUB_RATE_LIMIT, 429, true, {
      resetTime,
      ...context,
    });
    this.name = "RateLimitError";
  }
}

/**
 * Error handling utility functions
 */
export class ErrorHandler {
  /**
   * Convert unknown error to AppError
   */
  static normalize(
    error: unknown,
    fallbackMessage: string = "An unexpected error occurred"
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      // GitHub API error handling
      if (error.message.includes("rate limit")) {
        return new RateLimitError();
      }

      if (error.message.includes("Not Found")) {
        return new AppError(error.message, ErrorCode.PROJECT_NOT_FOUND, 404);
      }

      if (error.message.includes("Unauthorized")) {
        return new AppError(error.message, ErrorCode.GITHUB_UNAUTHORIZED, 401);
      }

      // Network error
      if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
        return new AppError("Network connection failed", ErrorCode.NETWORK_ERROR, 503);
      }

      // Timeout error
      if (error.message.includes("timeout")) {
        return new AppError("Request timeout", ErrorCode.TIMEOUT_ERROR, 408);
      }

      return new AppError(error.message, ErrorCode.INTERNAL_ERROR, 500, true, {
        originalError: error.name,
        stack: error.stack,
      });
    }

    return new AppError(fallbackMessage, ErrorCode.INTERNAL_ERROR, 500, false, {
      originalError: String(error),
    });
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: AppError): boolean {
    return [ErrorCode.GITHUB_RATE_LIMIT, ErrorCode.NETWORK_ERROR, ErrorCode.TIMEOUT_ERROR].includes(
      error.code
    );
  }

  /**
   * Get retry delay (milliseconds)
   */
  static getRetryDelay(error: AppError, attempt: number): number {
    if (error.code === ErrorCode.GITHUB_RATE_LIMIT) {
      const resetTime = error.context?.["resetTime"] as Date;
      if (resetTime) {
        return Math.max(0, resetTime.getTime() - Date.now());
      }
    }

    // Exponential backoff, max 60 seconds
    return Math.min(1000 * Math.pow(2, attempt), 60000);
  }

  /**
   * Format error message for logging
   */
  static formatForLogging(error: AppError, action: string): string {
    return `[${error.code}] ${action} failed: ${error.message}${
      error.context ? ` | Context: ${JSON.stringify(error.context)}` : ""
    }`;
  }
}

/**
 * Retry decorator
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  maxAttempts: number = 3,
  shouldRetry?: (error: AppError) => boolean
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    let lastError: AppError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = ErrorHandler.normalize(error);

        const canRetry = shouldRetry ? shouldRetry(lastError) : ErrorHandler.isRetryable(lastError);

        if (attempt === maxAttempts || !canRetry) {
          throw lastError;
        }

        const delay = ErrorHandler.getRetryDelay(lastError, attempt);
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }) as T;
}
