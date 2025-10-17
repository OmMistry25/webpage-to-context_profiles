# Web to Context API Documentation

The Web to Context API allows you to crawl websites and extract structured content for analysis, search, and export. This API is designed for developers and companies who want to integrate website content extraction into their applications.

## Base URL

```
http://localhost:3005/api/v1
```

## Authentication

All API requests require authentication using an API key. Include your API key in the Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

### Getting an API Key

1. Sign up for an account at the Web to Context web application
2. Navigate to the API Keys section in your dashboard
3. Create a new API key with a descriptive name
4. Copy the API key (it's only shown once for security)

## Rate Limits

- 100 requests per minute per API key
- 1000 requests per hour per API key
- 10000 requests per day per API key

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Error Handling

The API uses standard HTTP status codes and returns JSON error responses:

```json
{
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `INVALID_API_KEY`: API key is invalid or expired
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `INVALID_URL`: URL format is invalid
- `CRAWL_NOT_FOUND`: Crawl ID not found or access denied
- `CRAWL_NOT_COMPLETED`: Crawl is still in progress

## Endpoints

### Create API Key

Create a new API key for your account.

**POST** `/api/v1/keys`

**Request Body:**
```json
{
  "name": "My Application API Key",
  "description": "API key for my web scraping application",
  "expiresInDays": 365
}
```

**Response:**
```json
{
  "success": true,
  "apiKey": {
    "id": "uuid",
    "name": "My Application API Key",
    "key": "your-api-key-here",
    "prefix": "prefix123",
    "description": "API key for my web scraping application",
    "expiresAt": "2025-01-01T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### List API Keys

Get all API keys for your account.

**GET** `/api/v1/keys`

**Response:**
```json
{
  "success": true,
  "apiKeys": [
    {
      "id": "uuid",
      "name": "My Application API Key",
      "prefix": "prefix123",
      "description": "API key for my web scraping application",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "lastUsedAt": "2024-01-15T10:30:00Z",
      "expiresAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Start Crawl

Start crawling a website to extract content.

**POST** `/api/v1/crawl`

**Request Body:**
```json
{
  "url": "https://example.com",
  "max_depth": 3,
  "max_pages": 50,
  "scope": "domain"
}
```

**Parameters:**
- `url` (required): The website URL to crawl
- `max_depth` (optional): Maximum crawl depth (1-5, default: 3)
- `max_pages` (optional): Maximum pages to crawl (1-200, default: 50)
- `scope` (optional): Crawl scope - "domain", "subdomain", or "path" (default: "domain")

**Response:**
```json
{
  "success": true,
  "crawl": {
    "id": "crawl-uuid",
    "url": "https://example.com",
    "scope": "domain",
    "max_depth": 3,
    "max_pages": 50,
    "status": "pending",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Get Crawl Status

Check the status of a crawl operation.

**GET** `/api/v1/crawl/{crawl_id}/status`

**Response:**
```json
{
  "success": true,
  "crawl": {
    "id": "crawl-uuid",
    "url": "https://example.com",
    "scope": "domain",
    "max_depth": 3,
    "max_pages": 50,
    "status": "completed",
    "created_at": "2024-01-01T00:00:00Z",
    "completed_at": "2024-01-01T00:05:00Z",
    "error_message": null,
    "statistics": {
      "total_pages": 45,
      "completed_pages": 45,
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

### Export Crawl Data

Export the crawled data in various formats.

**GET** `/api/v1/crawl/{crawl_id}/export?format=zip`

**Parameters:**
- `format` (optional): Export format - "zip", "json", or "csv" (default: "zip")

**Response:**
```json
{
  "success": true,
  "export": {
    "bundle_id": "bundle-uuid",
    "download_url": "https://storage.example.com/bundles/bundle-uuid.zip",
    "format": "zip",
    "crawl_id": "crawl-uuid",
    "crawl_url": "https://example.com",
    "created_at": "2024-01-01T00:10:00Z"
  }
}
```

### Search Crawl Content

Search through the crawled content using semantic search.

**GET** `/api/v1/crawl/{crawl_id}/search?q=search+query&limit=10&offset=0`

**Parameters:**
- `q` (required): Search query
- `limit` (optional): Maximum results to return (1-100, default: 10)
- `offset` (optional): Number of results to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "search": {
    "query": "search query",
    "crawl_id": "crawl-uuid",
    "crawl_url": "https://example.com",
    "total_results": 25,
    "results": [
      {
        "id": "chunk-uuid",
        "content": "Relevant content text...",
        "metadata": {
          "title": "Page Title",
          "description": "Page description"
        },
        "similarity_score": 0.85,
        "page": {
          "id": "page-uuid",
          "url": "https://example.com/page",
          "title": "Page Title"
        }
      }
    ]
  }
}
```

## Code Examples

### cURL Examples

**Start a crawl:**
```bash
curl -X POST "http://localhost:3005/api/v1/crawl" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "max_depth": 3,
    "max_pages": 50
  }'
```

**Check crawl status:**
```bash
curl -X GET "http://localhost:3005/api/v1/crawl/CRAWL_ID/status" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Export crawl data:**
```bash
curl -X GET "http://localhost:3005/api/v1/crawl/CRAWL_ID/export?format=zip" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Search crawl content:**
```bash
curl -X GET "http://localhost:3005/api/v1/crawl/CRAWL_ID/search?q=product+features&limit=5" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Python Examples

```python
import requests
import time

# Configuration
API_BASE_URL = "http://localhost:3005/api/v1"
API_KEY = "YOUR_API_KEY"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def start_crawl(url, max_depth=3, max_pages=50):
    """Start a crawl and return the crawl ID"""
    response = requests.post(
        f"{API_BASE_URL}/crawl",
        headers=HEADERS,
        json={
            "url": url,
            "max_depth": max_depth,
            "max_pages": max_pages
        }
    )
    response.raise_for_status()
    return response.json()["crawl"]["id"]

def wait_for_completion(crawl_id, timeout=300):
    """Wait for crawl to complete"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        response = requests.get(
            f"{API_BASE_URL}/crawl/{crawl_id}/status",
            headers=HEADERS
        )
        response.raise_for_status()
        data = response.json()
        status = data["crawl"]["status"]
        
        if status == "completed":
            return data["crawl"]
        elif status == "failed":
            raise Exception(f"Crawl failed: {data['crawl']['error_message']}")
        
        time.sleep(5)  # Wait 5 seconds before checking again
    
    raise Exception("Crawl timeout")

def export_crawl(crawl_id, format="zip"):
    """Export crawl data"""
    response = requests.get(
        f"{API_BASE_URL}/crawl/{crawl_id}/export",
        headers=HEADERS,
        params={"format": format}
    )
    response.raise_for_status()
    return response.json()["export"]

def search_crawl(crawl_id, query, limit=10):
    """Search crawl content"""
    response = requests.get(
        f"{API_BASE_URL}/crawl/{crawl_id}/search",
        headers=HEADERS,
        params={"q": query, "limit": limit}
    )
    response.raise_for_status()
    return response.json()["search"]

# Example usage
if __name__ == "__main__":
    # Start crawling a website
    crawl_id = start_crawl("https://example.com")
    print(f"Started crawl: {crawl_id}")
    
    # Wait for completion
    crawl_data = wait_for_completion(crawl_id)
    print(f"Crawl completed: {crawl_data['statistics']['total_pages']} pages")
    
    # Export the data
    export_data = export_crawl(crawl_id)
    print(f"Export ready: {export_data['download_url']}")
    
    # Search the content
    search_results = search_crawl(crawl_id, "product features", limit=5)
    print(f"Found {len(search_results['results'])} relevant results")
```

### JavaScript Examples

```javascript
const API_BASE_URL = 'http://localhost:3005/api/v1';
const API_KEY = 'YOUR_API_KEY';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

async function startCrawl(url, maxDepth = 3, maxPages = 50) {
  const response = await fetch(`${API_BASE_URL}/crawl`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url,
      max_depth: maxDepth,
      max_pages: maxPages
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data.crawl.id;
}

async function waitForCompletion(crawlId, timeout = 300000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const response = await fetch(`${API_BASE_URL}/crawl/${crawlId}/status`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const status = data.crawl.status;
    
    if (status === 'completed') {
      return data.crawl;
    } else if (status === 'failed') {
      throw new Error(`Crawl failed: ${data.crawl.error_message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('Crawl timeout');
}

async function exportCrawl(crawlId, format = 'zip') {
  const response = await fetch(`${API_BASE_URL}/crawl/${crawlId}/export?format=${format}`, {
    headers
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data.export;
}

async function searchCrawl(crawlId, query, limit = 10) {
  const response = await fetch(`${API_BASE_URL}/crawl/${crawlId}/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
    headers
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data.search;
}

// Example usage
async function main() {
  try {
    // Start crawling
    const crawlId = await startCrawl('https://example.com');
    console.log(`Started crawl: ${crawlId}`);
    
    // Wait for completion
    const crawlData = await waitForCompletion(crawlId);
    console.log(`Crawl completed: ${crawlData.statistics.total_pages} pages`);
    
    // Export the data
    const exportData = await exportCrawl(crawlId);
    console.log(`Export ready: ${exportData.download_url}`);
    
    // Search the content
    const searchResults = await searchCrawl(crawlId, 'product features', 5);
    console.log(`Found ${searchResults.results.length} relevant results`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
```

### Go Examples

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
    MaxDepth int    `json:"max_depth,omitempty"`
    MaxPages int    `json:"max_pages,omitempty"`
    Scope    string `json:"scope,omitempty"`
}

type CrawlResponse struct {
    Success bool `json:"success"`
    Crawl   struct {
        ID        string    `json:"id"`
        URL       string    `json:"url"`
        Status    string    `json:"status"`
        CreatedAt time.Time `json:"created_at"`
    } `json:"crawl"`
}

type StatusResponse struct {
    Success bool `json:"success"`
    Crawl   struct {
        ID       string `json:"id"`
        Status   string `json:"status"`
        Statistics struct {
            TotalPages     int `json:"total_pages"`
            CompletedPages int `json:"completed_pages"`
            ProgressPercentage int `json:"progress_percentage"`
        } `json:"statistics"`
    } `json:"crawl"`
}

type APIClient struct {
    BaseURL string
    APIKey  string
    Client  *http.Client
}

func NewAPIClient(baseURL, apiKey string) *APIClient {
    return &APIClient{
        BaseURL: baseURL,
        APIKey:  apiKey,
        Client:  &http.Client{Timeout: 30 * time.Second},
    }
}

func (c *APIClient) makeRequest(method, endpoint string, body interface{}) (*http.Response, error) {
    var reqBody io.Reader
    if body != nil {
        jsonData, err := json.Marshal(body)
        if err != nil {
            return nil, err
        }
        reqBody = bytes.NewBuffer(jsonData)
    }

    req, err := http.NewRequest(method, c.BaseURL+endpoint, reqBody)
    if err != nil {
        return nil, err
    }

    req.Header.Set("Authorization", "Bearer "+c.APIKey)
    req.Header.Set("Content-Type", "application/json")

    return c.Client.Do(req)
}

func (c *APIClient) StartCrawl(url string) (string, error) {
    req := CrawlRequest{
        URL:      url,
        MaxDepth: 3,
        MaxPages: 50,
    }

    resp, err := c.makeRequest("POST", "/crawl", req)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return "", fmt.Errorf("HTTP error: %d", resp.StatusCode)
    }

    var crawlResp CrawlResponse
    if err := json.NewDecoder(resp.Body).Decode(&crawlResp); err != nil {
        return "", err
    }

    return crawlResp.Crawl.ID, nil
}

func (c *APIClient) WaitForCompletion(crawlID string, timeout time.Duration) error {
    start := time.Now()
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            if time.Since(start) > timeout {
                return fmt.Errorf("timeout waiting for crawl completion")
            }

            resp, err := c.makeRequest("GET", "/crawl/"+crawlID+"/status", nil)
            if err != nil {
                continue
            }
            defer resp.Body.Close()

            var statusResp StatusResponse
            if err := json.NewDecoder(resp.Body).Decode(&statusResp); err != nil {
                continue
            }

            switch statusResp.Crawl.Status {
            case "completed":
                return nil
            case "failed":
                return fmt.Errorf("crawl failed")
            }
        }
    }
}

func main() {
    client := NewAPIClient("http://localhost:3005/api/v1", "YOUR_API_KEY")

    // Start crawl
    crawlID, err := client.StartCrawl("https://example.com")
    if err != nil {
        fmt.Printf("Error starting crawl: %v\n", err)
        return
    }
    fmt.Printf("Started crawl: %s\n", crawlID)

    // Wait for completion
    if err := client.WaitForCompletion(crawlID, 5*time.Minute); err != nil {
        fmt.Printf("Error waiting for completion: %v\n", err)
        return
    }
    fmt.Println("Crawl completed successfully")
}
```

## Best Practices

1. **Handle Rate Limits**: Implement exponential backoff when you receive 429 status codes
2. **Monitor Crawl Status**: Check crawl status periodically instead of making frequent requests
3. **Use Appropriate Limits**: Set reasonable max_depth and max_pages based on your needs
4. **Store API Keys Securely**: Never expose API keys in client-side code
5. **Handle Errors Gracefully**: Implement proper error handling for network issues and API errors
6. **Respect Robots.txt**: The crawler respects robots.txt by default, but be mindful of website policies

## Support

For API support and questions:
- Email: api-support@your-domain.com
- Documentation: https://your-domain.com/docs
- Status Page: https://status.your-domain.com
