import { VercelRequest, VercelResponse } from '@vercel/node';
import { extractProjectInfo, validateRegistrationData } from '../src/utils/registry.js';

/**
 * Vercel API function for external project publishing
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
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
      console.log('Raw body:', rawBody);
      
      if (rawBody) {
        try {
          publishRequest = JSON.parse(rawBody);
        } catch (parseError) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      }
    } else {
      publishRequest = req.body;
    }

    console.log('Parsed request:', publishRequest);
    
    if (!publishRequest) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: "Request body is required" }));
    }

    // Validate request data
    if (
      !publishRequest.projectName ||
      !publishRequest.files ||
      !publishRequest.language
    ) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        error: "Missing required fields: projectName, files, language",
        received: Object.keys(publishRequest || {})
      }));
    }

    // Extract package.json if provided
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
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            error: "Invalid package.json format",
          }));
        }
      }
    }

    if (!packageJson) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        error: "No valid package.json found",
      }));
    }

    // Extract project info for registration
    const owner = publishRequest.owner || "unknown";
    const repoName = publishRequest.repoName || publishRequest.projectName;
    const projectInfo = extractProjectInfo(packageJson, owner, repoName);

    // Validate request data
    const errors: string[] = [];
    if (!publishRequest.projectName) errors.push("Project name is required");
    if (!publishRequest.language) errors.push("Language is required");
    if (!publishRequest.files || !Array.isArray(publishRequest.files))
      errors.push("Files array is required");

    if (errors.length > 0) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        error: "Invalid request data",
        details: errors,
      }));
    }

    // Validate registration data
    const registrationValidation = validateRegistrationData(projectInfo);
    if (!registrationValidation.isValid) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        error: "Invalid project data",
        details: registrationValidation.errors,
      }));
    }

    // Return success response
    const response = {
      success: true,
      message: "Project prepared for publishing",
      projectInfo,
      repository: `https://github.com/${owner}/${repoName}`,
      registrationUrl: `https://mcphub.io/servers/${projectInfo.name}`,
      timestamp: new Date().toISOString(),
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(response));

  } catch (error) {
    console.error("Publish API error:", error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    }));
  }
} 