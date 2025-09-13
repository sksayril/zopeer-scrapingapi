# Amazon Category Scraping API Documentation

## Overview
This API provides comprehensive scraping functionality for Amazon.in category pages with support for individual page scraping and multiple specific pages.

## Features
- ✅ Scrape individual pages by page number
- ✅ Scrape multiple specific pages (e.g., pages 1, 3, 5)
- ✅ Extract comprehensive product data
- ✅ Handle pagination information
- ✅ Support both POST and GET methods
- ✅ Error handling and rate limiting
- ✅ Duplicate page removal and sorting

## API Endpoints

### 1. Scrape Single Page
**POST** `/amazon/scrape-category`
**GET** `/amazon/scrape-category`

#### Request Body (POST)
```json
{
  "url": "https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031",
  "page": 1
}
```

#### Query Parameters (GET)
```
?url=https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031&page=1
```

### 2. Scrape Multiple Specific Pages
**POST** `/amazon/scrape-category`

#### Request Body
```json
{
  "url": "https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031",
  "pages": [1, 2, 3, 5, 8]
}
```

**GET** `/amazon/scrape-category`

#### Query Parameters
```
?url=https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031&pages=1,2,3,5,8
```

### 3. Default (First Page)
**POST** `/amazon/scrape-category`

#### Request Body
```json
{
  "url": "https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031"
}
```

## Response Format

### Single Page Response
```json
{
  "success": true,
  "message": "Category scraped successfully",
  "data": {
    "page": 1,
    "url": "https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031&page=1",
    "products": [
      {
        "asin": "B0C4JZM6CH",
        "productName": "RC. ROYAL CLASS Thick Soft Heavy Cushioned Towel Woolen Thermal Socks for Men",
        "brand": "RC. ROYAL CLASS",
        "sellingPrice": "369",
        "mrp": "1100",
        "discount": "66%",
        "productImage": "https://m.media-amazon.com/images/I/A1u38sw+DIL._AC_UL320_.jpg",
        "productUrl": "https://www.amazon.in/dp/B0C4JZM6CH",
        "rating": "4.2 out of 5 stars",
        "reviewCount": "526",
        "availability": "In Stock",
        "isSponsored": true,
        "isPrime": false,
        "scrapedAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 20,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "totalProducts": 16,
    "scrapedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### Multiple Pages Response
```json
{
  "success": true,
  "message": "Category scraped successfully",
  "data": {
    "requestedPages": [1, 2, 3, 5, 8],
    "uniquePages": [1, 2, 3, 5, 8],
    "totalPages": 5,
    "successfulPages": 5,
    "failedPages": 0,
    "allProducts": [
      // All products from all pages combined
    ],
    "pageResults": [
      {
        "page": 1,
        "url": "...",
        "products": [...],
        "totalProducts": 16,
        "scrapedAt": "..."
      },
      // ... other pages
    ],
    "scrapedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

## Product Data Fields

| Field | Type | Description |
|-------|------|-------------|
| `asin` | String | Amazon Standard Identification Number |
| `productName` | String | Full product title/name |
| `brand` | String | Product brand name |
| `sellingPrice` | String | Current selling price (numeric) |
| `mrp` | String | Maximum Retail Price (numeric) |
| `discount` | String | Discount percentage (e.g., "66%") |
| `productImage` | String | Product image URL |
| `productUrl` | String | Direct product page URL |
| `rating` | String | Star rating (e.g., "4.2 out of 5 stars") |
| `reviewCount` | String | Number of reviews |
| `availability` | String | Stock availability status |
| `isSponsored` | Boolean | Whether product is sponsored/ad |
| `isPrime` | Boolean | Whether product has Prime delivery |
| `scrapedAt` | String | ISO timestamp of scraping |

## Usage Examples

### cURL Examples

#### Single Page (POST)
```bash
curl -X POST http://localhost:3000/amazon/scrape-category \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031",
    "page": 1
  }'
```

#### Multiple Pages (POST)
```bash
curl -X POST http://localhost:3000/amazon/scrape-category \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031",
    "pages": [1, 2, 3, 5, 8]
  }'
```

#### Single Page (GET)
```bash
curl "http://localhost:3000/amazon/scrape-category?url=https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031&page=1"
```

#### Multiple Pages (GET)
```bash
curl "http://localhost:3000/amazon/scrape-category?url=https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031&pages=1,2,3,5,8"
```

### JavaScript Examples

#### Single Page
```javascript
const response = await fetch('http://localhost:3000/amazon/scrape-category', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031',
    page: 1
  })
});

const data = await response.json();
console.log(data.data.products);
```

#### Multiple Pages
```javascript
const response = await fetch('http://localhost:3000/amazon/scrape-category', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031',
    pages: [1, 2, 3, 5, 8]
  })
});

const data = await response.json();
console.log(`Total products: ${data.data.allProducts.length}`);
```

## Error Handling

### Common Error Responses

#### Invalid URL
```json
{
  "success": false,
  "message": "Please provide a valid Amazon.in category URL",
  "error": null
}
```

#### Scraping Error
```json
{
  "success": false,
  "message": "Error occurred while scraping the category",
  "error": "Scraping failed for page 1: Navigation timeout"
}
```

## Rate Limiting & Best Practices

1. **Delay Between Requests**: The scraper automatically adds 2-second delays between pages
2. **Duplicate Handling**: Duplicate page numbers are automatically removed and sorted
3. **Error Recovery**: Individual page failures don't stop the entire process
4. **Resource Management**: Browser instances are properly closed after each request

## Performance Notes

- **Single Page**: ~3-5 seconds
- **Multiple Pages**: ~3-5 seconds per page + 2 seconds delay
- **Memory Usage**: Optimized with image/stylesheet blocking
- **Concurrent Requests**: Not recommended (use sequential page requests)

## Testing

Run the test file to verify functionality:
```bash
node test-amazon-category-scraper.js
```

## Support

For issues or questions, check the console logs for detailed error messages and ensure:
1. Valid Amazon.in category URLs are provided
2. Page numbers are positive integers
3. Network connectivity is stable
4. No rate limiting from Amazon
