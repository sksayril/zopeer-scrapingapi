const express = require('express');
const router = express.Router();
const TataCliqScraper = require('../utilities/tatacliqScraper');
const TataCliqCategoryScraper = require('../utilities/tatacliqCategoryScraper');

// TataCliq Category Scraping API
router.post('/scrape-category', async (req, res) => {
    const { url } = req.body;

    if (!url || !url.includes('tatacliq.com')) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid TataCliq category URL'
        });
    }

    try {
        const categoryData = await TataCliqCategoryScraper.scrapeCategory(url);
        res.json({
            success: true,
            message: 'Category scraped successfully',
            data: categoryData
        });
    } catch (error) {
        console.error('TataCliq category scraping error:', error);
        res.status(500).json({
            success: false,
            message: 'Error occurred while scraping the category',
            error: error.message
        });
    }
});

// TataCliq Product Scraping API - POST method
router.post('/scrape-product', async (req, res) => {
  const scraper = new TataCliqScraper();
  
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('tatacliq.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid TataCliq product URL'
      });
    }

    // Scrape the product
    const productData = await scraper.scrapeProduct(url);
    
    res.json({
      success: true,
      message: 'Product scraped successfully',
      data: productData
    });

  } catch (error) {
    console.error('TataCliq scraping error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the product',
      error: error.message
    });
  } finally {
    await scraper.close();
  }
});

// TataCliq Product Scraping API - GET method
router.get('/scrape-product', async (req, res) => {
  const scraper = new TataCliqScraper();
  
  try {
    const { url } = req.query;
    
    if (!url || !url.includes('tatacliq.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid TataCliq product URL as query parameter'
      });
    }

    // Scrape the product
    const productData = await scraper.scrapeProduct(url);
    
    res.json({
      success: true,
      message: 'Product scraped successfully',
      data: productData
    });

  } catch (error) {
    console.error('TataCliq scraping error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the product',
      error: error.message
    });
  } finally {
    await scraper.close();
  }
});

// Bulk scraping endpoint for multiple products
router.post('/scrape-bulk', async (req, res) => {
  const { urls } = req.body;
  
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an array of valid TataCliq product URLs'
    });
  }

  if (urls.length > 10) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 10 URLs allowed per request'
    });
  }

  const results = [];
  const scraper = new TataCliqScraper();

  try {
    for (const url of urls) {
      if (!url.includes('tatacliq.com')) {
        results.push({
          url,
          success: false,
          error: 'Invalid TataCliq URL'
        });
        continue;
      }

      try {
        const productData = await scraper.scrapeProduct(url);
        results.push({
          url,
          success: true,
          data: productData
        });
      } catch (error) {
        results.push({
          url,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Bulk scraping completed',
      results,
      totalProcessed: urls.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

  } catch (error) {
    console.error('TataCliq bulk scraping error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred during bulk scraping',
      error: error.message
    });
  } finally {
    await scraper.close();
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'TataCliq Scraping API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: [
      'Product name and title extraction',
      'Selling price and actual price (MRP)',
      'Available offers with codes and conditions',
      'Product description and features',
      'Main image and additional images',
      'View more offers functionality',
      'Bulk scraping support'
    ]
  });
});

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    message: 'TataCliq Scraping API Documentation',
    endpoints: {
      'POST /scrape-product': {
        description: 'Scrape a single TataCliq product',
        body: { url: 'string' },
        response: 'Product data object'
      },
      'GET /scrape-product': {
        description: 'Scrape a single TataCliq product via query parameter',
        query: { url: 'string' },
        response: 'Product data object'
      },
      'POST /scrape-bulk': {
        description: 'Scrape multiple TataCliq products',
        body: { urls: ['string'] },
        response: 'Array of product data objects'
      },
      'GET /health': {
        description: 'API health check',
        response: 'Health status and API information'
      }
    },
    dataStructure: {
      productName: 'string - Product title/name',
      sellingPrice: 'string - Current selling price',
      actualPrice: 'string - Original MRP price',
      offers: 'array - General offers and deals',
      productDescription: 'string - Detailed product description',
      featuresAndFunctions: 'object - Product features and specifications',
      mainImage: 'string - Main product image URL',
      additionalImages: 'array - Additional product image URLs',
      availableOffers: 'array - Detailed offers with codes and conditions',
      brand: 'string - Product brand name',
      model: 'string - Product model number',
      url: 'string - Original product URL',
      scrapedAt: 'string - ISO timestamp of scraping'
    }
  });
});

module.exports = router;
