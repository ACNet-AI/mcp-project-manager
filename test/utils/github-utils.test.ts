// @ts-nocheck
import fs from "fs";
import path from "path";
import {
  createUserRepository,
  checkRepositoryExists,
  pushFilesToRepository,
  detectMCPProject,
  registerToHub,
  getRepoInfo,
  createComment,
  getFileContent,
  createIssue,
  reportError
} from "../../src/utils/github-utils";
import { ProbotContext, FileContent } from "../../src/types";

const testDir = path.join(process.cwd(), 'test');
const privateKey = fs.readFileSync(
  path.join(testDir, "fixtures/mock-cert.pem"),
  "utf-8",
);

// Helper function to create mock context
function createMockContext(overrides = {}): ProbotContext {
  // Manually mock common octokit methods
  const octokitMock = {
    repos: {
      createForAuthenticatedUser: jest.fn(),
      get: jest.fn(),
      getContent: jest.fn(),
      createOrUpdateFileContents: jest.fn(),
      getBranch: jest.fn(),
    },
    issues: {
      create: jest.fn(),
      createComment: jest.fn(),
    },
    pulls: {
      create: jest.fn(),
      listFiles: jest.fn(),
      merge: jest.fn(),
    },
    users: {
      getAuthenticated: jest.fn(),
    },
    git: {
      createRef: jest.fn(),
    },
  };

  return {
    name: 'test',
    id: 'test-delivery-id',
    log: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    octokit: octokitMock,
    payload: {
      installation: { id: 2 },
      repository: {
        id: 1,
        name: "test-repo",
        full_name: "testuser/test-repo",
        owner: { login: "testuser" },
        html_url: "https://github.com/testuser/test-repo"
      }
    },
    repo: (object = {}) => ({
      owner: "testuser",
      repo: "test-repo",
      ...object
    }),
    issue: (object = {}) => ({
      owner: "testuser",
      repo: "test-repo",
      issue_number: 1,
      ...object
    }),
    pullRequest: (object = {}) => ({
      owner: "testuser",
      repo: "test-repo",
      pull_number: 1,
      ...object
    }),
    ...overrides
  } as unknown as ProbotContext;
}

