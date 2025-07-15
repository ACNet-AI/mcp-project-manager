import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Detect deployment protection status
  const isProtected =
    req.headers?.["x-vercel-deployment-protection"] === "true";
  const hasAutomationBypass = !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  if (req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html");
    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>MCP Project Manager - OAuth Testing</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
          .success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
          .warning { background-color: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
          .info { background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
          button { background-color: #007bff; color: white; border: none; padding: 10px 20px; margin: 10px 0; border-radius: 5px; cursor: pointer; }
          button:hover { background-color: #0056b3; }
          code { background-color: #f8f9fa; padding: 2px 4px; border-radius: 3px; }
          .step { margin: 15px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff; }
          .bypass-code { background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; font-family: monospace; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>🔐 MCP Project Manager - OAuth Testing System</h1>
        
        <div class="status info">
          <h3>🚀 Environment Status</h3>
          <p><strong>Deployment URL:</strong> ${req.headers.host}</p>
          <p><strong>Deployment Protection:</strong> ${isProtected ? "🔒 Enabled" : "🔓 Disabled"}</p>
          <p><strong>Automation Bypass:</strong> ${hasAutomationBypass ? "✅ Configured" : "❌ Not Configured"}</p>
        </div>
        
        ${
  !hasAutomationBypass
    ? `
        <div class="status warning">
          <h3>⚠️ Need to Configure Automation Bypass</h3>
          <p>To resolve 401 errors, please follow these steps to configure Protection Bypass for Automation:</p>
          
          <div class="step">
            <h4>Step 1: Access Vercel Console</h4>
            <p>1. Visit <a href="https://vercel.com" target="_blank">vercel.com</a></p>
            <p>2. Select your project → <strong>Settings</strong> → <strong>Deployment Protection</strong></p>
          </div>
          
          <div class="step">
            <h4>Step 2: Enable Protection Bypass for Automation</h4>
            <p>1. Find the <strong>"Protection Bypass for Automation"</strong> option</p>
            <p>2. Click to enable and generate a secret key</p>
            <p>3. The system will automatically create environment variable <code>VERCEL_AUTOMATION_BYPASS_SECRET</code></p>
          </div>
          
          <div class="step">
            <h4>Step 3: Redeploy</h4>
            <p>After configuration, redeploy the project to make the configuration take effect</p>
          </div>
        </div>
        `
    : `
        <div class="status success">
          <h3>✅ Automation Bypass Configured</h3>
          <p>Protection Bypass for Automation is enabled, API calls should work normally.</p>
        </div>
        `
}
        
        <h2>📋 Using Automation Bypass Secret</h2>
        
        <div class="step">
          <h3>Method 1: Using HTTP Headers (Recommended)</h3>
          <div class="bypass-code">
curl -X GET "https://${req.headers.host}/api/auth/authorize" \\
  -H "x-vercel-protection-bypass: YOUR_BYPASS_SECRET" \\
  -H "x-vercel-set-bypass-cookie: true"
          </div>
          <p>Use HTTP header <code>x-vercel-protection-bypass</code> to pass the secret, optionally set Cookie for subsequent requests.</p>
        </div>
        
        <div class="step">
          <h3>Method 2: Using Query Parameters</h3>
          <div class="bypass-code">
curl -X GET "https://${req.headers.host}/api/auth/authorize?x-vercel-protection-bypass=YOUR_BYPASS_SECRET&x-vercel-set-bypass-cookie=true"
          </div>
          <p>Pass the secret as query parameters.</p>
        </div>
        
        <h2>🧪 OAuth Flow Testing</h2>
        
        <div class="step">
          <h3>1. Check Environment Variables</h3>
          <button onclick="checkEnvironment()">Check Environment Configuration</button>
          <div id="envResult"></div>
        </div>
        
        <div class="step">
          <h3>2. Start OAuth Authorization</h3>
          <button onclick="startOAuth()">Launch GitHub OAuth</button>
          <div id="oauthResult"></div>
        </div>
        
        <div class="step">
          <h3>3. Test Repository Creation</h3>
          <button onclick="testRepoCreation()">Test Repository Creation</button>
          <div id="repoResult"></div>
        </div>
        
        <h2>📚 Complete API Examples</h2>
        
        <div class="step">
          <h3>1. Get Authorization URL</h3>
          <div class="bypass-code">
curl -X GET "https://${req.headers.host}/api/auth/authorize?project_name=test-project" \\
  -H "x-vercel-protection-bypass: YOUR_BYPASS_SECRET"
          </div>
        </div>
        
        <div class="step">
          <h3>2. Check Authorization Status</h3>
          <div class="bypass-code">
curl -X GET "https://${req.headers.host}/api/auth/status" \\
  -H "session-id: YOUR_SESSION_ID" \\
  -H "x-vercel-protection-bypass: YOUR_BYPASS_SECRET"
          </div>
        </div>
        
        <div class="step">
          <h3>3. Create Repository</h3>
          <div class="bypass-code">
curl -X POST "https://${req.headers.host}/api/publish" \\
  -H "Content-Type: application/json" \\
  -H "session-id: YOUR_SESSION_ID" \\
  -H "x-vercel-protection-bypass: YOUR_BYPASS_SECRET" \\
  -d '{
    "name": "test-repo",
    "description": "Test repository",
    "projectFiles": {
      "README.md": "# Test Repository",
      "package.json": "{\\"name\\": \\"test-repo\\"}"
    }
  }'
          </div>
        </div>
        
        <div class="status info">
          <h3>💡 Important Notes</h3>
          <p>• Bypass secret can be passed through HTTP headers or query parameters</p>
          <p>• Use <code>x-vercel-set-bypass-cookie: true</code> to set Cookie and avoid repeatedly passing the secret in subsequent requests</p>
          <p>• All API endpoints support automation bypass</p>
          <p>• Secret is stored in environment variable <code>VERCEL_AUTOMATION_BYPASS_SECRET</code></p>
        </div>
        
        <script>
          async function checkEnvironment() {
            const result = document.getElementById('envResult');
            result.innerHTML = 'Checking...';
            
            try {
              const response = await fetch('/api/auth/status');
              const data = await response.json();
              
              if (response.ok) {
                result.innerHTML = \`
                  <div class="status success">
                    ✅ Environment configuration is normal<br>
                    <strong>Environment Variables Status:</strong><br>
                    GitHub Client ID: \${data.environment.github_client_id ? '✅' : '❌'}<br>
                    GitHub Client Secret: \${data.environment.github_client_secret ? '✅' : '❌'}<br>
                    GitHub Redirect URI: \${data.environment.github_redirect_uri ? '✅' : '❌'}<br>
                    Vercel Automation Bypass: \${data.environment.vercel_automation_bypass ? '✅' : '❌'}
                  </div>
                \`;
              } else {
                result.innerHTML = \`<div class="status error">❌ Environment check failed: \${data.error}</div>\`;
              }
            } catch (error) {
              result.innerHTML = \`<div class="status error">❌ Network error: \${error.message}</div>\`;
            }
          }
          
          async function startOAuth() {
            const result = document.getElementById('oauthResult');
            result.innerHTML = 'Generating authorization link...';
            
            try {
              const response = await fetch('/api/auth/authorize?project_name=test-oauth');
              const data = await response.json();
              
              if (response.ok) {
                result.innerHTML = \`
                  <div class="status success">
                    ✅ Authorization link generated<br>
                    <a href="\${data.auth_url}" target="_blank" style="color: #007bff;">Click here to authorize</a>
                  </div>
                \`;
              } else {
                result.innerHTML = \`<div class="status error">❌ Authorization failed: \${data.error}</div>\`;
              }
            } catch (error) {
              result.innerHTML = \`<div class="status error">❌ Network error: \${error.message}</div>\`;
            }
          }
          
          async function testRepoCreation() {
            const result = document.getElementById('repoResult');
            result.innerHTML = 'Testing repository creation...';
            
            const sessionId = prompt('Please enter your session-id (obtained from OAuth callback):');
            if (!sessionId) {
              result.innerHTML = '<div class="status warning">⚠️ session-id is required for testing</div>';
              return;
            }
            
            try {
              const response = await fetch('/api/publish', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'session-id': sessionId
                },
                body: JSON.stringify({
                  name: 'test-oauth-repo',
                  description: 'OAuth test repository',
                  projectFiles: {
                    'package.json': '{"name": "test-oauth-repo", "version": "1.0.0"}',
                    'README.md': '# OAuth Test Repository\\n\\nThis repository is used for testing OAuth functionality.'
                  }
                })
              });
              
              const data = await response.json();
              
              if (response.ok) {
                result.innerHTML = \`
                  <div class="status success">
                    ✅ Repository created successfully<br>
                    <strong>Repository:</strong> <a href="\${data.repository.url}" target="_blank">\${data.repository.name}</a><br>
                    <strong>User:</strong> \${data.repository.owner}<br>
                    <strong>Method:</strong> \${data.method}
                  </div>
                \`;
              } else {
                result.innerHTML = \`<div class="status error">❌ Repository creation failed: \${data.error}</div>\`;
              }
            } catch (error) {
              result.innerHTML = \`<div class="status error">❌ Network error: \${error.message}</div>\`;
            }
          }
        </script>
      </body>
      </html>
    `);
  } else {
    res.setHeader("Allow", ["GET"]);
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }
}
