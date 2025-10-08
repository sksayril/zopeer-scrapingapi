# Scraping Operations API Documentation

## Overview

This API provides comprehensive management of web scraping operations across multiple e-commerce platforms. It includes tracking, monitoring, and processing of scraping jobs with real-time status updates and detailed analytics.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, no authentication is required. In production, implement proper authentication mechanisms.

## Supported Sellers

The API supports scraping from the following e-commerce platforms:

- `amazon` - Amazon India
- `flipkart` - Flipkart
- `tatacliq` - Tata CLiQ
- `myntra` - Myntra
- `jiomart` - JioMart
- `ajio` - Ajio
- `chroma` - Chroma
- `vijaysales` - Vijay Sales
- `nykaa` - Nykaa
- `1mg` - 1mg
- `pharmeasy` - PharmEasy
- `netmeds` - Netmeds
- `blinkit` - Blinkit
- `swiggy-instamart` - Swiggy Instamart
- `zepto` - Zepto
- `bigbasket` - BigBasket
- `pepperfry` - Pepperfry
- `homecentre` - Home Centre
- `shoppersstop` - Shoppers Stop
- `urbanic` - Urbanic
- `ikea` - IKEA
- `biba` - BIBA
- `lifestylestores` - Lifestyle Stores
- `medplusmart` - MedPlus Mart
- `truemeds` - TrueMeds
- `apollopharmacy` - Apollo Pharmacy
- `wellnessforever` - Wellness Forever
- `dmart` - D-Mart
- `licious` - Licious

## Scraping Operations API

### 1. Get All Scraping Operations

**Endpoint:** `GET /api/scraping-operations`

**Description:** Retrieve all scraping operations with filtering, pagination, and sorting options.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number for pagination |
| `limit` | integer | 20 | Number of items per page |
| `status` | string | - | Filter by status: `pending`, `in_progress`, `success`, `failed`, `cancelled` |
| `seller` | string | - | Filter by seller name |
| `type` | string | - | Filter by type: `product`, `category` |
| `category` | string | - | Filter by category name |
| `startDate` | string | - | Filter operations from this date (ISO format) |
| `endDate` | string | - | Filter operations until this date (ISO format) |
| `sortBy` | string | `createdAt` | Sort field |
| `sortOrder` | string | `desc` | Sort order: `asc`, `desc` |
| `search` | string | - | Search in URL, category, or notes |

**Example Request:**
```bash
GET /api/scraping-operations?page=1&limit=10&status=success&seller=amazon&sortBy=createdAt&sortOrder=desc
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "url": "https://www.amazon.in/dp/B08N5WRWNW",
      "seller": "amazon",
      "type": "product",
      "category": "Electronics",
      "status": "success",
      "attemptTime": "2024-01-15T10:30:00.000Z",
      "startTime": "2024-01-15T10:30:05.000Z",
      "endTime": "2024-01-15T10:30:45.000Z",
      "duration": 40000,
      "totalProducts": 1,
      "scrapedProducts": 1,
      "failedProducts": 0,
      "retryCount": 0,
      "progress": {
        "current": 1,
        "total": 1,
        "percentage": 100
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:45.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50,
    "itemsPerPage": 10
  }
}
```

### 2. Get Statistics

**Endpoint:** `GET /api/scraping-operations/stats`

**Description:** Get comprehensive statistics about scraping operations.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `seller` | string | Filter stats by specific seller |
| `startDate` | string | Filter stats from this date (ISO format) |
| `endDate` | string | Filter stats until this date (ISO format) |

**Example Request:**
```bash
GET /api/scraping-operations/stats?seller=amazon&startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statusStats": [
      {
        "_id": "success",
        "count": 150,
        "totalProducts": 1500,
        "avgDuration": 45000
      },
      {
        "_id": "failed",
        "count": 25,
        "totalProducts": 0,
        "avgDuration": 15000
      },
      {
        "_id": "pending",
        "count": 10,
        "totalProducts": 0,
        "avgDuration": 0
      }
    ],
    "sellerStats": [
      {
        "_id": "amazon",
        "totalOperations": 50,
        "successCount": 45,
        "failedCount": 3,
        "pendingCount": 2,
        "totalProducts": 450,
        "successRate": 90.0
      }
    ],
    "recentOperations": [
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "url": "https://www.amazon.in/dp/B08N5WRWNW",
        "seller": "amazon",
        "type": "product",
        "status": "success",
        "attemptTime": "2024-01-15T10:30:00.000Z",
        "totalProducts": 1,
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "summary": {
      "totalOperations": 185,
      "totalProducts": 1500
    }
  }
}
```

