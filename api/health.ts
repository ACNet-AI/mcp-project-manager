import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Health check endpoint for monitoring and load balancers
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ 
      status: "error",
      error: "Method not allowed" 
    }));
  }

  try {
    // Basic health check
    const healthStatus = {
      status: "healthy",
      service: "mcp-project-manager",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: "1.0.0"
    };

    // Optional: Check critical dependencies
    const checks = {
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
        unit: "MB"
      }
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    return res.end(JSON.stringify({
      ...healthStatus,
      checks
    }));

  } catch (error) {
    // Health check failed
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      status: "unhealthy",
      service: "mcp-project-manager",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    }));
  }
} 