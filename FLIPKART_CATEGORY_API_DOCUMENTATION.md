# Flipkart Category Scraping API Documentation

## Overview
This API provides comprehensive scraping functionality for Flipkart.com category pages with support for individual page scraping and multiple specific pages.

## Features
- ✅ Scrape individual pages by page number
- ✅ Scrape multiple specific pages (e.g., pages 1, 3, 5)
- ✅ Extract comprehensive product data
- ✅ Handle pagination information
- ✅ Support both POST and GET methods
- ✅ Error handling and rate limiting
- ✅ Duplicate page removal and sorting
- ✅ Robust selector fallbacks

## API Endpoints

### 1. Scrape Single Page
**POST** `/flipkart/scrape-category`
**GET** `/flipkart/scrape-category`

#### Request Body (POST)
```json
{
  "url": "https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore",
  "page": 1
}
```

#### Query Parameters (GET)
```
?url=https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore&page=1
```

### 2. Scrape Multiple Specific Pages
**POST** `/flipkart/scrape-category`

#### Request Body
```json
{
  "url": "https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore",
  "pages": [1, 2, 3, 5, 8]
}
```

**GET** `/flipkart/scrape-category`

#### Query Parameters
```
?url=https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore&pages=1,2,3,5,8
```

### 3. Default (First Page)
**POST** `/flipkart/scrape-category`

#### Request Body
```json
{
  "url": "https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore"
}
```

## Response Format

### Single Page Response
```json
{
  "success": true,
  "message": "Flipkart category scraped successfully",
  "data": {
    "page": 1,
    "url": "https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore&page=1",
    "products": [
      {
        "productId": "WARGF2KGJTGUZ6ZN",
        "productName": "storewellcare Walker",
        "brand": "storewellcare",
        "sellingPrice": "709",
        "actualPrice": "5999",
        "discount": "88%",
        "productImage": "https://rukminim2.flixcart.com/image/612/612/xif0q/walker-rollator/7/2/s/1-9-130-portable-light-weight-height-adjustable-foldable-original-imahcgttphncqkat.jpeg?q=70",
        "productUrl": "https://www.flipkart.com/storewellcare-walker/p/itm9d28889c35a46",
        "rating": "4.1 out of 5 stars",
        "reviewCount": "977",
        "availability": "Limited Stock",
        "isWishlisted": true,
        "scrapedAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 20,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "totalProducts": 24,
    "scrapedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### Multiple Pages Response
```json
{
  "success": true,
  "message": "Flipkart category scraped successfully",
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
        "totalProducts": 24,
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
| `productId` | String | Flipkart Product ID (from data-id or extracted from URL) |
| `productName` | String | Full product title/name |
| `brand` | String | Product brand name (extracted from product name) |
| `sellingPrice` | String | Current selling price (numeric) |
| `actualPrice` | String | Maximum Retail Price (numeric) |
| `discount` | String | Discount percentage (e.g., "88%") |
| `productImage` | String | Product image URL |
| `productUrl` | String | Direct product page URL |
| `rating` | String | Star rating (e.g., "4.1 out of 5 stars") |
| `reviewCount` | String | Number of reviews |
| `availability` | String | Stock availability status (In Stock, Limited Stock, Out of Stock, Not Available) |
| `isWishlisted` | Boolean | Whether product is in wishlist |
| `scrapedAt` | String | ISO timestamp of scraping |

## Usage Examples

### cURL Examples

#### Single Page (POST)
```bash
curl -X POST http://localhost:3000/flipkart/scrape-category \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore",
    "page": 1
  }'
```

#### Multiple Pages (POST)
```bash
curl -X POST http://localhost:3000/flipkart/scrape-category \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore",
    "pages": [1, 2, 3, 5, 8]
  }'
```

#### Single Page (GET)
```bash
curl "http://localhost:3000/flipkart/scrape-category?url=https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore&page=1"
```

#### Multiple Pages (GET)
```bash
curl "http://localhost:3000/flipkart/scrape-category?url=https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore&pages=1,2,3,5,8"
```

### JavaScript Examples

#### Single Page
```javascript
const response = await fetch('http://localhost:3000/flipkart/scrape-category', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore',
    page: 1
  })
});

const data = await response.json();
console.log(data.data.products);
```

#### Multiple Pages
```javascript
const response = await fetch('http://localhost:3000/flipkart/scrape-category', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore',
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
  "message": "Please provide a valid Flipkart.com category URL",
  "error": null
}
```

#### Navigation Timeout
```json
{
  "success": false,
  "message": "Error occurred while scraping the Flipkart category",
  "error": "Scraping failed for page 1: Navigation timeout of 20000 ms exceeded"
}
```

#### Access Denied
```json
{
  "success": false,
  "message": "Error occurred while scraping the Flipkart category",
  "error": "Scraping failed for page 1: Page access denied or blocked by Flipkart"
}
```

## Rate Limiting & Best Practices

1. **Delay Between Requests**: The scraper automatically adds 2-second delays between pages
2. **Duplicate Handling**: Duplicate page numbers are automatically removed and sorted
3. **Error Recovery**: Individual page failures don't stop the entire process
4. **Resource Management**: Browser instances are properly closed after each request
5. **Robust Selectors**: Multiple fallback selectors for different page layouts

## Performance Notes

- **Single Page**: ~5-8 seconds
- **Multiple Pages**: ~5-8 seconds per page + 2 seconds delay
- **Memory Usage**: Optimized with image/stylesheet blocking
- **Concurrent Requests**: Not recommended (use sequential page requests)

## Testing

Run the test file to verify functionality:
```bash
node test-flipkart-category-scraper.js
```

## Troubleshooting

### Common Issues

1. **Navigation Timeout**: 
   - Check if the URL is accessible
   - Verify network connectivity
   - Try with a different page number

2. **No Products Found**:
   - Check if the page structure has changed
   - Verify the URL is a valid Flipkart category page
   - Check console logs for debug information

3. **Access Denied**:
   - Flipkart may be blocking automated requests
   - Try with different user agents
   - Add delays between requests

### Debug Information

The scraper provides detailed console logs including:
- Page title and content length
- Number of elements found
- Selector fallback attempts
- Product extraction details

## Support

For issues or questions, check the console logs for detailed error messages and ensure:
1. Valid Flipkart.com category URLs are provided
2. Page numbers are positive integers
3. Network connectivity is stable
4. No rate limiting from Flipkart
5. Page structure hasn't changed significantly
