import nock from "nock";
import myProbotApp from "../src/index";
import { Probot, ProbotOctokit } from "probot";
import fs from "fs";
import path from "path";

const testDir = path.join(process.cwd(), 'test');

const privateKey = fs.readFileSync(
  path.join(testDir, "fixtures/mock-cert.pem"),
  "utf-8",
);

const issuesPayload = JSON.parse(
  fs.readFileSync(path.join(testDir, "fixtures/issues.opened.json"), "utf-8"),
);

const pushPayload = JSON.parse(
  fs.readFileSync(path.join(testDir, "fixtures/push.json"), "utf-8"),
);

describe("MCP Project Manager", () => {
  let probot: any;

  beforeEach(() => {
    nock.disableNetConnect();
    probot = new Probot({
      appId: 123,
      privateKey,
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });
    probot.load(myProbotApp);
  });

  test("handles issues.opened event", async () => {
    const mock = nock("https://api.github.com")
      .post("/app/installations/2/access_tokens")
      .reply(200, {
        token: "test",
        permissions: {
          issues: "write",
        },
      })
      .post("/repos/hiimbex/testing-things/issues/1/comments", (body: any) => {
        expect(body).toEqual(
          expect.objectContaining({
            body: expect.stringContaining("Thank you for submitting an MCP-related Issue"),
          })
        );
        return true;
      })
      .reply(200);

    await probot.receive({ name: "issues", payload: issuesPayload });

    const pendingMocks = mock.pendingMocks();
    if (pendingMocks.length > 0) {
      console.log('Pending mocks:', pendingMocks);
    }
    expect(pendingMocks).toStrictEqual([]);
  });

  test("handles push event", async () => {
    await probot.receive({ name: "push", payload: pushPayload });
    expect(nock.pendingMocks()).toStrictEqual([]);
  });

  test("handles pull_request event", async () => {
    const pullRequestPayload = {
      action: "opened",
      number: 1,
      pull_request: {
        id: 1,
        number: 1,
        title: "Test PR",
        head: {
          sha: "abc123",
        },
        base: {
          ref: "main",
        },
      },
      repository: {
        id: 1,
        name: "testing-things",
        full_name: "hiimbex/testing-things",
        owner: {
          login: "hiimbex",
        },
      },
      installation: {
        id: 2,
      },
    };

    const mock = nock("https://api.github.com")
      .post("/app/installations/2/access_tokens")
      .reply(200, {
        token: "test",
        permissions: {
          pull_requests: "write",
          contents: "read",
          issues: "write",
        },
      })
      .get("/repos/hiimbex/testing-things/pulls/1/files")
      .reply(200, [
        { filename: "projects/test-project/package.json" },
      ])
      .get("/repos/hiimbex/testing-things/contents/projects%2Ftest-project%2Fpackage.json?ref=abc123")
      .reply(404, { message: "Not Found" })
      .get("/repos/hiimbex/testing-things/contents/projects%2Ftest-project%2FREADME.md?ref=abc123")
      .reply(404, { message: "Not Found" })
      .post("/repos/hiimbex/testing-things/issues/1/comments")
      .reply(200, { id: 1 });

    await probot.receive({ name: "pull_request", payload: pullRequestPayload });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test("handles release event", async () => {
    const releasePayload = {
      action: "published",
      release: {
        tag_name: "v1.0.0",
        name: "Release v1.0.0",
      },
      repository: {
        id: 1,
        name: "testing-things",
        full_name: "hiimbex/testing-things",
        owner: {
          login: "hiimbex",
        },
      },
      installation: {
        id: 2,
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
      .post("/repos/hiimbex/testing-things/issues")
      .reply(200, {
        number: 1,
        html_url: "https://github.com/hiimbex/testing-things/issues/1",
      });

    await probot.receive({ name: "release", payload: releasePayload });

    expect(mock.pendingMocks()).toStrictEqual([]);
  }, 10000);

  test("handles repository event", async () => {
    const repositoryPayload = {
      action: "created",
      repository: {
        id: 1,
        name: "new-repo",
        full_name: "hiimbex/new-repo",
        owner: {
          login: "hiimbex",
        },
      },
      installation: {
        id: 2,
      },
    };

    await probot.receive({ name: "repository", payload: repositoryPayload });
    expect(nock.pendingMocks()).toStrictEqual([]);
  });

  test("handles installation event", async () => {
    const installationPayload = {
      action: "created",
      installation: {
        id: 2,
        account: {
          login: "hiimbex",
        },
      },
    };

    await probot.receive({ name: "installation", payload: installationPayload });
    expect(nock.pendingMocks()).toStrictEqual([]);
  });

  test("handles installation.deleted event", async () => {
    const installationPayload = {
      action: "deleted",
      installation: {
        id: 2,
        account: {
          login: "hiimbex",
        },
      },
    };

    await probot.receive({ name: "installation", payload: installationPayload });
    expect(nock.pendingMocks()).toStrictEqual([]);
  });

  test("handles issues.labeled event", async () => {
    const labeledPayload = {
      ...issuesPayload,
      action: "labeled",
      label: {
        name: "mcp-server",
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
      .reply(200);

    await probot.receive({ name: "issues", payload: labeledPayload });
    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test("handles pull_request.synchronize event", async () => {
    const syncPayload = {
      action: "synchronize",
      number: 1,
      pull_request: {
        id: 1,
        number: 1,
        title: "Test PR",
        head: {
          sha: "def456",
        },
        base: {
          ref: "main",
        },
      },
      repository: {
        id: 1,
        name: "testing-things",
        full_name: "hiimbex/testing-things",
        owner: {
          login: "hiimbex",
        },
      },
      installation: {
        id: 2,
      },
    };

    const mock = nock("https://api.github.com")
      .post("/app/installations/2/access_tokens")
      .reply(200, {
        token: "test",
        permissions: {
          pull_requests: "write",
          contents: "read",
          issues: "write",
        },
      })
      .get("/repos/hiimbex/testing-things/pulls/1/files")
      .reply(200, []);

    await probot.receive({ name: "pull_request", payload: syncPayload });
    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test("handles pull_request.closed event", async () => {
    const closedPayload = {
      action: "closed",
      number: 1,
      pull_request: {
        id: 1,
        number: 1,
        title: "Test PR",
        merged: true,
        head: {
          sha: "def456",
        },
        base: {
          ref: "main",
        },
      },
      repository: {
        id: 1,
        name: "testing-things",
        full_name: "hiimbex/testing-things",
        owner: {
          login: "hiimbex",
        },
      },
      installation: {
        id: 2,
      },
    };

    await probot.receive({ name: "pull_request", payload: closedPayload });
    expect(nock.pendingMocks()).toStrictEqual([]);
  });

  // Error handling tests
  test("handles global errors", async () => {
    const originalOnError = probot.onError;
    
    probot.onError = jest.fn().mockImplementation(async (error) => {
      expect(error).toBeInstanceOf(Error);
    });

    // Trigger an error by providing invalid event
    try {
      await probot.receive({ name: "unknown_event", payload: {} });
    } catch (error) {
      // Expected to fail
    }

    probot.onError = originalOnError;
  });

  test("handles errors in event handlers", async () => {
    // Mock webhook handler to throw an error
    const originalLog = console.error;
    console.error = jest.fn();

    const errorPayload = {
      action: "opened",
      issue: {
        number: 1,
        title: "Error test",
        body: "This should trigger an error",
      },
      repository: {
        id: 1,
        name: "testing-things",
        full_name: "hiimbex/testing-things",
        owner: {
          login: "hiimbex",
        },
      },
      installation: {
        id: 2,
      },
    };

    await probot.receive({ name: "issues", payload: errorPayload });

    console.error = originalLog;
    // No mock expectations since we just want to test error handling
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
}); 