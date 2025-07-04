import express, { Request, Response, Application } from "express";
import { WebhookHandler, PublishRequest } from "./webhook-handler";
import { Probot } from "probot";
import { ProbotContext } from "./types";

/**
 * API Server - Handle REST API requests independently
 */
export class ApiServer {
  private app: Application;
  private webhookHandler: WebhookHandler;
  private probotInstance?: Probot;

  constructor() {
    this.app = express();
    this.webhookHandler = new WebhookHandler();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Set up Probot instance (for API calls)
   */
  setProbotInstance(probot: Probot) {
    this.probotInstance = probot;
  }

  /**
   * Set up middleware
   */
  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS support
    this.app.use((_req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      next();
    });
  }

  /**
   * Set up API routes
   */
  private setupRoutes() {
    // Health check
    this.app.get("/health", (_req: Request, res: Response) => {
      res.status(200).json({
        status: "healthy",
        service: "MCP Project Manager API",
        timestamp: new Date().toISOString(),
      });
    });

    // Publish API endpoint
    this.app.post("/api/publish", async (req: Request, res: Response) => {
      try {
        console.log("📡 Received publish API request");

        // Validate request body
        if (!req.body || typeof req.body !== "object") {
          res.status(400).json({
            success: false,
            error: "Invalid request body",
          });
          return;
        }

        if (!this.probotInstance) {
          res.status(500).json({
            success: false,
            error: "Probot instance not initialized",
          });
          return;
        }

        // Create virtual context
        const appOctokit = await this.probotInstance.auth();
        const mockContext = {
          octokit: appOctokit,
          log: console,
          payload: {
            installation: req.body.installation || {
              account: { login: req.body.owner },
            },
          },
        };

        const publishRequest: PublishRequest = {
          projectName: req.body.projectName,
          description: req.body.description,
          version: req.body.version,
          language: req.body.language,
          category: req.body.category,
          tags: req.body.tags,
          files: req.body.files,
          packageJson: req.body.packageJson,
          owner: req.body.owner,
          repoName: req.body.repoName,
        };

        const result = await this.webhookHandler.handlePublishRequest(
          mockContext as unknown as ProbotContext,
          publishRequest
        );

        res.status(result.success ? 200 : 400).json(result);
      } catch (error) {
        console.error(`❌ Publish API processing failed: ${error}`);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Internal server error",
        });
      }
    });

    // Status check API
    this.app.get("/api/status", (_req: Request, res: Response) => {
      res.status(200).json({
        status: "healthy",
        service: "MCP Project Manager",
        version: process.env["npm_package_version"] || "1.0.0",
        timestamp: new Date().toISOString(),
        features: [
          "Account-level permissions",
          "Repository creation",
          "Automated publishing",
          "Hub registration",
        ],
      });
    });

    // App info API
    this.app.get("/api/info", (_req: Request, res: Response) => {
      res.status(200).json({
        name: "MCP Project Manager",
        description: "🤖 Automated MCP server project creation, publishing and registration management",
        features: [
            "One-click GitHub repository creation",
            "Automatic project code push",
            "Intelligent project validation",
            "Automatic registration to MCP server hub",
        ],
        permissions: {
          repository: ["contents:write", "issues:write", "pull_requests:write", "metadata:read"],
          account: ["administration:write", "profile:read"],
        },
        installation_url: "https://github.com/apps/mcp-project-manager",
        documentation: "https://github.com/mcp-servers-hub/mcp-project-manager",
      });
    });

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        error: "Not Found",
        message: "API endpoint not found",
      });
    });
  }

  /**
   * Start server
   */
  start(port: number = 3001): Promise<void> {
    return new Promise(resolve => {
      this.app.listen(port, () => {
        console.log(`✅ MCP Project Manager API server running on port ${port}`);
        resolve();
      });
    });
  }

  /**
   * Get Express app instance
   */
  getApp(): Application {
    return this.app;
  }
}
