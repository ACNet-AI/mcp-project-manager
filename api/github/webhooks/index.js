const { createProbot } = require('probot');
const { WebhookHandler } = require('../../../lib/webhook-handler');

// Create Probot instance
const probot = createProbot({
  defaults: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY,
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET
  }
});

// Create webhook handler instance
const webhookHandler = new WebhookHandler();

// Load the app with proper event handlers
probot.load((app) => {
  app.log.info('🚀 MCP Project Manager GitHub App loaded');

  // Installation events
  app.on('installation', async (context) => {
    await webhookHandler.handleInstallation(context);
  });

  // Issue events
  app.on('issues', async (context) => {
    await webhookHandler.handleIssues(context);
  });

  // Pull request events
  app.on('pull_request', async (context) => {
    await webhookHandler.handlePullRequest(context);
  });

  // Push events
  app.on('push', async (context) => {
    await webhookHandler.handlePush(context);
  });

  // Release events
  app.on('release', async (context) => {
    await webhookHandler.handleRelease(context);
  });

  // Repository events
  app.on('repository', async (context) => {
    await webhookHandler.handleRepository(context);
  });

  // Handle all other events for debugging
  app.onAny(async (context) => {
    app.log.info('📡 Received event:', context.name);
  });
});

// Export the handler for Vercel
module.exports = async (req, res) => {
  try {
    console.log('📡 Received webhook at /api/github/webhooks');
    console.log('Method:', req.method);
    console.log('Event:', req.headers['x-github-event']);
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Let Probot handle the webhook
    await probot.webhooks.verifyAndReceive({
      id: req.headers['x-github-delivery'],
      name: req.headers['x-github-event'],
      signature: req.headers['x-hub-signature-256'],
      payload: JSON.stringify(req.body)
    });

    res.status(200).json({ 
      message: 'Webhook processed successfully',
      service: 'MCP Project Manager',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}; 