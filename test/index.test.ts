// You can import your modules
// import index from '../src/index'

import nock from "nock";
// Requiring our app implementation
import myProbotApp from "../src/index.js";
import { Probot, ProbotOctokit } from "probot";
// Requiring our fixtures
//import payload from "./fixtures/issues.opened.json" with { "type": "json"};
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, beforeEach, afterEach, test, expect } from "vitest";

const issueCreatedBody = {
  body: expect.stringContaining("MCP Factory Project Status"),
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const privateKey = fs.readFileSync(
  path.join(__dirname, "fixtures/mock-cert.pem"),
  "utf-8"
);

const payload = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/issues.opened.json"), "utf-8")
);

const testDir = path.join(process.cwd(), "test");

// Load test data
const issuesPayload = JSON.parse(
  fs.readFileSync(path.join(testDir, "fixtures/issues.opened.json"), "utf-8")
);

const pushPayload = JSON.parse(
  fs.readFileSync(path.join(testDir, "fixtures/push.json"), "utf-8")
);

const pullRequestPayload = JSON.parse(
  fs.readFileSync(
    path.join(testDir, "fixtures/pull_request.opened.json"),
    "utf-8"
  )
);

const releasePayload = JSON.parse(
  fs.readFileSync(
    path.join(testDir, "fixtures/release.published.json"),
    "utf-8"
  )
);

const installationPayload = JSON.parse(
  fs.readFileSync(
    path.join(testDir, "fixtures/installation.created.json"),
    "utf-8"
  )
);

const repositoryPayload = JSON.parse(
  fs.readFileSync(
    path.join(testDir, "fixtures/repository.created.json"),
    "utf-8"
  )
);

