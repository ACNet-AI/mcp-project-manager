# 🛠️ MCP Project Manager - Development Guide

## Quick Setup

### Prerequisites
- **Node.js**: 18.0+ (LTS recommended)
- **npm**: 9.0+ or **yarn**: 1.22+
- **Git**: 2.30+
- **GitHub Account**: For creating test GitHub App

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/mcp-servers-hub/mcp-project-manager.git
cd mcp-project-manager

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your GitHub App credentials

# 4. Start development server
npm run dev

# 5. Run tests
npm test
```

---

## Environment Configuration

### GitHub App for Development

Create a test GitHub App for development:

1. **Create App**: Go to [GitHub Apps](https://github.com/settings/apps) → "New GitHub App"
2. **Basic Settings**:
   ```
   App name: mcp-project-manager-dev
   Homepage URL: http://localhost:3000
   Webhook URL: http://localhost:3000/api/github/webhooks
   ```
3. **Permissions**:
   - Repository: `Contents: Write`, `Issues: Write`, `Metadata: Read`, `Pull requests: Write`
   - Account: `Email addresses: Read`
4. **Download private key** and save as `private-key.pem` in project root

### .env Configuration

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.1234567890abcdef
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_PRIVATE_KEY_PATH=./private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Development Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
```

---

## Project Architecture

### Directory Structure
```
src/
├── index.ts              # Main entry point
├── api-server.ts         # API server setup
├── webhook-handler.ts    # GitHub webhook handler
├── types.ts              # TypeScript definitions
└── utils/
    └── github-utils.ts   # GitHub API utilities

test/
├── index.test.ts         # Main tests
├── api/                  # API tests
├── utils/                # Utility tests
└── fixtures/             # Test data
```

### Core Modules

**Webhook Handler**: Processes GitHub events (issues, PRs, push, releases)
**GitHub Utils**: Repository operations, file management, API calls
**API Server**: REST endpoints for project publishing and status
**Type Definitions**: TypeScript interfaces for GitHub events and API

---

## Development Workflow

### Feature Development
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Development cycle
npm run dev        # Start dev server
npm test           # Run tests
npm run build      # Build check
npm run lint       # Code quality
npm run type-check # TypeScript check
```

### Debugging

#### Local Webhook Testing
Use [ngrok](https://ngrok.com/) to expose local server:

```bash
# Install ngrok
npm install -g ngrok

# Start local server
npm run dev

# In new terminal, expose service
ngrok http 3000

# Update GitHub App webhook URL to ngrok URL
# Example: https://abc123.ngrok.io/api/github/webhooks
```

#### Testing Individual Features
```bash
# Run specific test file
npm test -- --testPathPattern=webhook-handler

# Run specific test case
npm test -- --testNamePattern="should handle issues event"

# Watch mode for development
npm run test:watch
```

---

## Testing Strategy

### Unit Testing
```typescript
// Example test structure
import { createRepository } from '../../src/utils/github-utils';

describe('GitHub Utils', () => {
  test('should create repository successfully', async () => {
    const mockContext = createMockContext();
    const result = await createRepository(mockContext, {
      name: 'test-repo',
      description: 'Test repository'
    });
    
    expect(result.success).toBe(true);
    expect(result.repoUrl).toContain('github.com');
  });
});
```

### Test Coverage Requirements
- **Code coverage**: > 80%
- **Branch coverage**: > 75%
- **Function coverage**: > 90%

### Running Tests
```bash
npm test                    # All tests
npm run test:coverage       # With coverage report
npm run test:watch          # Watch mode
npm test webhook-handler    # Specific file
```

---

## Code Standards

### Commit Convention
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add project validation functionality
fix: handle empty repository description
docs: update API documentation
test: add webhook handler unit tests
refactor: simplify github utils error handling
```

**Commit Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation update
- `style`: Code formatting
- `refactor`: Code refactoring
- `test`: Test related
- `chore`: Build process or auxiliary tools

### TypeScript Standards
```typescript
// ✅ Good example
interface ProjectConfig {
  name: string;
  description: string;
  version: string;
  files: FileContent[];
}

async function publishProject(
  config: ProjectConfig
): Promise<PublishResult> {
  try {
    const result = await createRepository(config);
    return { success: true, repoUrl: result.url };
  } catch (error) {
    logger.error('Failed to publish project', error);
    return { success: false, error: error.message };
  }
}

// ❌ Avoid
function publishProject(config: any): any {
  // Missing types, error handling, return type
}
```

### Error Handling Pattern
```typescript
// Unified error handling
class ProjectManagerError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ProjectManagerError';
  }
}

// Usage
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof ProjectManagerError) {
    throw error; // Business logic error
  } else {
    throw new ProjectManagerError(
      'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
}
```

### Async/Await Best Practices
```typescript
// ✅ Sequential processing
async function processFiles(files: FileContent[]): Promise<void> {
  for (const file of files) {
    await validateFile(file);
    await uploadFile(file);
  }
}

// ✅ Parallel processing (when operations are independent)
async function processFilesParallel(files: FileContent[]): Promise<void> {
  const validations = files.map(file => validateFile(file));
  await Promise.all(validations);
  
  const uploads = files.map(file => uploadFile(file));
  await Promise.all(uploads);
}
```

### Logging Standards
```typescript
import { getLogger } from '../utils/logger';

const logger = getLogger('module-name');

// ✅ Structured logging
logger.info('Repository created successfully', {
  repoName: 'my-mcp-server',
  owner: 'username',
  url: 'https://github.com/username/my-mcp-server'
});

logger.error('Failed to create repository', {
  error: error.message,
  repoName: 'my-mcp-server',
  retryCount: 3
});
```

---

## Troubleshooting

### Common Issues

**GitHub App permissions**: Check app permissions and installation scope
**Webhook events not triggering**: Verify webhook URL accessibility and secret
**Build failures**: Run `npm run type-check` and `npm run lint`
**Test failures**: Check environment variables and mock data

### Debug Steps
1. Check test environment variables
2. Run `npm run test:watch` for detailed errors
3. Verify mock data is up to date
4. Check GitHub App webhook logs

---

## Resources

- **GitHub Apps Documentation**: https://docs.github.com/en/developers/apps
- **Probot Framework**: https://probot.github.io/
- **TypeScript Guide**: https://www.typescriptlang.org/docs/
- **Jest Testing**: https://jestjs.io/docs/

---

*Development Guide Version: v1.0*  
*Last Updated: January 15, 2025* 