# Webpage-to-Context API Documentation

A comprehensive API for converting webpages into searchable context profiles with multi-depth crawling, content extraction, and intelligent search capabilities.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Code Examples](#code-examples)
- [Deployment](#deployment)

## Overview

The Webpage-to-Context API allows you to:

- **Crawl websites** with configurable depth and scope
- **Extract content** and convert it to searchable chunks
- **Search through content** with intelligent text matching
- **Export data** in multiple formats (JSON, CSV, ZIP)
- **Manage API keys** with granular permissions

### Base URL

```
Production: https://your-domain.vercel.app/api/v1
Development: http://localhost:3006/api/v1
```

## Authentication

All API endpoints require authentication using API keys.

### Creating API Keys

1. Log into the dashboard
2. Navigate to the "API Keys" tab
3. Click "Create API Key"
4. Provide a name and description
5. Copy the generated key (shown only once)

### Using API Keys

Include your API key in the `Authorization` header:

```bash
Authorization: Bearer YOUR_API_KEY_HERE
```

## API Endpoints

### Crawl Management

#### Create Crawl

Start a new website crawl.

```http
POST /api/v1/crawl
```

**Request Body:**
```json
{
  "url": "https://example.com",
  "max_depth": 2,
  "max_pages": 50,
  "scope": "path"
}
```

**Parameters:**
- `url` (required): The starting URL to crawl
- `max_depth` (optional): Maximum crawl depth (default: 2)
- `max_pages` (optional): Maximum pages to crawl (default: 50)
- `scope` (optional): Crawl scope - "path", "domain", or "subdomain" (default: "path")

**Response:**
```json
{
  "success": true,
  "crawl": {
    "id": "crawl-uuid",
    "url": "https://example.com",
    "scope": "path",
    "max_depth": 2,
    "max_pages": 50,
    "status": "pending",
    "created_at": "2025-10-20T06:58:23.556767+00:00"
  }
}
```

#### Get Crawl Status

Check the status of a crawl.

```http
GET /api/v1/crawl/{crawl_id}/status
```

**Response:**
```json
{
  "success": true,
  "crawl": {
    "id": "crawl-uuid",
    "url": "https://example.com",
    "scope": "path",
    "max_depth": 2,
    "max_pages": 50,
    "status": "completed",
    "created_at": "2025-10-20T06:58:23.556767+00:00",
    "completed_at": "2025-10-20T07:00:56.457+00:00",
    "error_message": null,
    "statistics": {
      "total_pages": 1,
      "completed_pages": 1,
      "failed_pages": 0,
      "progress_percentage": 100
    }
  }
}
```

**Status Values:**
- `pending`: Crawl is queued for processing
- `running`: Crawl is currently in progress
- `completed`: Crawl finished successfully
- `failed`: Crawl encountered an error

### Search

#### Search Crawl Content

Search through the content of a completed crawl.

```http
GET /api/v1/crawl/{crawl_id}/search?q={query}&limit={limit}&offset={offset}
```

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Maximum results to return (default: 10, max: 100)
- `offset` (optional): Number of results to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "search": {
    "query": "example",
    "crawl_id": "crawl-uuid",
    "crawl_url": "https://example.com",
    "total_results": 1,
    "results": [
      {
        "id": "chunk-uuid",
        "content": "Example Domain This domain is for use in documentation examples...",
        "page": {
          "id": "page-uuid",
          "url": "https://example.com",
          "title": "Example Domain"
        }
      }
    ]
  }
}
```

### Export

#### Export Crawl Data

Export crawl data in various formats.

```http
GET /api/v1/crawl/{crawl_id}/export?format={format}
```

**Query Parameters:**
- `format` (optional): Export format - "json", "csv", or "zip" (default: "zip")

**Response:**
- **ZIP format**: Binary file download
- **JSON format**: JSON response with all data
- **CSV format**: CSV file download

### API Key Management

#### List API Keys

Get all API keys for the authenticated user.

```http
GET /api/v1/keys
```

**Response:**
```json
{
  "success": true,
  "keys": [
    {
      "id": "key-uuid",
      "name": "My API Key",
      "prefix": "w2c_",
      "description": "Key for production use",
      "is_active": true,
      "created_at": "2025-10-20T06:00:00.000Z",
      "last_used_at": "2025-10-20T07:00:00.000Z",
      "expires_at": null
    }
  ]
}
```

#### Create API Key

Create a new API key.

```http
POST /api/v1/keys
```

**Request Body:**
```json
{
  "name": "My API Key",
  "description": "Key for production use",
  "expiresInDays": 365
}
```

**Response:**
```json
{
  "success": true,
  "apiKey": {
    "id": "key-uuid",
    "name": "My API Key",
    "key": "w2c_abc123...",
    "prefix": "w2c_",
    "description": "Key for production use",
    "expiresAt": "2026-10-20T06:00:00.000Z",
    "createdAt": "2025-10-20T06:00:00.000Z"
  }
}
```

## Error Handling

The API uses standard HTTP status codes and returns error details in JSON format.

### Error Response Format

```json
{
  "error": "Error message",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Example Error Responses

**Invalid API Key:**
```json
{
  "error": "Invalid or expired API key"
}
```

**Crawl Not Found:**
```json
{
  "error": "Crawl not found or access denied"
}
```

**Rate Limit Exceeded:**
```json
{
  "error": "Rate limit exceeded",
  "details": "Too many requests. Try again in 60 seconds."
}
```

## Rate Limits

- **API Calls**: 1000 requests per hour per API key
- **Crawl Creation**: 10 crawls per hour per API key
- **Search Requests**: 500 requests per hour per API key

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Code Examples

### cURL

**Create a Crawl:**
```bash
curl -X POST https://your-domain.vercel.app/api/v1/crawl \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "url": "https://example.com",
    "max_depth": 2,
    "max_pages": 50,
    "scope": "path"
  }'
```

**Search Content:**
```bash
curl -X GET "https://your-domain.vercel.app/api/v1/crawl/CRAWL_ID/search?q=example&limit=5" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Python

```python
import requests

# Configuration
API_BASE_URL = "https://your-domain.vercel.app/api/v1"
API_KEY = "YOUR_API_KEY"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Create a crawl
def create_crawl(url, max_depth=2, max_pages=50, scope="path"):
    response = requests.post(
        f"{API_BASE_URL}/crawl",
        headers=HEADERS,
        json={
            "url": url,
            "max_depth": max_depth,
            "max_pages": max_pages,
            "scope": scope
        }
    )
    return response.json()

# Check crawl status
def get_crawl_status(crawl_id):
    response = requests.get(
        f"{API_BASE_URL}/crawl/{crawl_id}/status",
        headers=HEADERS
    )
    return response.json()

# Search content
def search_crawl(crawl_id, query, limit=10):
    response = requests.get(
        f"{API_BASE_URL}/crawl/{crawl_id}/search",
        headers=HEADERS,
        params={"q": query, "limit": limit}
    )
    return response.json()

# Example usage
crawl = create_crawl("https://example.com")
print(f"Crawl created: {crawl['crawl']['id']}")

# Wait for completion (in production, use polling)
import time
while True:
    status = get_crawl_status(crawl['crawl']['id'])
    if status['crawl']['status'] == 'completed':
        break
    time.sleep(5)

# Search the content
results = search_crawl(crawl['crawl']['id'], "example")
print(f"Found {len(results['search']['results'])} results")
```

### JavaScript/Node.js

```javascript
const axios = require('axios');

// Configuration
const API_BASE_URL = 'https://your-domain.vercel.app/api/v1';
const API_KEY = 'YOUR_API_KEY';
const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

// Create a crawl
async function createCrawl(url, maxDepth = 2, maxPages = 50, scope = 'path') {
  const response = await axios.post(`${API_BASE_URL}/crawl`, {
    url,
    max_depth: maxDepth,
    max_pages: maxPages,
    scope
  }, { headers });
  return response.data;
}

// Check crawl status
async function getCrawlStatus(crawlId) {
  const response = await axios.get(`${API_BASE_URL}/crawl/${crawlId}/status`, { headers });
  return response.data;
}

// Search content
async function searchCrawl(crawlId, query, limit = 10) {
  const response = await axios.get(`${API_BASE_URL}/crawl/${crawlId}/search`, {
    headers,
    params: { q: query, limit }
  });
  return response.data;
}

// Example usage
async function main() {
  try {
    // Create crawl
    const crawl = await createCrawl('https://example.com');
    console.log(`Crawl created: ${crawl.crawl.id}`);
    
    // Wait for completion
    let status;
    do {
      await new Promise(resolve => setTimeout(resolve, 5000));
      status = await getCrawlStatus(crawl.crawl.id);
      console.log(`Status: ${status.crawl.status}`);
    } while (status.crawl.status !== 'completed');
    
    // Search content
    const results = await searchCrawl(crawl.crawl.id, 'example');
    console.log(`Found ${results.search.results.length} results`);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

type CrawlRequest struct {
    URL      string `json:"url"`
    MaxDepth int    `json:"max_depth"`
    MaxPages int    `json:"max_pages"`
    Scope    string `json:"scope"`
}

type CrawlResponse struct {
    Success bool `json:"success"`
    Crawl   struct {
        ID        string `json:"id"`
        URL       string `json:"url"`
        Status    string `json:"status"`
        CreatedAt string `json:"created_at"`
    } `json:"crawl"`
}

func createCrawl(apiKey, url string) (*CrawlResponse, error) {
    reqBody := CrawlRequest{
        URL:      url,
        MaxDepth: 2,
        MaxPages: 50,
        Scope:    "path",
    }
    
    jsonData, _ := json.Marshal(reqBody)
    req, _ := http.NewRequest("POST", "https://your-domain.vercel.app/api/v1/crawl", bytes.NewBuffer(jsonData))
    req.Header.Set("Authorization", "Bearer "+apiKey)
    req.Header.Set("Content-Type", "application/json")
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    body, _ := io.ReadAll(resp.Body)
    var result CrawlResponse
    json.Unmarshal(body, &result)
    
    return &result, nil
}

func main() {
    apiKey := "YOUR_API_KEY"
    
    crawl, err := createCrawl(apiKey, "https://example.com")
    if err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }
    
    fmt.Printf("Crawl created: %s\n", crawl.Crawl.ID)
}
```

## Deployment

### Production Deployment with Vercel

1. **Install Vercel CLI:**
```bash
npm install -g vercel
```

2. **Deploy:**
```bash
cd apps/web
vercel --prod
```

3. **Set Environment Variables:**
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

4. **Configure Cron Jobs:**
The `vercel.json` file automatically configures the crawler to run every 5 minutes.

### Environment Variables

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

### Monitoring

- **Vercel Dashboard**: Monitor function executions and performance
- **Supabase Dashboard**: Monitor database usage and performance
- **API Logs**: Check Vercel function logs for debugging

## Support

For support and questions:

- **Documentation**: This file and inline API documentation
- **Issues**: Report bugs and feature requests via GitHub
- **Email**: Contact support for enterprise inquiries

## Changelog

### Version 1.0.0 (2025-10-20)
- Initial release
- Multi-depth crawling
- Content extraction and chunking
- Search functionality
- API key management
- Export capabilities
- Serverless deployment ready