### 3. Get Single Operation

**Endpoint:** `GET /api/scraping-operations/:id`

**Description:** Get detailed information about a specific scraping operation.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Operation ID |

**Example Request:**
```bash
GET /api/scraping-operations/64f8a1b2c3d4e5f6a7b8c9d0
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "url": "https://www.amazon.in/dp/B08N5WRWNW",
    "seller": "amazon",
    "type": "product",
    "category": "Electronics",
    "status": "success",
    "attemptTime": "2024-01-15T10:30:00.000Z",
    "startTime": "2024-01-15T10:30:05.000Z",
    "endTime": "2024-01-15T10:30:45.000Z",
    "duration": 40000,
    "totalProducts": 1,
    "scrapedProducts": 1,
    "failedProducts": 0,
    "retryCount": 0,
    "maxRetries": 3,
    "config": {
      "usePuppeteer": true,
      "timeout": 30000,
      "waitTime": 3000
    },
    "dataFile": "/path/to/scraped_data/amazon-product-2024-01-15T10-30-45-000Z.json",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "ipAddress": "192.168.1.100",
    "progress": {
      "current": 1,
      "total": 1,
      "percentage": 100
    },
    "notes": "High priority product",
    "tags": ["electronics", "mobile"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:45.000Z"
  }
}
```

### 4. Create New Operation

**Endpoint:** `POST /api/scraping-operations`

**Description:** Create a new scraping operation.

**Request Body:**

```json
{
  "url": "https://www.amazon.in/dp/B08N5WRWNW",
  "seller": "amazon",
  "type": "product",
  "category": "Electronics",
  "config": {
    "usePuppeteer": true,
    "timeout": 30000,
    "waitTime": 3000
  },
  "notes": "High priority product",
  "tags": ["electronics", "mobile"]
}
```

**Request Body Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | URL to scrape (must be valid URI) |
| `seller` | string | Yes | Seller name (must be from supported list) |
| `type` | string | No | Type: `product` or `category` (default: `product`) |
| `category` | string | No | Category name |
| `config.usePuppeteer` | boolean | No | Use Puppeteer for scraping (default: `true`) |
| `config.timeout` | number | No | Request timeout in ms (default: `30000`) |
| `config.waitTime` | number | No | Wait time after page load in ms (default: `3000`) |
| `notes` | string | No | Additional notes |
| `tags` | array | No | Array of tags |