describe("MCP Project Manager", () => {
  let probot: any;

  beforeEach(() => {
    nock.disableNetConnect();
    probot = new Probot({
      appId: 123,
      privateKey,
      // disable request throttling and retries for testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });
    // Load our app into probot
    probot.load(myProbotApp);
  });

  test("creates a comment when an issue is opened", async () => {
    const mock = nock("https://api.github.com")
      // Test that we correctly return a test token
      .post("/app/installations/2/access_tokens")
      .reply(200, {
        token: "test",
        permissions: {
          issues: "write",
        },
      })
      // Mock file detection calls for Python MCP Factory project
      .get(uri =>
        uri.includes("/repos/hiimbex/testing-things/contents/pyproject.toml")
      )
      .reply(200, {
        content: Buffer.from(
          `[project]
name = "test-mcp-server"
version = "1.0.0"
description = "A test MCP server"
dependencies = [
    "mcp",
    "mcp-factory>=0.1.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"`
        ).toString("base64"),
        encoding: "base64",
      })
      // Mock required files for structure check
      .get(uri =>
        uri.includes("/repos/hiimbex/testing-things/contents/server.py")
      )
      .reply(200, {
        content: Buffer.from("# MCP Server implementation").toString("base64"),
        encoding: "base64",
      })
      .get(uri =>
        uri.includes("/repos/hiimbex/testing-things/contents/README.md")
      )
      .reply(200, {
        content: Buffer.from("# Test MCP Server").toString("base64"),
        encoding: "base64",
      })
      // Mock required directories
      .get(uri => uri.includes("/repos/hiimbex/testing-things/contents/tools"))
      .reply(200, [])
      .get(uri =>
        uri.includes("/repos/hiimbex/testing-things/contents/resources")
      )
      .reply(200, [])
      .get(uri =>
        uri.includes("/repos/hiimbex/testing-things/contents/prompts")
      )
      .reply(200, [])
      // Test that a comment is posted
      .post("/repos/hiimbex/testing-things/issues/1/comments", (body: any) => {
        expect(body).toMatchObject(issueCreatedBody);
        return true;
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({ name: "issues", payload });

    expect(mock.pendingMocks()).toStrictEqual([]);
  }, 10000); // Increase timeout to 10 seconds

  beforeEach(() => {
    nock.disableNetConnect(); // Ensure all requests must go through mocks
  });

  afterEach(() => {
    if (!nock.isDone()) {
      // Debug: Check pending mocks if needed
      // console.log("Pending mocks:", nock.pendingMocks());
    }
    nock.cleanAll();
    nock.enableNetConnect();
  });

  describe("Issues Events", () => {
    test("creates a comment when an MCP-related issue is opened", async () => {
      const mock = nock("https://api.github.com")
        .post("/app/installations/2/access_tokens")
        .reply(200, {
          token: "test",
          permissions: {
            issues: "write",
          },
        })
        // Mock file detection calls for Python MCP Factory project (with query params)
        .get(uri =>
          uri.includes("/repos/hiimbex/testing-things/contents/pyproject.toml")
        )
        .reply(200, {
          content: Buffer.from(
            `[project]
name = "test-mcp-server"
version = "1.0.0"
description = "A test MCP server"
dependencies = [
    "mcp",
    "mcp-factory>=0.1.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"`
          ).toString("base64"),
          encoding: "base64",
        })
        // Mock required files for structure check
        .get(uri =>
          uri.includes("/repos/hiimbex/testing-things/contents/server.py")
        )
        .reply(200, {
          content: Buffer.from("# MCP Server implementation").toString(
            "base64"
          ),
          encoding: "base64",
        })
        .get(uri =>
          uri.includes("/repos/hiimbex/testing-things/contents/README.md")
        )
        .reply(200, {
          content: Buffer.from("# Test MCP Server").toString("base64"),
          encoding: "base64",
        })
        // Mock required directories
        .get(uri =>
          uri.includes("/repos/hiimbex/testing-things/contents/tools")
        )
        .reply(200, [])
        .get(uri =>
          uri.includes("/repos/hiimbex/testing-things/contents/resources")
        )
        .reply(200, [])
        .get(uri =>
          uri.includes("/repos/hiimbex/testing-things/contents/prompts")
        )
        .reply(200, [])
        .post(
          "/repos/hiimbex/testing-things/issues/1/comments",
          (body: any) => {
            expect(body).toEqual(
              expect.objectContaining({
                body: expect.stringContaining("MCP Factory Project Status"),
              })
            );
            return true;
          }
        )
        .reply(200);

      await probot.receive({ name: "issues", payload: issuesPayload });

      expect(mock.pendingMocks()).toStrictEqual([]);
    }, 10000); // Increase timeout to 10 seconds

    test("ignores non-MCP related issues", async () => {
      const nonMcpIssue = {
        ...issuesPayload,
        issue: {
          ...issuesPayload.issue,
          title: "Regular bug report",
          body: "This is a regular issue without MCP keywords",
          labels: [],
        },
      };

      await probot.receive({ name: "issues", payload: nonMcpIssue });

      expect(nock.pendingMocks()).toStrictEqual([]);
    });
  });

  describe("Push Events", () => {
    test("handles push to main branch", async () => {
      nock.disableNetConnect(); // Ensure all requests must go through mocks

      const mock = nock("https://api.github.com")
        .post("/app/installations/2/access_tokens")
        .reply(200, {
          token: "test",
          permissions: {
            contents: "read",
            issues: "write",
          },
        })
        // Mock file detection calls for Python MCP Factory project
        .get(
          "/repos/hiimbex/testing-things/contents/pyproject.toml?ref=refs/heads/main"
        )
        .reply(200, {
          content: Buffer.from(
            `[project]
name = "test-mcp-server"
version = "1.0.0"
description = "A test MCP server"
dependencies = [
    "mcp",
    "mcp-factory>=0.1.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"`
          ).toString("base64"),
          encoding: "base64",
        });

      await probot.receive({ name: "push", payload: pushPayload });

      expect(mock.pendingMocks()).toStrictEqual([]);
      nock.enableNetConnect(); // Re-enable for cleanup
    });

    test("ignores push to non-main branch", async () => {
      const nonMainPush = {
        ...pushPayload,
        ref: "refs/heads/feature-branch",
      };

      await probot.receive({ name: "push", payload: nonMainPush });

      expect(nock.pendingMocks()).toStrictEqual([]);
    });
  });

  describe("Pull Request Events", () => {
    test("handles pull request opened", async () => {
      nock.disableNetConnect(); // Ensure all requests must go through mocks

      const mock = nock("https://api.github.com")
        .post("/app/installations/2/access_tokens")
        .reply(200, {
          token: "test",
          permissions: {
            pull_requests: "write",
            issues: "write",
          },
        })
        // Mock file detection calls for Python MCP Factory project
        .get("/repos/hiimbex/testing-things/contents/pyproject.toml?ref=abc123")
        .reply(200, {
          content: Buffer.from(
            `[project]
name = "test-mcp-server"
version = "1.0.0"
description = "A test MCP server"
dependencies = [
    "mcp",
    "mcp-factory>=0.1.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"`
          ).toString("base64"),
          encoding: "base64",
        })
        // Mock required files for structure check
        .get("/repos/hiimbex/testing-things/contents/server.py?ref=abc123")
        .reply(200, {
          content: Buffer.from("# MCP Server implementation").toString(
            "base64"
          ),
          encoding: "base64",
        })
        .get("/repos/hiimbex/testing-things/contents/README.md?ref=abc123")
        .reply(200, {
          content: Buffer.from("# Test MCP Server").toString("base64"),
          encoding: "base64",
        })
        // Mock required directories
        .get("/repos/hiimbex/testing-things/contents/tools?ref=abc123")
        .reply(200, [])
        .get("/repos/hiimbex/testing-things/contents/resources?ref=abc123")
        .reply(200, [])
        .get("/repos/hiimbex/testing-things/contents/prompts?ref=abc123")
        .reply(200, [])
        .post("/repos/hiimbex/testing-things/issues/1/comments")
        .reply(200, { id: 1 });

      await probot.receive({
        name: "pull_request",
        payload: pullRequestPayload,
      });

      expect(mock.pendingMocks()).toStrictEqual([]);
      nock.enableNetConnect(); // Re-enable for cleanup
    });

    test("handles pull request merged", async () => {
      const mergedPR = {
        ...pullRequestPayload,
        action: "closed",
        pull_request: {
          ...pullRequestPayload.pull_request,
          merged: true,
        },
      };

      // No mocks needed since we don't handle merged PRs
      await probot.receive({ name: "pull_request", payload: mergedPR });

      // No API calls should be made for merged PRs
      expect(nock.pendingMocks()).toStrictEqual([]);
    });
  });

  describe("Release Events", () => {
    test("handles release published", async () => {
      // No mocks needed since we don't handle release events currently
      await probot.receive({ name: "release", payload: releasePayload });

      // No API calls should be made for release events
      expect(nock.pendingMocks()).toStrictEqual([]);
    });

    test("ignores draft releases", async () => {
      const draftRelease = {
        ...releasePayload,
        release: {
          ...releasePayload.release,
          draft: true,
        },
      };

      await probot.receive({ name: "release", payload: draftRelease });

      expect(nock.pendingMocks()).toStrictEqual([]);
    });
  });

  describe("Installation Events", () => {
    test("handles installation created", async () => {
      // No API calls are expected for installation created (just logging)
      await probot.receive({
        name: "installation",
        payload: installationPayload,
      });

      expect(nock.pendingMocks()).toStrictEqual([]);
    });

    test("handles installation deleted", async () => {
      const deletedInstallation = {
        ...installationPayload,
        action: "deleted",
      };

      await probot.receive({
        name: "installation",
        payload: deletedInstallation,
      });

      expect(nock.pendingMocks()).toStrictEqual([]);
    });
  });

  describe("Repository Events", () => {
    test("handles MCP repository created", async () => {
      const mock = nock("https://api.github.com")
        .post("/app/installations/2/access_tokens")
        .reply(200, {
          token: "test",
          permissions: {
            contents: "read",
            issues: "write",
          },
        })
        // Mock MCP Factory project detection calls (with query params)
        .get(uri =>
          uri.includes("/repos/hiimbex/new-mcp-server/contents/pyproject.toml")
        )
        .reply(200, {
          content: Buffer.from(
            `[project]
name = "test-mcp-server"
version = "1.0.0"
description = "A test MCP server"
dependencies = [
    "mcp",
    "mcp-factory>=0.1.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"`
          ).toString("base64"),
          encoding: "base64",
        })
        // Mock required files for structure check
        .get(uri =>
          uri.includes("/repos/hiimbex/new-mcp-server/contents/server.py")
        )
        .reply(200, {
          content: Buffer.from("# MCP Server implementation").toString(
            "base64"
          ),
          encoding: "base64",
        })
        .get(uri =>
          uri.includes("/repos/hiimbex/new-mcp-server/contents/README.md")
        )
        .reply(200, {
          content: Buffer.from("# Test MCP Server").toString("base64"),
          encoding: "base64",
        })
        // Mock required directories
        .get(uri =>
          uri.includes("/repos/hiimbex/new-mcp-server/contents/tools")
        )
        .reply(200, [])
        .get(uri =>
          uri.includes("/repos/hiimbex/new-mcp-server/contents/resources")
        )
        .reply(200, [])
        .get(uri =>
          uri.includes("/repos/hiimbex/new-mcp-server/contents/prompts")
        )
        .reply(200, [])
        .post("/repos/hiimbex/new-mcp-server/issues")
        .reply(200, { id: 1, number: 1 });

      await probot.receive({ name: "repository", payload: repositoryPayload });

      expect(mock.pendingMocks()).toStrictEqual([]);
    }, 15000); // Increase timeout to 15 seconds for repository creation delay

    test("ignores non-MCP repository", async () => {
      const nonMcpRepo = {
        ...repositoryPayload,
        repository: {
          ...repositoryPayload.repository,
          name: "regular-repo",
          description: "A regular repository without MCP keywords",
        },
      };

      const mock = nock("https://api.github.com")
        .post("/app/installations/2/access_tokens")
        .reply(200, {
          token: "test",
          permissions: {
            contents: "read",
          },
        })
        // Mock file detection calls that will fail (not an MCP Factory project)
        .get(uri =>
          uri.includes("/repos/hiimbex/regular-repo/contents/pyproject.toml")
        )
        .reply(404);

      await probot.receive({ name: "repository", payload: nonMcpRepo });

      expect(mock.pendingMocks()).toStrictEqual([]);
    }, 10000); // Increase timeout to 10 seconds
  });

  describe("Error Handling", () => {
    test("handles GitHub API errors gracefully", async () => {
      const mock = nock("https://api.github.com")
        .post("/app/installations/2/access_tokens")
        .reply(200, {
          token: "test",
          permissions: {
            issues: "write",
          },
        })
        // Mock file detection calls for non-MCP Factory project (with query params)
        .get(uri =>
          uri.includes("/repos/hiimbex/testing-things/contents/pyproject.toml")
        )
        .reply(404)
        .post("/repos/hiimbex/testing-things/issues/1/comments")
        .reply(200);

      // Should not throw errors, but handle gracefully
      await expect(
        probot.receive({ name: "issues", payload: issuesPayload })
      ).resolves.not.toThrow();

      // The pyproject.toml call is made but other files aren't needed for 404 case
      expect(mock.pendingMocks()).toHaveLength(0);
    });

    test("handles missing installation", async () => {
      const payloadWithoutInstallation = {
        ...issuesPayload,
        installation: undefined,
      };

      // Should not throw errors
      await expect(
        probot.receive({ name: "issues", payload: payloadWithoutInstallation })
      ).resolves.not.toThrow();

      expect(nock.pendingMocks()).toStrictEqual([]);
    });
  });
});

// For more information about testing with Jest see:
// https://facebook.github.io/jest/

// For more information about using TypeScript in your tests, Jest recommends:
// https://github.com/kulshekhar/ts-jest

// For more information about testing with Nock see:
// https://github.com/nock/nock
