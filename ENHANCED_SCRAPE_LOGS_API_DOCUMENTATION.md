# Enhanced Scrape Logs API Documentation

## Overview
The Enhanced Scrape Logs API provides comprehensive tracking and management of web scraping operations with detailed product statistics, real-time progress monitoring, and advanced analytics capabilities.

## Base URL
```
http://localhost:3000/api/scrape-logs
```

## Authentication
All endpoints require proper authentication headers (if implemented in your system).

---

## Endpoints

### 1. Create Scrape Log
**POST** `/api/scrape-logs`

Creates a new scrape log entry.

#### Request Body
```json
{
  "when": "2024-01-15T10:30:00.000Z", // Optional, defaults to current time
  "platform": "amazon", // Required
  "type": "product", // Required: "product" or "category"
  "url": "https://amazon.com/product/123", // Required
  "category": "Electronics", // Optional
  "status": "pending", // Required: "pending", "in_progress", "success", "failed", "cancelled"
  "action": "scrape_product_details", // Optional
  "operationId": "operation_id" // Optional, links to detailed operation
}
```

#### Response
```json
{
  "success": true,
  "message": "Scrape log created",
  "data": {
    "_id": "log_id",
    "when": "2024-01-15T10:30:00.000Z",
    "platform": "amazon",
    "type": "product",
    "url": "https://amazon.com/product/123",
    "category": "Electronics",
    "status": "pending",
    "action": "scrape_product_details",
    "operationId": "operation_id",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 2. Get Scrape Logs (Enhanced)
**GET** `/api/scrape-logs`

Retrieves scrape logs with comprehensive product statistics and filtering options.

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 20 | Items per page |
| `platform` | string | - | Filter by platform (amazon, flipkart, etc.) |
| `type` | string | - | Filter by type (product, category) |
| `status` | string | - | Filter by status |
| `category` | string | - | Filter by category |
| `startDate` | string | - | Start date filter (ISO format) |
| `endDate` | string | - | End date filter (ISO format) |
| `search` | string | - | Search in URL, platform, or action |
| `sortBy` | string | createdAt | Sort field |
| `sortOrder` | string | desc | Sort order (asc, desc) |
| `includeDetails` | boolean | true | Include operation details |

#### Response
```json
{
  "success": true,
  "data": [
    {
      "_id": "log_id",
      "when": "2024-01-15T10:30:00.000Z",
      "platform": "amazon",
      "type": "product",
      "url": "https://amazon.com/product/123",
      "category": "Electronics",
      "status": "in_progress",
      "action": "scrape_product_details",
      "operationId": "operation_id",
      
      // Enhanced Product Statistics
      "totalProducts": 100,
      "scrapedProducts": 75,
      "failedProducts": 5,
      "productSuccessRate": 75.0,
      "duration": 45000,
      "progress": {
        "current": 75,
        "total": 100,
        "percentage": 75
      },
      "errorMessage": null,
      "retryCount": 0,
      
      // Product Statistics Summary
      "productStats": {
        "total": 100,
        "successful": 75,
        "failed": 5,
        "successRate": 75.0,
        "remaining": 20
      },
      
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "itemsPerPage": 20
  }
}
```

---

### 3. Update Scrape Log (Enhanced)
**PUT** `/api/scrape-logs/:id`

Updates a scrape log with enhanced product statistics support.

#### Request Body
```json
{
  "when": "2024-01-15T10:30:00.000Z", // Optional
  "platform": "amazon", // Optional
  "type": "product", // Optional
  "url": "https://amazon.com/product/123", // Optional
  "category": "Electronics", // Optional
  "status": "in_progress", // Optional
  "action": "scrape_product_details", // Optional
  "operationId": "operation_id", // Optional
  
  // Enhanced Product Statistics
  "totalProducts": 100, // Optional
  "scrapedProducts": 75, // Optional
  "failedProducts": 5, // Optional
  "progress": { // Optional
    "current": 75,
    "total": 100,
    "percentage": 75
  },
  "duration": 45000, // Optional (milliseconds)
  "errorMessage": "Error details", // Optional
  "retryCount": 0 // Optional
}
```

#### Response
```json
{
  "success": true,
  "message": "Scrape log updated",
  "data": {
    "_id": "log_id",
    "when": "2024-01-15T10:30:00.000Z",
    "platform": "amazon",
    "type": "product",
    "url": "https://amazon.com/product/123",
    "category": "Electronics",
    "status": "in_progress",
    "action": "scrape_product_details",
    "operationId": "operation_id",
    
    // Enhanced Product Statistics
    "totalProducts": 100,
    "scrapedProducts": 75,
    "failedProducts": 5,
    "productSuccessRate": 75.0,
    "duration": 45000,
    "progress": {
      "current": 75,
      "total": 100,
      "percentage": 75
    },
    "errorMessage": null,
    "retryCount": 0,
    
    // Product Statistics Summary
    "productStats": {
      "total": 100,
      "successful": 75,
      "failed": 5,
      "successRate": 75.0,
      "remaining": 20
    },
    
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 4. Partial Update Scrape Log (Enhanced)
**PATCH** `/api/scrape-logs/:id`

Partially updates a scrape log with enhanced product statistics support.

#### Request Body
Same as PUT endpoint, but all fields are optional.

#### Response
Same as PUT endpoint response.

---

### 5. Bulk Update Statistics
**PATCH** `/api/scrape-logs/bulk-update-stats`

Updates product statistics for multiple scrape logs in a single request.

#### Request Body
```json
{
  "updates": [
    {
      "logId": "log_id_1",
      "totalProducts": 200,
      "scrapedProducts": 150,
      "failedProducts": 10,
      "progress": {
        "current": 150,
        "total": 200,
        "percentage": 75
      },
      "duration": 60000,
      "errorMessage": "",
      "retryCount": 0
    },
    {
      "logId": "log_id_2",
      "totalProducts": 300,
      "scrapedProducts": 250,
      "failedProducts": 15,
      "progress": {
        "current": 250,
        "total": 300,
        "percentage": 83.33
      },
      "duration": 90000,
      "errorMessage": "",
      "retryCount": 0
    }
  ]
}
```

#### Response
```json
{
  "success": true,
  "message": "Bulk update completed: 2 successful, 0 failed",
  "data": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "results": [
      {
        "logId": "log_id_1",
        "success": true,
        "message": "Updated successfully"
      },
      {
        "logId": "log_id_2",
        "success": true,
        "message": "Updated successfully"
      }
    ]
  }
}
```

---

### 6. Get Detailed Report
**GET** `/api/scrape-logs/:id/report`

Retrieves a comprehensive detailed report for a specific scrape log.

#### Response
```json
{
  "success": true,
  "data": {
    "logDetails": {
      "_id": "log_id",
      "when": "2024-01-15T10:30:00.000Z",
      "platform": "amazon",
      "type": "product",
      "url": "https://amazon.com/product/123",
      "category": "Electronics",
      "status": "in_progress",
      "action": "scrape_product_details",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "operationDetails": {
      "_id": "operation_id",
      "seller": "amazon",
      "attemptTime": "2024-01-15T10:30:00.000Z",
      "startTime": "2024-01-15T10:30:00.000Z",
      "endTime": null,
      "duration": 45000,
      "totalProducts": 100,
      "scrapedProducts": 75,
      "failedProducts": 5,
      "errorMessage": null,
      "errorDetails": null,
      "retryCount": 0,
      "maxRetries": 3,
      "config": {
        "usePuppeteer": true,
        "timeout": 30000,
        "waitTime": 3000
      },
      "progress": {
        "current": 75,
        "total": 100,
        "percentage": 75
      },
      "notes": null,
      "tags": []
    },
    "summary": {
      "totalProducts": 100,
      "scrapedProducts": 75,
      "failedProducts": 5,
      "successRate": 75.0,
      "duration": 45000,
      "progress": {
        "current": 75,
        "total": 100,
        "percentage": 75
      },
      "productStats": {
        "total": 100,
        "successful": 75,
        "failed": 5,
        "successRate": 75.0,
        "remaining": 20
      }
    }
  }
}
```

---

### 7. Get Comprehensive Statistics
**GET** `/api/scrape-logs/stats/comprehensive`

Retrieves comprehensive statistics with detailed product counts and platform-wise breakdowns.

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | Start date filter (ISO format) |
| `endDate` | string | End date filter (ISO format) |
| `platform` | string | Filter by platform |
| `type` | string | Filter by type |

#### Response
```json
{
  "success": true,
  "data": {
    "overall": {
      "totalOperations": 150,
      "totalProducts": 15000,
      "totalScrapedProducts": 12000,
      "totalFailedProducts": 1500,
      "avgDuration": 45000,
      "successCount": 120,
      "failedCount": 20,
      "pendingCount": 5,
      "inProgressCount": 5,
      "cancelledCount": 0,
      "successRate": 80.0,
      "productSuccessRate": 80.0
    },
    "byPlatform": [
      {
        "_id": "amazon",
        "totalOperations": 50,
        "successCount": 40,
        "failedCount": 8,
        "totalProducts": 5000,
        "scrapedProducts": 4000,
        "failedProducts": 500,
        "avgDuration": 50000,
        "successRate": 80.0,
        "productSuccessRate": 80.0
      },
      {
        "_id": "flipkart",
        "totalOperations": 50,
        "successCount": 45,
        "failedCount": 3,
        "totalProducts": 5000,
        "scrapedProducts": 4500,
        "failedProducts": 300,
        "avgDuration": 40000,
        "successRate": 90.0,
        "productSuccessRate": 90.0
      }
    ],
    "detailed": [
      {
        "_id": {
          "status": "success",
          "platform": "amazon",
          "type": "product"
        },
        "count": 40,
        "totalProducts": 4000,
        "scrapedProducts": 4000,
        "failedProducts": 0,
        "avgDuration": 50000,
        "totalDuration": 2000000
      }
    ],
    "generatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 8. Get Real-time Statistics
**GET** `/api/scrape-logs/realtime-stats`

Retrieves real-time statistics for dashboard monitoring.

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `platform` | string | - | Filter by platform |
| `type` | string | - | Filter by type |
| `lastMinutes` | number | 60 | Time window in minutes |

#### Response
```json
{
  "success": true,
  "data": {
    "totalOperations": 25,
    "activeOperations": 3,
    "completedOperations": 20,
    "failedOperations": 2,
    "totalProducts": 2500,
    "scrapedProducts": 2000,
    "failedProducts": 200,
    "avgDuration": 45000,
    "lastUpdate": "2024-01-15T10:30:00.000Z",
    "operationSuccessRate": 80.0,
    "productSuccessRate": 80.0,
    "activeOperations": [
      {
        "_id": "log_id",
        "platform": "amazon",
        "type": "product",
        "url": "https://amazon.com/product/123",
        "status": "in_progress",
        "when": "2024-01-15T10:30:00.000Z",
        "progress": {
          "current": 75,
          "total": 100,
          "percentage": 75
        },
        "totalProducts": 100,
        "scrapedProducts": 75,
        "failedProducts": 5
      }
    ],
    "generatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 9. Get Dashboard Statistics
**GET** `/api/scrape-logs/stats`

Retrieves dashboard statistics with chart-ready time series data.

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | Start date filter (ISO format) |
| `endDate` | string | End date filter (ISO format) |
| `platform` | string | Filter by platform |

#### Response
```json
{
  "success": true,
  "data": {
    "counts": {
      "pending": 5,
      "in_progress": 3,
      "success": 120,
      "failed": 20,
      "cancelled": 2
    },
    "total": 150,
    "successRate": 80.0,
    "chart": [
      {
        "date": "2024-01-15",
        "total": 25,
        "success": 20,
        "failed": 3,
        "pending": 1,
        "in_progress": 1,
        "cancelled": 0
      },
      {
        "date": "2024-01-14",
        "total": 30,
        "success": 25,
        "failed": 3,
        "pending": 1,
        "in_progress": 1,
        "cancelled": 0
      }
    ]
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

---

## Usage Examples

### Example 1: Create and Track a Scraping Operation
```javascript
// 1. Create scrape log
const createResponse = await fetch('/api/scrape-logs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    platform: 'amazon',
    type: 'product',
    url: 'https://amazon.com/product/123',
    category: 'Electronics',
    status: 'pending'
  })
});

const log = await createResponse.json();
const logId = log.data._id;

// 2. Update with product statistics
await fetch(`/api/scrape-logs/${logId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'in_progress',
    totalProducts: 100,
    scrapedProducts: 25,
    failedProducts: 5,
    progress: {
      current: 25,
      total: 100,
      percentage: 25
    }
  })
});

// 3. Get real-time updates
const statsResponse = await fetch('/api/scrape-logs/realtime-stats');
const stats = await statsResponse.json();
console.log('Current progress:', stats.data);
```

### Example 2: Bulk Update Multiple Operations
```javascript
const bulkUpdate = await fetch('/api/scrape-logs/bulk-update-stats', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    updates: [
      {
        logId: 'log1',
        scrapedProducts: 50,
        failedProducts: 3
      },
      {
        logId: 'log2',
        scrapedProducts: 75,
        failedProducts: 5
      }
    ]
  })
});
```

### Example 3: Dashboard Integration
```javascript
// Get comprehensive dashboard data
const dashboardData = await Promise.all([
  fetch('/api/scrape-logs/stats').then(r => r.json()),
  fetch('/api/scrape-logs/realtime-stats').then(r => r.json()),
  fetch('/api/scrape-logs/stats/comprehensive').then(r => r.json())
]);

const [basicStats, realtimeStats, comprehensiveStats] = dashboardData;
console.log('Dashboard ready:', {
  basicStats: basicStats.data,
  realtimeStats: realtimeStats.data,
  comprehensiveStats: comprehensiveStats.data
});
```

---

## Data Models

### ScrapeLog Schema
```javascript
{
  when: Date, // When the operation was initiated
  platform: String, // Platform name (amazon, flipkart, etc.)
  type: String, // "product" or "category"
  url: String, // Target URL
  category: String, // Product category
  status: String, // "pending", "in_progress", "success", "failed", "cancelled"
  action: String, // Action description
  operationId: ObjectId // Reference to detailed operation
}
```

### ScrapingOperation Schema
```javascript
{
  url: String,
  seller: String, // Platform name
  type: String,
  category: String,
  status: String,
  attemptTime: Date,
  startTime: Date,
  endTime: Date,
  duration: Number, // milliseconds
  
  // Product Statistics
  totalProducts: Number,
  scrapedProducts: Number,
  failedProducts: Number,
  
  // Progress Tracking
  progress: {
    current: Number,
    total: Number,
    percentage: Number
  },
  
  // Error Handling
  errorMessage: String,
  errorDetails: Mixed,
  retryCount: Number,
  maxRetries: Number,
  
  // Configuration
  config: {
    usePuppeteer: Boolean,
    timeout: Number,
    waitTime: Number
  }
}
```

---

## Best Practices

1. **Real-time Updates**: Use the PATCH endpoint for frequent updates during scraping operations
2. **Bulk Operations**: Use bulk update endpoint for updating multiple operations efficiently
3. **Monitoring**: Use real-time stats endpoint for dashboard monitoring
4. **Error Handling**: Always check the `success` field in responses
5. **Pagination**: Use pagination parameters for large datasets
6. **Filtering**: Use query parameters to filter results efficiently

---

## Rate Limiting

- Standard rate limiting applies to all endpoints
- Bulk operations may have additional rate limits
- Real-time stats endpoint is optimized for frequent polling

---

## Support

For additional support or questions about the Enhanced Scrape Logs API, please refer to the main API documentation or contact the development team.