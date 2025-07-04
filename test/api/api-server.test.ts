// @ts-nocheck
import request from 'supertest';
// import nock from 'nock';
import { Express } from 'express';
import { Probot, ProbotOctokit } from 'probot';
import fs from 'fs';
import path from 'path';
import myProbotApp from '../../src/index';
import { ApiServer } from '../../src/api-server';

const testDir = path.join(process.cwd(), 'test');
const privateKey = fs.readFileSync(
  path.join(testDir, "fixtures/mock-cert.pem"),
  "utf-8",
);

// Global mock octokit
const mockOctokit = {
  repos: {
    createForAuthenticatedUser: jest.fn().mockResolvedValue({ data: { html_url: 'https://github.com/testuser/test-mcp-server', full_name: 'testuser/test-mcp-server' } }),
    get: jest.fn().mockResolvedValue({ data: { name: 'test-mcp-server', owner: { login: 'testuser' }, html_url: 'https://github.com/testuser/test-mcp-server' } }),
    getContent: jest.fn().mockResolvedValue({ data: { content: Buffer.from('{"projects":[]}').toString('base64') } }),
    createOrUpdateFileContents: jest.fn().mockResolvedValue({ data: {} }),
    getBranch: jest.fn().mockResolvedValue({ data: { commit: { sha: 'mocksha' } } }),
  },
  pulls: {
    create: jest.fn().mockResolvedValue({ data: { html_url: 'https://github.com/testuser/test-mcp-server/pull/1' } }),
    merge: jest.fn().mockResolvedValue({ data: {} }),
  },
  users: {
    getAuthenticated: jest.fn().mockResolvedValue({ data: { login: 'testuser' } }),
  },
  git: {
    createRef: jest.fn().mockResolvedValue({ data: {} }),
  },
  auth: jest.fn().mockResolvedValue({ type: 'installation', token: 'test_token', installationId: 2 }),
};

// Global mock probot module
jest.mock('probot', () => {
  const original = jest.requireActual('probot');
  return {
    ...original,
    Probot: jest.fn().mockImplementation(() => ({
      load: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      webhooks: { on: jest.fn() },
      log: { info: jest.fn(), error: jest.fn(), debug: jest.fn() },
      auth: jest.fn().mockResolvedValue(mockOctokit),
    })),
    ProbotOctokit: jest.fn().mockImplementation(() => mockOctokit),
  };
});

// Fix ProbotOctokit.defaults
const { ProbotOctokit } = require('probot');
ProbotOctokit.defaults = jest.fn().mockReturnValue(jest.fn().mockImplementation(() => mockOctokit));

