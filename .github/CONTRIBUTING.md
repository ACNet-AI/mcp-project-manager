# Contributing to MCP Project Manager

Thank you for your interest in contributing to the MCP Project Manager! This document provides guidelines for contributing to the project.

## Development Workflow

### Prerequisites
- Node.js 18 or higher
- npm

### Setup
1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Copy environment variables: `cp .env.example .env`
4. Fill in your GitHub App credentials in `.env`

### Development Commands
```bash
# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode for tests
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint        # Fix auto-fixable issues
npm run lint:check  # Check only

# Code formatting
npm run format      # Format code
npm run format:check # Check formatting
```

## CI/CD Pipeline

Our project uses GitHub Actions for continuous integration and deployment:

### CI Workflow (`.github/workflows/ci.yml`)
- **Trigger**: Push to `main`/`develop`, PRs to `main`
- **Node versions**: 18, 20
- **Steps**:
  - Type checking with TypeScript
  - Test execution with coverage
  - ESLint code quality checks
  - Prettier formatting validation
  - Security audit with npm audit

### Deployment
- **Automatic**: Vercel monitors the `main` branch and automatically deploys on push
- **Manual**: Can be triggered manually in Vercel dashboard
- **No GitHub Actions needed**: Vercel handles the entire deployment pipeline

### Security Analysis (`.github/workflows/codeql.yml`)
- **Trigger**: Push/PR to `main`, weekly schedule
- **Steps**:
  - CodeQL security analysis
  - Vulnerability detection

## Optional GitHub Secrets

For enhanced CI features, you can configure these optional secrets in your GitHub repository:

### Coverage Reporting (Optional)
- `CODECOV_TOKEN`: Codecov token for coverage reporting

### Deployment Setup
- **Vercel**: Connect your GitHub repository directly in Vercel dashboard
- **No GitHub Secrets needed**: Vercel handles authentication automatically
- **Auto-deployment**: Triggered on every push to `main` branch

## Pull Request Guidelines

1. **Create a feature branch** from `main`
2. **Write tests** for new functionality
3. **Ensure all checks pass**:
   - Tests must pass
   - Code coverage should not decrease significantly
   - Linting and formatting checks must pass
   - Security scans should not introduce new vulnerabilities
4. **Write clear commit messages**
5. **Update documentation** if needed

## Code Standards

- **TypeScript**: Use TypeScript for all new code
- **Testing**: Maintain >85% test coverage
- **Linting**: Follow ESLint configuration
- **Formatting**: Use Prettier for consistent code style
- **Commits**: Use conventional commit format

## Branch Protection

The `main` branch is protected and requires:
- Status checks to pass (CI pipeline)
- Up-to-date branches
- No force pushes
- Admin enforcement

## Getting Help

- Check existing issues and discussions
- Create a new issue for bugs or feature requests
- Ask questions in GitHub Discussions 