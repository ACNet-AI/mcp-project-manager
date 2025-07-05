# 📡 MCP Project Manager - API Reference

## Overview

RESTful API for automated MCP project publishing and management.

## Base Information

- **Base URL**: `https://mcp-project-manager-1234.vercel.app/api`
- **Content-Type**: `application/json`
- **Authentication**: GitHub App installation token (automatic)

## Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "MCP Project Manager API",
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

### Service Status
```http
GET /api/status
```

**Response:**
```json
{
  "status": "healthy",
  "service": "MCP Project Manager",
  "version": "1.0.0",
  "features": ["Repository creation", "Automated publishing", "Hub registration"]
}
```

### Application Info
```http
GET /api/info
```

**Response:**
```json
{
  "name": "MCP Project Manager",
  "description": "🤖 Automated MCP server project management",
  "permissions": {
    "repository": ["contents:write", "issues:write", "pull_requests:write"],
    "account": ["administration:write", "profile:read"]
  },
  "installation_url": "https://github.com/apps/mcp-project-manager"
}
```

### Project Publishing 🚀
```http
POST /api/publish
```

**Request Body:**
```json
{
  "projectName": "my-mcp-server",
  "description": "A powerful MCP server",
  "version": "1.0.0",
  "language": "python",
  "files": [
    {
      "path": "server.py",
      "content": "# MCP server code...",
      "message": "Add main server file"
    }
  ]
}
```

**Required Fields:**
- `projectName` (string): Project name
- `description` (string): Project description  
- `version` (string): Version number
- `language` (string): `python`|`typescript`|`javascript`
- `files` (array): Project files

**Optional Fields:**
- `category` (string): Project category
- `tags` (array): Project tags
- `owner` (string): GitHub username
- `repoName` (string): Custom repository name
- `packageJson` (object): Package.json content

**Success Response:**
```json
{
  "success": true,
  "repoUrl": "https://github.com/username/my-mcp-server",
  "registrationUrl": "https://github.com/ACNet-AI/mcp-servers-hub/pull/123"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Validation failed: Project name is required"
}
```

## Error Codes

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| Validation Error | 400 | Invalid request parameters |
| Authentication Error | 401 | GitHub App auth failed |
| Permission Error | 403 | Insufficient permissions |
| Repository Exists | 409 | Repository already exists |
| Server Error | 500 | Internal server error |

## Usage Example

```python
import requests

def publish_project():
    url = "https://mcp-project-manager-1234.vercel.app/api/publish"
    payload = {
        "projectName": "my-mcp-server",
        "description": "My awesome MCP server",
        "version": "1.0.0",
        "language": "python",
        "files": [
            {
                "path": "server.py",
                "content": "#!/usr/bin/env python3\n# MCP server implementation",
                "message": "Add main server file"
            }
        ]
    }
    
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Published: {result['repoUrl']}")
    else:
        print(f"❌ Failed: {response.json()['error']}")
```

## Best Practices

- Use lowercase with hyphens for project names
- Follow semantic versioning (SemVer)
- Include "mcp" in project name for discoverability
- Implement exponential backoff for retries

*API Reference Version: v1.0*  
*Last Updated: January 15, 2025* 