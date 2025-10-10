# Enhanced Scrape Logs API Documentation

## Overview

The Scrape Logs API has been enhanced to provide comprehensive reporting and detailed statistics about scraping operations. The API now includes total product counts, failed product tracking, and detailed reporting capabilities.

## Base URL

```
https://z7s50012-3333.inc1.devtunnels.ms/api/scrape-logs
```

## Enhanced Features

### 1. Enhanced Log Retrieval with Product Statistics

**Endpoint:** `GET /api/scrape-logs`

**New Parameters:**
- `includeDetails` (boolean, default: true) - Include detailed operation information

**Enhanced Response:**
Each log entry now includes:
- `totalProducts` - Total number of products found in the category/URL
- `scrapedProducts` - Number of products successfully scraped
- `failedProducts` - Number of products that failed to scrape
- `duration` - Operation duration in milliseconds
- `progress` - Progress tracking object with current, total, and percentage
- `errorMessage` - Error message if operation failed
- `retryCount` - Number of retry attempts
- `operationDetails` - Full operation details (when includeDetails=true)

**Example Request:**
```bash
GET /api/scrape-logs?page=1&limit=20&includeDetails=true&platform=flipkart
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "68e6e0194b9de592b27f5390",
      "when": "2025-10-08T09:34:41.224Z",
      "platform": "flipkart",
      "type": "category",
      "url": "https://www.flipkart.com/electronics/...",
      "category": "Electronics",
      "status": "success",
      "action": "Manual",
      "totalProducts": 150,
      "scrapedProducts": 145,
      "failedProducts": 5,
      "duration": 45000,
      "progress": {
        "current": 145,
        "total": 150,
        "percentage": 96.67
      },
      "errorMessage": null,
      "retryCount": 0,
      "operationDetails": {
        "_id": "68e6e0194b9de592b27f5391",
        "seller": "flipkart",
        "startTime": "2025-10-08T09:34:41.224Z",
        "endTime": "2025-10-08T09:35:26.224Z",
        "config": {
          "usePuppeteer": true,
          "timeout": 30000,
          "waitTime": 3000
        }
      },
      "createdAt": "2025-10-08T22:05:13.338Z",
      "updatedAt": "2025-10-08T22:05:19.339Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 2,
    "totalItems": 28,
    "itemsPerPage": 20
  }
}
```

### 2. Detailed Report for Specific Log

**Endpoint:** `GET /api/scrape-logs/:id/report`

**Description:** Get comprehensive report for a specific scrape log including all operation details and summary statistics.

**Example Request:**
```bash
GET /api/scrape-logs/68e6e0194b9de592b27f5390/report
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "logDetails": {
      "_id": "68e6e0194b9de592b27f5390",
      "when": "2025-10-08T09:34:41.224Z",
      "platform": "flipkart",
      "type": "category",
      "url": "https://www.flipkart.com/electronics/...",
      "category": "Electronics",
      "status": "success",
      "action": "Manual",
      "createdAt": "2025-10-08T22:05:13.338Z",
      "updatedAt": "2025-10-08T22:05:19.339Z"
    },
    "operationDetails": {
      "_id": "68e6e0194b9de592b27f5391",
      "seller": "flipkart",
      "attemptTime": "2025-10-08T09:34:41.224Z",
      "startTime": "2025-10-08T09:34:41.224Z",
      "endTime": "2025-10-08T09:35:26.224Z",
      "duration": 45000,
      "totalProducts": 150,
      "scrapedProducts": 145,
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
        "current": 145,
        "total": 150,
        "percentage": 96.67
      },
      "notes": null,
      "tags": []
    },
    "summary": {
      "totalProducts": 150,
      "scrapedProducts": 145,
      "failedProducts": 5,
      "successRate": 96.67,
      "duration": 45000,
      "progress": {
        "current": 145,
        "total": 150,
        "percentage": 96.67
      }
    }
  }
}
```

### 3. Comprehensive Statistics

**Endpoint:** `GET /api/scrape-logs/stats/comprehensive`

**Description:** Get detailed statistics including product counts, success rates, and platform-wise breakdowns.

**Parameters:**
- `startDate` - Filter from date (ISO format)
- `endDate` - Filter to date (ISO format)
- `platform` - Filter by platform
- `type` - Filter by type (product/category)