**Response:**
```json
{
  "success": true,
  "message": "Scraping operation created successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "url": "https://www.amazon.in/dp/B08N5WRWNW",
    "seller": "amazon",
    "type": "product",
    "category": "Electronics",
    "status": "pending",
    "attemptTime": "2024-01-15T10:30:00.000Z",
    "retryCount": 0,
    "maxRetries": 3,
    "config": {
      "usePuppeteer": true,
      "timeout": 30000,
      "waitTime": 3000
    },
    "progress": {
      "current": 0,
      "total": 0,
      "percentage": 0
    },
    "notes": "High priority product",
    "tags": ["electronics", "mobile"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (409 - Conflict):**
```json
{
  "success": false,
  "message": "An operation is already in progress for this URL",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
    "url": "https://www.amazon.in/dp/B08N5WRWNW",
    "status": "in_progress"
  }
}
```

### 5. Update Operation

**Endpoint:** `PUT /api/scraping-operations/:id`

**Description:** Update an existing scraping operation.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Operation ID |

**Request Body:**

```json
{
  "status": "cancelled",
  "notes": "Cancelled by user request",
  "tags": ["cancelled", "user-request"]
}
```

**Request Body Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | Status: `pending`, `in_progress`, `success`, `failed`, `cancelled` |
| `progress.current` | number | No | Current progress count |
| `progress.total` | number | No | Total progress count |
| `errorMessage` | string | No | Error message |
| `errorDetails` | any | No | Error details object |
| `notes` | string | No | Additional notes |
| `tags` | array | No | Array of tags |

**Response:**
```json
{
  "success": true,
  "message": "Operation updated successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "status": "cancelled",
    "notes": "Cancelled by user request",
    "tags": ["cancelled", "user-request"],
    "updatedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

### 6. Start Operation

**Endpoint:** `POST /api/scraping-operations/:id/start`

**Description:** Mark an operation as started (moves from pending to in_progress).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Operation ID |

**Response:**
```json
{
  "success": true,
  "message": "Operation started successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "status": "in_progress",
    "startTime": "2024-01-15T10:30:05.000Z",
    "updatedAt": "2024-01-15T10:30:05.000Z"
  }
}
```

### 7. Complete Operation

**Endpoint:** `POST /api/scraping-operations/:id/complete`

**Description:** Mark an operation as completed with scraped data.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Operation ID |

**Request Body:**

```json
{
  "scrapedData": {
    "url": "https://www.amazon.in/dp/B08N5WRWNW",
    "scrapedAt": "2024-01-15T10:30:45.000Z",
    "source": "amazon",
    "product": {
      "title": "Samsung Galaxy M31",
      "price": 15999,
      "mrp": 17999,
      "discount": 11.11
    }
  },
  "totalProducts": 1,
  "dataFile": "/path/to/scraped_data/amazon-product-2024-01-15T10-30-45-000Z.json"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "status": "success",
    "endTime": "2024-01-15T10:30:45.000Z",
    "duration": 40000,
    "totalProducts": 1,
    "scrapedProducts": 1,
    "progress": {
      "current": 1,
      "total": 1,
      "percentage": 100
    },
    "dataFile": "/path/to/scraped_data/amazon-product-2024-01-15T10-30-45-000Z.json",
    "updatedAt": "2024-01-15T10:30:45.000Z"
  }
}
```

### 8. Fail Operation

**Endpoint:** `POST /api/scraping-operations/:id/fail`

**Description:** Mark an operation as failed with error details.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Operation ID |

**Request Body:**

```json
{
  "errorMessage": "Page not found (404)",
  "errorDetails": {
    "statusCode": 404,
    "stack": "Error: Page not found\n    at fetchWithPuppeteer...",
    "name": "NavigationError"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Operation marked as failed",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "status": "failed",
    "endTime": "2024-01-15T10:30:15.000Z",
    "duration": 15000,
    "errorMessage": "Page not found (404)",
    "errorDetails": {
      "statusCode": 404,
      "stack": "Error: Page not found\n    at fetchWithPuppeteer...",
      "name": "NavigationError"
    },
    "updatedAt": "2024-01-15T10:30:15.000Z"
  }
}
```

### 9. Retry Operation

**Endpoint:** `POST /api/scraping-operations/:id/retry`

**Description:** Retry a failed operation.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Operation ID |

**Response:**
```json
{
  "success": true,
  "message": "Operation queued for retry",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "status": "pending",
    "retryCount": 1,
    "attemptTime": "2024-01-15T10:35:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

**Error Response (400 - Bad Request):**
```json
{
  "success": false,
  "message": "Maximum retry limit reached"
}
```

### 10. Delete Operation

**Endpoint:** `DELETE /api/scraping-operations/:id`

**Description:** Delete a scraping operation and its associated data file.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Operation ID |

**Response:**
```json
{
  "success": true,
  "message": "Operation deleted successfully"
}
```

### 11. Get Scraped Data

**Endpoint:** `GET /api/scraping-operations/:id/data`

**Description:** Get the scraped data for a completed operation.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Operation ID |

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://www.amazon.in/dp/B08N5WRWNW",
    "scrapedAt": "2024-01-15T10:30:45.000Z",
    "source": "amazon",
    "product": {
      "title": "Samsung Galaxy M31",
      "brand": "Samsung",
      "price": 15999,
      "mrp": 17999,
      "discount": 11.11,
      "images": [
        "https://m.media-amazon.com/images/I/71..."
      ],
      "description": "Samsung Galaxy M31 with 64MP camera...",
      "offers": [
        "10% off on SBI cards",
        "Free delivery"
      ]
    }
  }
}
```

## Job Processor API

### 1. Get Processor Status

**Endpoint:** `GET /api/job-processor/status`

**Description:** Get the current status of the job processor.

**Response:**
```json
{
  "success": true,
  "data": {
    "isProcessing": true,
    "processingIntervalMs": 5000,
    "pendingOperations": 5,
    "inProgressOperations": 2,
    "stats": [
      {
        "_id": "success",
        "count": 150,
        "totalProducts": 1500,
        "avgDuration": 45000
      }
    ],
    "sellerStats": [
      {
        "_id": "amazon",
        "totalOperations": 50,
        "successCount": 45,
        "failedCount": 3,
        "pendingCount": 2,
        "totalProducts": 450,
        "successRate": 90.0
      }
    ]
  }
}
```

### 2. Start Processor

**Endpoint:** `POST /api/job-processor/start`

**Description:** Start the job processor.

**Response:**
```json
{
  "success": true,
  "message": "Job processor started successfully"
}
```

### 3. Stop Processor

**Endpoint:** `POST /api/job-processor/stop`

**Description:** Stop the job processor.

**Response:**
```json
{
  "success": true,
  "message": "Job processor stopped successfully"
}
```

### 4. Trigger Processing

**Endpoint:** `POST /api/job-processor/trigger`

**Description:** Manually trigger processing of pending operations.

**Response:**
```json
{
  "success": true,
  "message": "Processing triggered successfully"
}
```

### 5. Retry Failed Operations

**Endpoint:** `POST /api/job-processor/retry-failed`

**Description:** Retry all failed operations that haven't exceeded the retry limit.

**Response:**
```json
{
  "success": true,
  "message": "Retried 3 failed operations",
  "data": [
    {
      "operation": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "status": "success"
      },
      "scrapedData": { /* scraped data */ },
      "totalProducts": 1
    }
  ]
}
```

### 6. Cleanup Old Operations

**Endpoint:** `POST /api/job-processor/cleanup`

**Description:** Clean up old completed/failed operations and their data files.

**Request Body:**

```json
{
  "daysOld": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cleaned up 25 old operations",
  "data": [
    "64f8a1b2c3d4e5f6a7b8c9d0",
    "64f8a1b2c3d4e5f6a7b8c9d1"
  ]
}
```

### 7. Update Processing Interval

**Endpoint:** `PUT /api/job-processor/interval`

**Description:** Update the processing interval for the job processor.

**Request Body:**

```json
{
  "intervalMs": 10000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Processing interval updated to 10000ms"
}
```

## Error Responses

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input data |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error - Server error |

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "errors": [
    "Validation error 1",
    "Validation error 2"
  ]
}
```

## Rate Limiting

Currently, no rate limiting is implemented. In production, implement appropriate rate limiting based on your requirements.

## Webhooks (Future Enhancement)

Webhook support can be added to notify external systems about operation status changes:

- Operation started
- Operation completed
- Operation failed
- Operation retried

## Monitoring and Logging

The API includes comprehensive logging for:

- All API requests and responses
- Scraping operation lifecycle events
- Error details and stack traces
- Performance metrics

## Database Schema

### ScrapingOperation Collection

```javascript
{
  _id: ObjectId,
  url: String (required),
  seller: String (required, enum),
  type: String (required, enum: ['product', 'category']),
  category: String,
  status: String (required, enum: ['pending', 'in_progress', 'success', 'failed', 'cancelled']),
  attemptTime: Date,
  startTime: Date,
  endTime: Date,
  duration: Number,
  totalProducts: Number,
  scrapedProducts: Number,
  failedProducts: Number,
  errorMessage: String,
  errorDetails: Mixed,
  retryCount: Number,
  maxRetries: Number,
  config: {
    usePuppeteer: Boolean,
    timeout: Number,
    waitTime: Number
  },
  scrapedData: Mixed,
  dataFile: String,
  userAgent: String,
  ipAddress: String,
  requestHeaders: Mixed,
  progress: {
    current: Number,
    total: Number,
    percentage: Number
  },
  notes: String,
  tags: [String],
  createdAt: Date,
  updatedAt: Date
}
```

## Examples

### Complete Workflow Example

1. **Create Operation:**
```bash
curl -X POST http://localhost:3000/api/scraping-operations \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.amazon.in/dp/B08N5WRWNW",
    "seller": "amazon",
    "type": "product",
    "category": "Electronics"
  }'
