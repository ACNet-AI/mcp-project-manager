import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  extractProjectInfo,
  validateRegistrationData,
} from "../src/utils/registry.js";
import {
  parsePyProjectToml,
  validateMCPFactoryProject,
} from "../src/utils/validation.js";

/**
 * Vercel API function for external project publishing
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    let publishRequest: any;

    // Read request body manually for Vercel compatibility
    if (!req.body) {
      // For Vercel functions, we need to read the raw stream
      const chunks: any[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString();
      console.log("Raw body:", rawBody);

      if (rawBody) {
        try {
          publishRequest = JSON.parse(rawBody);
        } catch (parseError) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      }
    } else {
      publishRequest = req.body;
    }

    console.log("Parsed request:", publishRequest);

    if (!publishRequest) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: "Request body is required" }));
    }

    // Validate request data
    if (
      !publishRequest.projectName ||
      !publishRequest.files ||
      !publishRequest.language
    ) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "Missing required fields: projectName, files, language",
          received: Object.keys(publishRequest || {}),
        })
      );
    }

    let projectConfig: any = null;
    let projectInfo: any = null;
    const language = publishRequest.language.toLowerCase();

    // Handle different project types based on language
    if (language === "python") {
      // Look for pyproject.toml for Python projects
      let pyprojectContent: string | null = null;
      
      if (publishRequest.pyprojectToml) {
        pyprojectContent = publishRequest.pyprojectToml;
      } else {
        // Try to find pyproject.toml in files
        const pyprojectFile = publishRequest.files.find(
          (f: any) => f.path === "pyproject.toml"
        );
        if (pyprojectFile) {
          pyprojectContent = pyprojectFile.content;
        }
      }

      if (!pyprojectContent) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            error: "No valid pyproject.toml found for Python project",
          })
        );
      }

      // Parse pyproject.toml
      projectConfig = parsePyProjectToml(pyprojectContent);
      if (!projectConfig) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            error: "Invalid pyproject.toml format",
          })
        );
      }

      // Create project info for Python projects
      const owner = publishRequest.owner || "unknown";
      const repoName = publishRequest.repoName || publishRequest.projectName;
      
      projectInfo = {
        name: projectConfig.project?.name || publishRequest.projectName,
        version: projectConfig.project?.version || "1.0.0",
        description: projectConfig.project?.description || "",
        author: projectConfig.project?.authors?.[0]?.name || owner,
        keywords: projectConfig.project?.keywords || [],
        license: typeof projectConfig.project?.license === "string" 
          ? projectConfig.project.license 
          : projectConfig.project?.license?.text || "MIT",
        repository: `https://github.com/${owner}/${repoName}`,
        language: "python",
        type: "mcp-factory",
      };

      // Validate Python MCP Factory project
      const mcpProject = {
        type: "mcp-factory" as const,
        name: projectInfo.name,
        version: projectInfo.version,
        description: projectInfo.description,
        hasFactoryDependency: true, // We'll assume this for now
        structureCompliance: 1.0, // We'll assume this for now
        keywords: projectInfo.keywords,
        author: projectInfo.author,
        license: projectInfo.license,
        requiredFiles: { pyprojectToml: true, serverPy: true, readme: true },
        requiredDirectories: { tools: true, resources: true, prompts: true },
        pyprojectConfig: projectConfig,
      };

      const pythonValidation = validateMCPFactoryProject(mcpProject);
      if (!pythonValidation.isValid) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            error: "Invalid Python MCP Factory project",
            details: pythonValidation.errors,
          })
        );
      }

    } else if (language === "javascript" || language === "typescript" || language === "node.js") {
      // Handle Node.js projects (existing logic)
      let packageJson = null;
      if (publishRequest.packageJson) {
        packageJson = publishRequest.packageJson;
      } else {
        // Try to find package.json in files
        const packageJsonFile = publishRequest.files.find(
          (f: any) => f.path === "package.json"
        );
        if (packageJsonFile) {
          try {
            packageJson = JSON.parse(packageJsonFile.content);
          } catch (error) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            return res.end(
              JSON.stringify({
                error: "Invalid package.json format",
              })
            );
          }
        }
      }

      if (!packageJson) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            error: "No valid package.json found for Node.js project",
          })
        );
      }

      // Extract project info for registration
      const owner = publishRequest.owner || "unknown";
      const repoName = publishRequest.repoName || publishRequest.projectName;
      projectInfo = extractProjectInfo(packageJson, owner, repoName);

      // Validate registration data
      const registrationValidation = validateRegistrationData(projectInfo);
      if (!registrationValidation.isValid) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            error: "Invalid Node.js project data",
            details: registrationValidation.errors,
          })
        );
      }

    } else {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: `Unsupported project language: ${language}. Supported languages: python, javascript, typescript, node.js`,
        })
      );
    }

    // Validate common request data
    const errors: string[] = [];
    if (!publishRequest.projectName) errors.push("Project name is required");
    if (!publishRequest.language) errors.push("Language is required");
    if (!publishRequest.files || !Array.isArray(publishRequest.files))
      errors.push("Files array is required");

    if (errors.length > 0) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "Invalid request data",
          details: errors,
        })
      );
    }

    // Return success response
    const owner = publishRequest.owner || "unknown";
    const repoName = publishRequest.repoName || publishRequest.projectName;
    const response = {
      success: true,
      message: `${language.charAt(0).toUpperCase() + language.slice(1)} project prepared for publishing`,
      projectInfo,
      repository: `https://github.com/${owner}/${repoName}`,
      registrationUrl: `https://github.com/ACNet-AI/mcp-servers-hub`,
      timestamp: new Date().toISOString(),
      language: language,
    };

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(response));
  } catch (error) {
    console.error("Publish API error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
