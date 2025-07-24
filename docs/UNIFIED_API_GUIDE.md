# API Usage Guide

## Basic Authentication

All APIs use unified authentication: just need one `installation-id` header.

```bash
# All requests use the same authentication method
curl -H "installation-id: your-installation-id" "https://your-domain.vercel.app/api/..."
```

## Core Endpoints

### 1. Start Installation
```bash
GET /api/github/install?project_name=project-name
```

Returns installation URL, visit to complete GitHub App installation and get `installation-id`.

### 2. Create Repository
```bash
POST /api/publish
Content-Type: application/json
installation-id: your-installation-id

{
  "name": "repository-name",
  "description": "description (optional)", 
  "owner": "organization-name (optional, leave empty for personal repository)",
  "private": true/false
}
```

### 3. Health Check
```bash
GET /api/health          # Service status
GET /api/check-env       # Environment configuration check
```

## API Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | ✅ | Repository name |
| `description` | string | ❌ | Repository description |
| `owner` | string | ❌ | Organization name (empty = personal repository) |
| `private` | boolean | ❌ | Whether private (default false) |
| `auto_init` | boolean | ❌ | Auto create README (default true) |

## Success Response

```json
{
  "success": true,
  "repository": {
    "id": 123456789,
    "name": "repository-name",
    "full_name": "username/repository-name",
    "html_url": "https://github.com/username/repository-name",
    "clone_url": "https://github.com/username/repository-name.git"
  },
  "auth_method": "user_token|installation_token",
  "message": "Repository created successfully"
}
```

## Common Errors

### Authentication Failed
```json
{
  "error": "Missing authentication",
  "details": "Please provide installation-id in request headers"
}
```

### Repository Name Already Exists
```json
{
  "error": "Repository creation failed", 
  "details": "Repository name already exists"
}
```

### Insufficient Permissions
```json
{
  "error": "Insufficient permissions",
  "details": "GitHub App permissions insufficient or not installed to target organization"
}
```

## Usage Examples

### JavaScript/Node.js
```javascript
const response = await fetch('https://your-domain.vercel.app/api/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'installation-id': 'your-installation-id'
  },
  body: JSON.stringify({
    name: 'my-project',
    description: 'My awesome project',
    private: false
  })
});

const result = await response.json();
console.log(result.repository.html_url);
```

### Python
```python
import requests

response = requests.post('https://your-domain.vercel.app/api/publish', 
  headers={'installation-id': 'your-installation-id'},
  json={
    'name': 'my-project',
    'description': 'My awesome project', 
    'private': False
  }
)

result = response.json()
print(result['repository']['html_url'])
```

### cURL
```bash
curl -X POST "https://your-domain.vercel.app/api/publish" \
  -H "Content-Type: application/json" \
  -H "installation-id: your-installation-id" \
  -d '{
    "name": "my-project",
    "description": "My awesome project",
    "private": false
  }'
```

## Smart Token Selection

API automatically selects the most appropriate authentication method:

- **Personal Repository** (no `owner` parameter) → Use OAuth User Token  
- **Organization Repository** (with `owner` parameter) → Use Installation Token
- **Auto Fallback**: If preferred Token is unavailable, automatically try backup option

You don't need to worry about Token details, just provide `installation-id`.

---

**Updated**: July 24, 2025 