**Example Request:**
```bash
GET /api/scrape-logs/stats/comprehensive?platform=flipkart&startDate=2025-10-01&endDate=2025-10-31
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "overall": {
      "totalOperations": 150,
      "totalProducts": 15000,
      "totalScrapedProducts": 14250,
      "totalFailedProducts": 750,
      "avgDuration": 35000,
      "successCount": 140,
      "failedCount": 10,
      "pendingCount": 0,
      "inProgressCount": 0,
      "cancelledCount": 0,
      "successRate": 93.33,
      "productSuccessRate": 95.00
    },
    "byPlatform": [
      {
        "_id": "flipkart",
        "totalOperations": 75,
        "successCount": 70,
        "failedCount": 5,
        "totalProducts": 7500,
        "scrapedProducts": 7125,
        "failedProducts": 375,
        "avgDuration": 32000,
        "successRate": 93.33,
        "productSuccessRate": 95.00
      },
      {
        "_id": "amazon",
        "totalOperations": 75,
        "successCount": 70,
        "failedCount": 5,
        "totalProducts": 7500,
        "scrapedProducts": 7125,
        "failedProducts": 375,
        "avgDuration": 38000,
        "successRate": 93.33,
        "productSuccessRate": 95.00
      }
    ],
    "detailed": [
      {
        "_id": {
          "status": "success",
          "platform": "flipkart",
          "type": "category"
        },
        "count": 70,
        "totalProducts": 7500,
        "scrapedProducts": 7125,
        "failedProducts": 375,
        "avgDuration": 32000,
        "totalDuration": 2240000
      }
    ],
    "generatedAt": "2025-10-08T22:30:00.000Z"
  }
}
```

### 4. Basic Statistics (Enhanced)

**Endpoint:** `GET /api/scrape-logs/stats`

**Description:** Get basic statistics with status counts and time series data.

**Parameters:**
- `startDate` - Filter from date (ISO format)
- `endDate` - Filter to date (ISO format)
- `platform` - Filter by platform

**Example Request:**
```bash
GET /api/scrape-logs/stats?platform=flipkart&startDate=2025-10-01
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "counts": {
      "pending": 0,
      "in_progress": 0,
      "success": 140,
      "failed": 10,
      "cancelled": 0
    },
    "total": 150,
    "successRate": 93.33,
    "chart": [
      {
        "date": "2025-10-08",
        "total": 25,
        "success": 23,
        "failed": 2,
        "pending": 0,
        "in_progress": 0,
        "cancelled": 0
      }
    ]
  }
}
```

## Filtering and Query Parameters

### Common Parameters for All Endpoints

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `platform` - Filter by platform (flipkart, amazon, etc.)
- `type` - Filter by type (product, category)
- `status` - Filter by status (pending, in_progress, success, failed, cancelled)
- `category` - Filter by category name
- `startDate` - Filter from date (ISO format)
- `endDate` - Filter to date (ISO format)
- `search` - Search in URL, platform, or action
- `sortBy` - Sort field (default: createdAt)
- `sortOrder` - Sort order (asc, desc, default: desc)

### Example Filtering Queries

```bash
# Get successful Flipkart category scrapes from last week
GET /api/scrape-logs?platform=flipkart&type=category&status=success&startDate=2025-10-01&endDate=2025-10-08

# Get failed operations with error details
GET /api/scrape-logs?status=failed&includeDetails=true

# Search for specific URL patterns
GET /api/scrape-logs?search=electronics&limit=10

# Get operations sorted by duration
GET /api/scrape-logs?sortBy=duration&sortOrder=desc&includeDetails=true
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

## Usage Examples

### 1. Monitor Scraping Performance

```javascript
// Get comprehensive statistics for dashboard
const stats = await fetch('/api/scrape-logs/stats/comprehensive?startDate=2025-10-01');
const data = await stats.json();

console.log(`Success Rate: ${data.data.overall.successRate}%`);
console.log(`Product Success Rate: ${data.data.overall.productSuccessRate}%`);
console.log(`Total Products Scraped: ${data.data.overall.totalScrapedProducts}`);
```

### 2. Track Failed Operations

```javascript
// Get failed operations with details
const failed = await fetch('/api/scrape-logs?status=failed&includeDetails=true');
const data = await failed.json();

data.data.forEach(log => {
  console.log(`Failed: ${log.platform} - ${log.errorMessage}`);
  console.log(`Retry Count: ${log.retryCount}`);
});
```

### 3. Generate Reports

```javascript
// Get detailed report for specific operation
const report = await fetch('/api/scrape-logs/68e6e0194b9de592b27f5390/report');
const data = await report.json();

console.log(`Operation Summary:`);
console.log(`Total Products: ${data.data.summary.totalProducts}`);
console.log(`Scraped: ${data.data.summary.scrapedProducts}`);
console.log(`Failed: ${data.data.summary.failedProducts}`);
console.log(`Success Rate: ${data.data.summary.successRate}%`);
```

## Integration with Scraping Operations

The enhanced API automatically creates and updates scrape logs when:

1. **Operation Created** - Initial log entry with "pending" status
2. **Operation Started** - Status updated to "in_progress"
3. **Operation Completed** - Status updated to "success" with product counts
4. **Operation Failed** - Status updated to "failed" with error details

This ensures that all scraping activities are properly tracked and reported through the API.

## Testing

Use the provided test script to verify the enhanced functionality:

```bash
node test-enhanced-scrape-logs.js
```

The test script will verify:
- Enhanced log retrieval with product statistics
- Comprehensive statistics endpoint
- Detailed reporting functionality
- Filtering capabilities
- Error handling