describe("GitHub Utils", () => {
  describe("getRepoInfo", () => {
    test("should extract repository information from context", () => {
      const context = createMockContext();
      const repoInfo = getRepoInfo(context);
      expect(repoInfo).toEqual({ owner: "testuser", repo: "test-repo", fullName: "testuser/test-repo" });
    });
    test("should handle missing repository information", () => {
      const context = createMockContext({ payload: { installation: { id: 2 } } });
      expect(() => getRepoInfo(context)).toThrow("Repository information is missing from payload");
    });
  });

  describe("createUserRepository", () => {
    test("should create repository successfully", async () => {
      const context = createMockContext();
      context.octokit.repos.createForAuthenticatedUser.mockResolvedValue({ data: { html_url: "https://github.com/testuser/test-repo", full_name: "testuser/test-repo" } });
      const result = await createUserRepository(context, "test-repo", { description: "Test repository", private: false, autoInit: true });
      expect(result.html_url).toBe("https://github.com/testuser/test-repo");
      expect(context.octokit.repos.createForAuthenticatedUser).toHaveBeenCalled();
    });
    test("should handle repository creation failure", async () => {
      const context = createMockContext();
      context.octokit.repos.createForAuthenticatedUser.mockRejectedValue(new Error("Repository creation failed"));
      await expect(createUserRepository(context, "test-repo", { description: "Test repository" })).rejects.toThrow();
    });
    test("should create private repository when specified", async () => {
      const context = createMockContext();
      context.octokit.repos.createForAuthenticatedUser.mockResolvedValue({ data: { html_url: "https://github.com/testuser/private-repo", full_name: "testuser/private-repo" } });
      const result = await createUserRepository(context, "private-repo", { description: "Private test repository", private: true, autoInit: true });
      expect(result.html_url).toBe("https://github.com/testuser/private-repo");
      expect(context.octokit.repos.createForAuthenticatedUser).toHaveBeenCalled();
    });
  });

  describe("checkRepositoryExists", () => {
    test("should return true when repository exists", async () => {
      const context = createMockContext();
      context.octokit.repos.get.mockResolvedValue({ data: { name: "existing-repo", full_name: "testuser/existing-repo" } });
      const exists = await checkRepositoryExists(context, "testuser", "existing-repo");
      expect(exists).toBe(true);
      expect(context.octokit.repos.get).toHaveBeenCalled();
    });
    test("should return false when repository does not exist", async () => {
      const context = createMockContext();
      const error: any = new Error("Not Found"); error.status = 404;
      context.octokit.repos.get.mockRejectedValue(error);
      const exists = await checkRepositoryExists(context, "testuser", "nonexistent-repo");
      expect(exists).toBe(false);
    });
    test("should throw error for non-404 errors", async () => {
      const context = createMockContext();
      const error: any = new Error("Internal Server Error"); error.status = 500;
      context.octokit.repos.get.mockRejectedValue(error);
      await expect(checkRepositoryExists(context, "testuser", "error-repo")).rejects.toThrow();
    });
  });

  describe("pushFilesToRepository", () => {
    const testFiles: FileContent[] = [
      { path: "README.md", content: "# Test Project\n\nThis is a test.", message: "Add README" },
      { path: "src/index.js", content: 'console.log("Hello, world!");', message: "Add main script" }
    ];
    test("should push files successfully", async () => {
      const context = createMockContext();
      context.octokit.repos.get.mockResolvedValue({ data: { default_branch: "main" } });
      context.octokit.repos.getContent.mockRejectedValue({ status: 404 });
      context.octokit.repos.createOrUpdateFileContents.mockResolvedValue({});
      await pushFilesToRepository(context, "testuser", "test-repo", testFiles);
      expect(context.octokit.repos.createOrUpdateFileContents).toHaveBeenCalled();
    });
    test("should handle file push failure", async () => {
      const context = createMockContext();
      context.octokit.repos.get.mockResolvedValue({ data: { default_branch: "main" } });
      context.octokit.repos.getContent.mockRejectedValue({ status: 404 });
      context.octokit.repos.createOrUpdateFileContents.mockRejectedValue(new Error("Invalid request"));
      await expect(pushFilesToRepository(context, "testuser", "test-repo", testFiles)).rejects.toThrow();
    });
    test("should update existing files", async () => {
      const context = createMockContext();
      context.octokit.repos.get.mockResolvedValue({ data: { default_branch: "main" } });
      context.octokit.repos.getContent.mockResolvedValue({ data: { sha: "existing_sha", type: "file", content: Buffer.from("Old content").toString('base64') } });
      context.octokit.repos.createOrUpdateFileContents.mockResolvedValue({});
      await pushFilesToRepository(context, "testuser", "test-repo", testFiles.slice(0, 1));
      expect(context.octokit.repos.createOrUpdateFileContents).toHaveBeenCalled();
    });
  });

  describe("detectMCPProject", () => {
    test("should detect MCP project from package.json", () => {
      const packageJson = { name: "my-mcp-server", description: "A test MCP server", dependencies: { "@modelcontextprotocol/sdk": "^0.1.0" } };
      const result = detectMCPProject(packageJson, ["src/index.ts", "package.json"]);
      expect(result.isMCPProject).toBe(true);
      expect(result.confidence).toBeGreaterThan(40); // Compatible implementation
      expect(result.reasons.length).toBeGreaterThan(0);
    });
    test("should detect MCP project from file patterns", () => {
      // Filename contains mcp, server.py+15, supplemented by packageJson stacking score to ensure score>=50
      const files = [
        "src/mcp-server.ts", "server.py", "mcp-config.json", "mcp-readme.md", "package.json"
      ];
      const packageJson = {
        name: "test-mcp-server",
        description: "A test MCP server",
        keywords: ["mcp", "server"]
      };
      const result = detectMCPProject(packageJson, files);
      expect(result.isMCPProject).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });
    test("should not detect non-MCP project", () => {
      const packageJson = { name: "regular-app", description: "A regular application", dependencies: { "express": "^4.0.0" } };
      const result = detectMCPProject(packageJson, ["src/app.js", "package.json"]);
      expect(result.isMCPProject).toBe(false);
      expect(result.confidence).toBeLessThan(50);
    });
  });

  describe("registerToHub", () => {
    test("should register project to MCP hub successfully", async () => {
      const context = createMockContext();
      // Mock registry.json content
      const registryObj = { projects: [] };
      const registryContent = Buffer.from(JSON.stringify(registryObj), "utf-8").toString("base64");
      (context.octokit.repos.getContent as jest.Mock).mockResolvedValue({ data: { content: registryContent, type: "file" } });
      (context.octokit.repos.getBranch as jest.Mock) = jest.fn().mockResolvedValue({ data: { commit: { sha: "main_sha" } } });
      context.octokit.git = context.octokit.git || {};
      (context.octokit.git.createRef as jest.Mock) = jest.fn().mockResolvedValue({ data: { ref: "refs/heads/mcp-register-branch" } });
      (context.octokit.pulls.create as jest.Mock).mockResolvedValue({ data: { html_url: "https://github.com/ACNet-AI/mcp-servers-hub/pull/123", number: 123 } });
      const result = await registerToHub(context, { name: "test-mcp-server", owner: "testuser", repo: "test-repo", description: "A test MCP server", version: "1.0.0", language: "typescript" });
      expect(result.html_url).toBe("https://github.com/ACNet-AI/mcp-servers-hub/pull/123");
    });
    test("should handle registration failure", async () => {
      const context = createMockContext();
      const registryObj = { projects: [] };
      const registryContent = Buffer.from(JSON.stringify(registryObj), "utf-8").toString("base64");
      (context.octokit.repos.getContent as jest.Mock).mockResolvedValue({ data: { content: registryContent, type: "file" } });
      (context.octokit.repos.getBranch as jest.Mock) = jest.fn().mockResolvedValue({ data: { commit: { sha: "main_sha" } } });
      context.octokit.git = context.octokit.git || {};
      (context.octokit.git.createRef as jest.Mock) = jest.fn().mockResolvedValue({ data: { ref: "refs/heads/mcp-register-branch" } });
      (context.octokit.pulls.create as jest.Mock).mockRejectedValue(new Error("Pull request creation failed"));
      await expect(registerToHub(context, { name: "test-mcp-server", owner: "testuser", repo: "test-repo", description: "A test MCP server", version: "1.0.0", language: "typescript" })).rejects.toThrow();
    });
  });

  describe("createComment", () => {
    test("should create comment successfully", async () => {
      const context = createMockContext();
      context.octokit.issues.createComment.mockResolvedValue({ data: { id: 1, body: "Test comment" } });
      const result = await createComment(context, 1, "Test comment");
      expect(result.data.id).toBe(1);
      expect(context.octokit.issues.createComment).toHaveBeenCalled();
    });
    test("should handle comment creation failure", async () => {
      const context = createMockContext();
      context.octokit.issues.createComment.mockRejectedValue(new Error("Comment creation failed"));
      await expect(createComment(context, 1, "Test comment")).rejects.toThrow();
    });
  });

  describe("Additional coverage tests", () => {
    it("should handle getFileContent", async () => {
      const mockContext = createMockContext();
      
      // Mock successful response
      mockContext.octokit.repos.getContent.mockResolvedValue({
        data: {
          type: 'file',
          content: Buffer.from("test content").toString('base64')
        }
      });

      const content = await getFileContent(mockContext, "test-file.txt");
      expect(content).toBe("test content");
      expect(mockContext.octokit.repos.getContent).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo", 
        path: "test-file.txt"
      });
    });

    it("should handle getFileContent with ref", async () => {
      const mockContext = createMockContext();
      
      mockContext.octokit.repos.getContent.mockResolvedValue({
        data: {
          type: 'file',
          content: Buffer.from("test content").toString('base64')
        }
      });

      const content = await getFileContent(mockContext, "test-file.txt", "main");
      expect(content).toBe("test content");
      expect(mockContext.octokit.repos.getContent).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
        path: "test-file.txt",
        ref: "main"
      });
    });

    it("should handle getFileContent 404 error", async () => {
      const mockContext = createMockContext();
      
      const error: any = new Error("Not Found");
      error.status = 404;
      mockContext.octokit.repos.getContent.mockRejectedValue(error);

      const content = await getFileContent(mockContext, "nonexistent.txt");
      expect(content).toBeNull();
      expect(mockContext.log.error).toHaveBeenCalled();
    });

    it("should handle createIssue", async () => {
      const mockContext = createMockContext();
      
      mockContext.octokit.issues.create.mockResolvedValue({
        data: { number: 123 }
      });

      const issue = await createIssue(mockContext, "Test Issue", "This is a test issue");
      expect(issue.data.number).toBe(123);
      expect(mockContext.octokit.issues.create).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
        title: "Test Issue",
        body: "This is a test issue",
        labels: []
      });
    });

    it("should handle createIssue with labels", async () => {
      const mockContext = createMockContext();
      
      mockContext.octokit.issues.create.mockResolvedValue({
        data: { number: 124 }
      });

      const issue = await createIssue(mockContext, "Test Issue", "This is a test issue", ["bug", "help wanted"]);
      expect(issue.data.number).toBe(124);
      expect(mockContext.octokit.issues.create).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
        title: "Test Issue",
        body: "This is a test issue",
        labels: ["bug", "help wanted"]
      });
    });

    it("should handle createIssue error", async () => {
      const mockContext = createMockContext();
      
      const error = new Error("API Error");
      mockContext.octokit.issues.create.mockRejectedValue(error);

      await expect(createIssue(mockContext, "Test Issue", "This is a test issue"))
        .rejects.toThrow("API Error");
      expect(mockContext.log.error).toHaveBeenCalled();
    });

    it("should handle reportError without creating issue", async () => {
      const mockContext = createMockContext();
      
      const error = new Error("Test error");
      await reportError(mockContext, "Test action", error, false);
      
      expect(mockContext.log.error).toHaveBeenCalledWith("Test action failed: Test error");
      expect(mockContext.octokit.issues.create).not.toHaveBeenCalled();
    });

    it("should handle reportError with issue creation", async () => {
      const mockContext = createMockContext();
      
      mockContext.octokit.issues.create.mockResolvedValue({
        data: { number: 125 }
      });

      const error = new Error("Test error");
      await reportError(mockContext, "Test action", error, true);
      
      expect(mockContext.log.error).toHaveBeenCalledWith("Test action failed: Test error");
      expect(mockContext.octokit.issues.create).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
        title: "🚨 Automation Error: Test action",
        body: expect.stringContaining("Test error"),
        labels: ["bug", "automation"]
      });
    });

    it("should handle registerToHub successfully", async () => {
      const mockContext = createMockContext();
      
      // Mock registry file
      mockContext.octokit.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify({ 
            projects: [], 
            total_projects: 0, 
            updated: new Date().toISOString() 
          })).toString('base64'),
          sha: 'abc123'
        }
      });

      // Mock main branch
      mockContext.octokit.repos.getBranch.mockResolvedValue({
        data: { commit: { sha: 'main-sha' } }
      });
      
      // Mock successful branch creation
      mockContext.octokit.git.createRef.mockResolvedValue({
        data: { ref: 'refs/heads/test-branch' }
      });

      // Mock file update
      mockContext.octokit.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { commit: { sha: 'new-commit-sha' } }
      });

      // Mock successful PR creation and merge
      mockContext.octokit.pulls.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/pull/1' }
      });
      mockContext.octokit.pulls.merge.mockResolvedValue({
        data: { merged: true }
      });

      const projectInfo = {
        name: "test-project",
        owner: "testuser",
        repo: "test-repo",
        description: "Test description",
        version: "1.0.0",
        language: "python"
      };

      const result = await registerToHub(mockContext, projectInfo);
      expect(result.number).toBe(1);
      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Project registration successful')
      );
    });

    it("should handle registerToHub with registry file not found", async () => {
      const mockContext = createMockContext();
      
      // Mock registry file not found - use object instead of Error constructor
      const fileError = { message: "Not Found", status: 404 };
      mockContext.octokit.repos.getContent.mockRejectedValue(fileError);

      const projectInfo = {
        name: "test-project",
        owner: "testuser", 
        repo: "test-repo",
        description: "Test description",
        version: "1.0.0",
        language: "python"
      };

      await expect(registerToHub(mockContext, projectInfo)).rejects.toMatchObject({
        message: "Not Found",
        status: 404
      });
      expect(mockContext.log.error).toHaveBeenCalled();
    });

    it("should handle registerToHub with registry as directory", async () => {
      const mockContext = createMockContext();
      
      // Mock registry.json as directory
      mockContext.octokit.repos.getContent.mockResolvedValue({
        data: [] // Array indicates directory
      });

      const projectInfo = {
        name: "test-project",
        owner: "testuser",
        repo: "test-repo", 
        description: "Test description",
        version: "1.0.0",
        language: "python"
      };

      await expect(registerToHub(mockContext, projectInfo)).rejects.toThrow("registry.json is a directory");
    });

    it("should handle getFileContent with directory response", async () => {
      const mockContext = createMockContext();
      
      mockContext.octokit.repos.getContent.mockResolvedValue({
        data: [] // Array indicates directory
      });

      const content = await getFileContent(mockContext, "src/");
      expect(content).toBeNull();
      expect(mockContext.log.error).toHaveBeenCalledWith(
        expect.stringContaining("Path src/ is a directory, not a file")
      );
    });

    it("should handle getFileContent with non-file type", async () => {
      const mockContext = createMockContext();
      
      mockContext.octokit.repos.getContent.mockResolvedValue({
        data: { type: "symlink", content: "base64content" }
      });

      const content = await getFileContent(mockContext, "symlink-file");
      expect(content).toBeNull();
      expect(mockContext.log.error).toHaveBeenCalledWith(
        expect.stringContaining("Path symlink-file is not a file")
      );
    });

    it("should handle reportError with string error", async () => {
      const mockContext = createMockContext();
      
      await reportError(mockContext, "test action", "String error message", false);
      expect(mockContext.log.error).toHaveBeenCalledWith(
        "test action failed: String error message"
      );
    });

    it("should handle pushFilesToRepository with directory in getContent", async () => {
      const mockContext = createMockContext();
      
      mockContext.octokit.repos.get.mockResolvedValue({
        data: { default_branch: "main" }
      });
      
      // Mock getContent returning directory for existing file check
      mockContext.octokit.repos.getContent.mockResolvedValue({
        data: [] // Directory
      });
      
      mockContext.octokit.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { commit: { sha: "new-sha" } }
      });

      const files: FileContent[] = [
        { path: "test.txt", content: "test content", message: "Add test file" }
      ];

      await pushFilesToRepository(mockContext, "testuser", "test-repo", files);
      
      // Should still create the file
      expect(mockContext.octokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
        path: "test.txt",
        message: "Add test file",
        content: Buffer.from("test content").toString('base64'),
        branch: "main"
      });
    });
  });
}); 