describe('API Server', () => {
  let app: Express;
  let probot: Probot;
  let apiServer: ApiServer;
  let mockProbot: any;

  const validPayload = {
    projectName: 'test-mcp-server',
    description: 'A test MCP server',
    language: 'python',
    version: '1.0.0',
    files: [
      { path: 'server.py', content: 'print("Hello MCP")' },
      { path: 'package.json', content: '{"name": "test-mcp-server"}' }
    ]
  };

  beforeAll(() => {
    // Mock environment variables for testing
    process.env['GITHUB_APP_ID'] = '123456';
    process.env.NODE_ENV = 'test';
    
    probot = new Probot({
      appId: 123456,
      privateKey,
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });

    mockProbot = probot;
    probot.load(myProbotApp);
    apiServer = new ApiServer();
    apiServer.setProbotInstance(probot);
    app = apiServer.getApp();
  });

  beforeEach(() => {
    // Reset all mocks
    Object.values(mockOctokit.repos).forEach(fn => fn.mockReset && fn.mockReset());
    Object.values(mockOctokit.pulls).forEach(fn => fn.mockReset && fn.mockReset());
    Object.values(mockOctokit.users).forEach(fn => fn.mockReset && fn.mockReset());
    Object.values(mockOctokit.git).forEach(fn => fn.mockReset && fn.mockReset());
    
    // Re-setup default mock behaviors
    mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({ data: { html_url: 'https://github.com/testuser/test-mcp-server', full_name: 'testuser/test-mcp-server' } });
    mockOctokit.repos.get.mockResolvedValue({ data: { name: 'test-mcp-server', owner: { login: 'testuser' }, html_url: 'https://github.com/testuser/test-mcp-server' } });
    mockOctokit.repos.getContent.mockResolvedValue({ data: { content: Buffer.from('{"projects":[]}').toString('base64') } });
    mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({ data: {} });
    mockOctokit.repos.getBranch.mockResolvedValue({ data: { commit: { sha: 'mocksha' } } });
    mockOctokit.pulls.create.mockResolvedValue({ data: { html_url: 'https://github.com/testuser/test-mcp-server/pull/1' } });
    mockOctokit.pulls.merge.mockResolvedValue({ data: {} });
    mockOctokit.users.getAuthenticated.mockResolvedValue({ data: { login: 'testuser' } });
    mockOctokit.git.createRef.mockResolvedValue({ data: {} });
    mockOctokit.auth.mockResolvedValue({ type: 'installation', token: 'test_token', installationId: 2 });
  });

  afterEach(() => {
    // nock.cleanAll();
    // nock.enableNetConnect();
  });

  describe('GET /health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        service: 'MCP Project Manager API',
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /api/status', () => {
    test('should return service status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        service: 'MCP Project Manager',
        version: process.env['npm_package_version'] || '1.0.0',
        timestamp: expect.any(String),
        features: [
          'Account-level permissions',
          'Repository creation',
          'Automated publishing',
          'Hub registration'
        ]
      });
    });
  });

  describe('GET /api/info', () => {
    test('should return app information', async () => {
      const response = await request(app)
        .get('/api/info')
        .expect(200);

      expect(response.body).toEqual({
        name: 'MCP Project Manager',
        description: '🤖 Automated MCP server project creation, publishing and registration management',
        features: [
          'One-click GitHub repository creation',
          'Automatic project code push',
          'Intelligent project validation',
          'Automatic registration to MCP server hub'
        ],
        permissions: {
          repository: ['contents:write', 'issues:write', 'pull_requests:write', 'metadata:read'],
          account: ['administration:write', 'profile:read']
        },
        installation_url: 'https://github.com/apps/mcp-project-manager',
        documentation: 'https://github.com/mcp-servers-hub/mcp-project-manager'
      });
    });
  });

  describe('POST /api/publish', () => {
    test('should handle invalid request body (null)', async () => {
      const response = await request(app)
        .post('/api/publish')
        .send(null)
        .expect(400);
      
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid request body'
      });
    });

    test('should handle invalid request body (string)', async () => {
      const response = await request(app)
        .post('/api/publish')
        .send('invalid')
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });

    test('should handle Probot instance not initialized', async () => {
      // Create a new API server without Probot instance
      const tempApiServer = new ApiServer();
      const tempApp = tempApiServer.getApp();
      
      const response = await request(tempApp)
        .post('/api/publish')
        .send(validPayload)
        .expect(500);
      
      expect(response.body).toEqual({
        success: false,
        error: 'Probot instance not initialized'
      });
    });

    test('should handle missing required fields', async () => {
      const invalidPayload = {
        description: 'A test MCP server',
        version: '1.0.0',
      };
      const response = await request(app)
        .post('/api/publish')
        .send(invalidPayload)
        .expect(400);
      expect(response.body).toEqual({
        success: false,
        error: expect.stringContaining('Project name is required')
      });
    });

    test('should handle empty files array', async () => {
      const payload = { ...validPayload, files: [] };
      const response = await request(app)
        .post('/api/publish')
        .send(payload)
        .expect(400);
      expect(response.body).toEqual({
        success: false,
        error: expect.stringContaining('At least one project file is required')
      });
    });

    test('should validate file paths to prevent directory traversal', async () => {
      const payload = {
        ...validPayload,
        files: [{ path: '../../../etc/passwd', content: 'malicious' }]
      };
      const response = await request(app)
        .post('/api/publish')
        .send(payload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unsafe file path');
    });

    test('should handle auth() method failure', async () => {
      // Mock auth to throw an error
      const originalAuth = mockProbot.auth;
      mockProbot.auth = jest.fn().mockRejectedValue(new Error('Auth failed'));
      
      const response = await request(app)
        .post('/api/publish')
        .send(validPayload)
        .expect(500);
      
      expect(response.body).toEqual({
        success: false,
        error: 'Auth failed'
      });
      
      // Restore original auth
      mockProbot.auth = originalAuth;
    });

    test('should handle webhook handler errors', async () => {
      // Mock the webhook handler to throw an error
      const originalHandlePublishRequest = apiServer['webhookHandler'].handlePublishRequest;
      apiServer['webhookHandler'].handlePublishRequest = jest.fn().mockRejectedValue(new Error('Handler error'));
      
      const response = await request(app)
        .post('/api/publish')
        .send(validPayload)
        .expect(500);
      
      expect(response.body).toEqual({
        success: false,
        error: 'Handler error'
      });
      
      // Restore original handler
      apiServer['webhookHandler'].handlePublishRequest = originalHandlePublishRequest;
    });
  });

  describe('Security', () => {
    test('should handle XSS attempts in project name', async () => {
      const payload = {
        ...validPayload,
        projectName: '<script>alert("xss")</script>'
      };
      
      const response = await request(app)
        .post('/api/publish')
        .send(payload)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: expect.stringContaining('Project does not meet MCP server standards')
      });
    });

    test('should validate file paths to prevent directory traversal', async () => {
      const payload = {
        ...validPayload,
        files: [{ path: '../../../etc/passwd', content: 'malicious' }]
      };
      
      const response = await request(app)
        .post('/api/publish')
        .send(payload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unsafe file path');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'API endpoint not found'
      });
    });

    it('should return 404 for POST to unknown endpoints', async () => {
      const response = await request(app)
        .post('/api/unknown')
        .send({})
        .expect(404);

      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'API endpoint not found'
      });
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    it('should handle OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/publish');

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('Server lifecycle', () => {
    it('should start server on specified port', async () => {
      const testApiServer = new ApiServer();
      const mockListen = jest.fn().mockImplementation((port, callback) => {
        callback();
        return { close: jest.fn() };
      });
      
      // Mock the listen method
      testApiServer.getApp().listen = mockListen;
      
      // Mock console.log to avoid output during tests
      const originalLog = console.log;
      console.log = jest.fn();
      
      await testApiServer.start(3002);
      
      expect(mockListen).toHaveBeenCalledWith(3002, expect.any(Function));
      expect(console.log).toHaveBeenCalledWith('✅ MCP Project Manager API server running on port 3002');
      
      // Restore console.log
      console.log = originalLog;
    });

    it('should start server on default port when no port specified', async () => {
      const testApiServer = new ApiServer();
      const mockListen = jest.fn().mockImplementation((port, callback) => {
        callback();
        return { close: jest.fn() };
      });
      
      testApiServer.getApp().listen = mockListen;
      
      const originalLog = console.log;
      console.log = jest.fn();
      
      await testApiServer.start();
      
      expect(mockListen).toHaveBeenCalledWith(3001, expect.any(Function));
      
      console.log = originalLog;
    });

    it('should return Express app instance', () => {
      const testApiServer = new ApiServer();
      const appInstance = testApiServer.getApp();
      
      expect(appInstance).toBeDefined();
      expect(typeof appInstance.listen).toBe('function');
      expect(typeof appInstance.use).toBe('function');
    });
  });
}); 