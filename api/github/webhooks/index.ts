import { createNodeMiddleware, createProbot } from "probot";
import { VercelRequest, VercelResponse } from "@vercel/node";

// Import our Probot app
import app from "../../../src/index.js";

// Create Probot instance
const probot = createProbot();

// Create the middleware
const middleware = createNodeMiddleware(app, {
  probot,
  webhooksPath: "/api/github/webhooks",
});

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return middleware(req, res);
}
