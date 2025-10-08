# Web to Context CLI

A command-line interface for accessing user data with proper permissions, similar to SuperMemory.ai's approach.

## Features

- 🔐 **Secure Authentication**: OAuth 2.0 flow with user consent
- 🔍 **Semantic Search**: Search through projects, crawls, and content chunks
- 📦 **Data Export**: Export user data in multiple formats (ZIP, JSON, CSV)
- 🛡️ **Permission Management**: Fine-grained access control with user approval
- 📊 **Rate Limiting**: Built-in protection against abuse
- 📝 **Audit Logging**: Complete access tracking for transparency

## Installation

```bash
npm install -g @web-to-context/cli
```

## Quick Start

### 1. Authentication

```bash
# Register and authenticate
web-to-context auth login

# Check authentication status
web-to-context auth status

# View current permissions
web-to-context auth permissions --list
```

### 2. Search User Data

```bash
# Search across all data
web-to-context search "machine learning algorithms"

# Search specific scope
web-to-context search "React authentication" --scope chunks

# Search with filters
web-to-context search "API documentation" --project-ids "proj1,proj2" --limit 20
```

### 3. Export Data

```bash
# List available exports
web-to-context export list

# Export a project
web-to-context export project abc-123 --format zip

# Export a crawl with embeddings
web-to-context export crawl def-456 --format json --include-embeddings
```

### 4. List Data

```bash
# List all projects
web-to-context list projects

# List crawls for a project
web-to-context list crawls --project-id abc-123
```

## Commands

### Authentication (`auth`)

- `login` - Authenticate with user account
- `logout` - Clear stored credentials
- `status` - Show authentication status
- `permissions` - Manage user permissions

### Search (`search`)

- `<query>` - Search through user data
- `--scope` - Search scope (projects|crawls|chunks|all)
- `--limit` - Maximum results (default: 10)
- `--format` - Output format (table|json)
- `--project-ids` - Filter by project IDs
- `--date-range` - Filter by date range

### Export (`export`)

- `<type> <id>` - Export specific resource
- `list` - List available exports
- `--format` - Export format (zip|json|csv)
- `--include-embeddings` - Include vector embeddings
- `--output` - Output file path

### List (`list`)

- `projects` - List user projects
- `crawls` - List user crawls
- `--format` - Output format (table|json)

### Configuration (`config`)

- `show` - Show current configuration
- `set` - Set configuration values
- `clear` - Clear all configuration

## Permission System

The CLI uses a sophisticated permission system:

### Scopes

- `read:projects` - Read project information
- `read:crawls` - Read crawl data
- `read:chunks` - Read content chunks
- `search:chunks` - Search through content
- `export:data` - Export user data
- `read:metadata` - Read metadata

### Filters

Users can set granular filters:

```json
{
  "projectIds": ["proj1", "proj2"],
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "dataTypes": ["crawls", "chunks"]
}
```

### Expiration

Permissions can be set to expire automatically:

```bash
# Grant permission for 7 days
web-to-context auth permissions --expires-in 604800
```

## Security Features

### Rate Limiting

- 60 requests per minute
- 1,000 requests per hour
- 10,000 requests per day

### Audit Logging

All access is logged with:
- User ID and Client ID
- Action performed
- Resource accessed
- IP address and User Agent
- Success/failure status

### Data Encryption

- All data encrypted in transit (HTTPS)
- Sensitive data encrypted at rest
- Client secrets stored securely

## Configuration

Configuration is stored in `~/.web-to-context/config.json`:

```json
{
  "apiUrl": "http://localhost:3000",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "accessToken": "your-access-token",
  "userId": "your-user-id"
}
```

## Environment Variables

- `WEB_TO_CONTEXT_API_URL` - API base URL (default: http://localhost:3000)

## Examples

### LLM Company Integration

```bash
# 1. Register as an LLM company
web-to-context auth login

# 2. Search for user context
web-to-context search "React authentication patterns" --scope chunks --limit 5

# 3. Export relevant data
web-to-context export project user-project-123 --format json
```

### Developer Workflow

```bash
# 1. Authenticate
web-to-context auth login

# 2. Find relevant projects
web-to-context list projects

# 3. Search for specific content
web-to-context search "API documentation" --scope chunks --project-ids "proj1,proj2"

# 4. Export for analysis
web-to-context export crawl crawl-456 --format zip --include-embeddings
```

## Error Handling

The CLI provides clear error messages for common issues:

- **401 Unauthorized**: Run `web-to-context auth login`
- **403 Forbidden**: Check your permissions
- **429 Rate Limited**: Wait and try again
- **404 Not Found**: Verify resource IDs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
