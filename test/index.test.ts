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
  body: `👋 Thanks for opening this MCP-related issue! 

🤖 **MCP Project Manager** is here to help. If this is about:
- 🚀 **Project Registration**: I can help register your MCP server
- 🔍 **Validation Issues**: I can check your project structure
- 🛠️ **Setup Problems**: I can provide guidance on MCP development

Feel free to add relevant labels or mention specific requirements!`,
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

      // Test that a comment is posted
      .post("/repos/hiimbex/testing-things/issues/1/comments", (body: any) => {
        expect(body).toMatchObject(issueCreatedBody);
        return true;
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({ name: "issues", payload });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  afterEach(() => {
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
        .post(
          "/repos/hiimbex/testing-things/issues/1/comments",
          (body: any) => {
            expect(body).toEqual(
              expect.objectContaining({
                body: expect.stringContaining("MCP-related issue"),
              })
            );
            return true;
          }
        )
        .reply(200);

      await probot.receive({ name: "issues", payload: issuesPayload });

      expect(mock.pendingMocks()).toStrictEqual([]);
    });

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
      const mock = nock("https://api.github.com")
        .post("/app/installations/2/access_tokens")
        .reply(200, {
          token: "test",
          permissions: {
            contents: "read",
            issues: "write",
          },
        })
        .get("/repos/hiimbex/testing-things/contents/package.json")
        .reply(200, {
          content: Buffer.from(
            JSON.stringify({
              name: "test-mcp-server",
              dependencies: {
                "@modelcontextprotocol/sdk": "^1.0.0",
              },
            })
          ).toString("base64"),
        })
        // Mock validation calls
        .get("/repos/hiimbex/testing-things/contents/package.json")
        .reply(200, {
          content: Buffer.from(
            JSON.stringify({
              name: "test-mcp-server",
              description: "A test MCP server",
              main: "index.js",
              dependencies: {
                "@modelcontextprotocol/sdk": "^1.0.0",
              },
            })
          ).toString("base64"),
        })
        .get("/repos/hiimbex/testing-things/contents/README.md")
        .reply(200, {
          content: Buffer.from("# Test MCP Server").toString("base64"),
        });

      await probot.receive({ name: "push", payload: pushPayload });

      expect(mock.pendingMocks()).toStrictEqual([]);
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
      const mock = nock("https://api.github.com")
        .post("/app/installations/2/access_tokens")
        .reply(200, {
          token: "test",
          permissions: {
            pull_requests: "write",
            issues: "write",
          },
        })
        .post("/repos/hiimbex/testing-things/issues/1/comments")
        .reply(200, { id: 1 });

      await probot.receive({
        name: "pull_request",
        payload: pullRequestPayload,
      });

      expect(mock.pendingMocks()).toStrictEqual([]);
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

      const mock = nock("https://api.github.com")
        .post("/app/installations/2/access_tokens")
        .reply(200, {
          token: "test",
          permissions: {
            issues: "write",
          },
        })
        .post("/repos/hiimbex/testing-things/issues/1/comments")
        .reply(200, { id: 1 });

      await probot.receive({ name: "pull_request", payload: mergedPR });

      expect(mock.pendingMocks()).toStrictEqual([]);
    });
  });

  describe("Release Events", () => {
    test("handles release published", async () => {
      const mock = nock("https://api.github.com")
        .post("/app/installations/2/access_tokens")
        .reply(200, {
          token: "test",
          permissions: {
            contents: "read",
            issues: "write",
          },
        })
        .get("/repos/hiimbex/testing-things/contents/package.json?ref=v1.0.0")
        .reply(200, {
          content: Buffer.from(
            JSON.stringify({
              name: "test-mcp-server",
              dependencies: {
                "@modelcontextprotocol/sdk": "^1.0.0",
              },
            })
          ).toString("base64"),
        });

      await probot.receive({ name: "release", payload: releasePayload });

      expect(mock.pendingMocks()).toStrictEqual([]);
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
      // For repository events, no API calls are expected in the current implementation
      await probot.receive({ name: "repository", payload: repositoryPayload });

      expect(nock.pendingMocks()).toStrictEqual([]);
    });

    test("ignores non-MCP repository", async () => {
      const nonMcpRepo = {
        ...repositoryPayload,
        repository: {
          ...repositoryPayload.repository,
          name: "regular-repo",
          description: "A regular repository without MCP keywords",
        },
      };

      await probot.receive({ name: "repository", payload: nonMcpRepo });

      expect(nock.pendingMocks()).toStrictEqual([]);
    });
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
        .post("/repos/hiimbex/testing-things/issues/1/comments")
        .reply(500, { message: "Internal Server Error" });

      // Should not throw errors, but handle gracefully
      await expect(
        probot.receive({ name: "issues", payload: issuesPayload })
      ).resolves.not.toThrow();

      expect(mock.pendingMocks()).toStrictEqual([]);
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