```

2. **Check Status:**
```bash
curl http://localhost:3000/api/scraping-operations/64f8a1b2c3d4e5f6a7b8c9d0
```

3. **Get Scraped Data:**
```bash
curl http://localhost:3000/api/scraping-operations/64f8a1b2c3d4e5f6a7b8c9d0/data
```

4. **Get Statistics:**
```bash
curl http://localhost:3000/api/scraping-operations/stats
```

### Batch Operations Example

```bash
# Create multiple operations
for url in "https://www.amazon.in/dp/B08N5WRWNW" "https://www.flipkart.com/samsung-galaxy-m31/p/itm"; do
  curl -X POST http://localhost:3000/api/scraping-operations \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$url\", \"seller\": \"amazon\", \"type\": \"product\"}"
done

# Check processor status
curl http://localhost:3000/api/job-processor/status

# Trigger processing
curl -X POST http://localhost:3000/api/job-processor/trigger
```

## Best Practices

1. **Always check operation status** before attempting to retrieve data
2. **Use appropriate timeouts** based on the target website
3. **Implement retry logic** for failed operations
4. **Monitor processor status** regularly
5. **Clean up old operations** periodically
6. **Use pagination** for large result sets
7. **Filter operations** by date range for better performance
8. **Handle rate limiting** from target websites gracefully

## Support

For issues or questions regarding the API, please refer to the application logs or contact the development team.
