const express = require('express');
const router = express.Router();
const JioMartProductScraper = require('../utilities/jiomartScraper');
const JioMartCategoryScraper = require('../utilities/jiomartCategoryScraper');
const fs = require('fs-extra');
const path = require('path');

// Initialize scraper instance
let jiomartScraper = null;

// Middleware to initialize scraper if needed
const initializeScraper = async (req, res, next) => {
  try {
    if (!jiomartScraper) {
      jiomartScraper = new JioMartProductScraper();
      await jiomartScraper.initialize();
    }
    req.scraper = jiomartScraper;
    next();
  } catch (error) {
    console.error('Error initializing JioMart scraper:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize scraper',
      details: error.message
    });
  }
};

router.post('/scrape-category', initializeScraper, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || !url.includes('jiomart.com')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL',
                message: 'Please provide a valid JioMart category URL'
            });
        }
        console.log(`Scraping JioMart category: ${url}`);
        const scraper = new JioMartCategoryScraper();
        const categoryData = await scraper.scrapeCategory(url);
        await scraper.close();
        res.json({
            success: true,
            message: 'Category scraped successfully',
            data: categoryData
        });
    } catch (error) {
        console.error('Error scraping JioMart category:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to scrape category',
            details: error.message
        });
    }
});

// Route to scrape a single JioMart product
router.post('/scrape', initializeScraper, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Product URL is required',
        message: 'Please provide a valid JioMart product URL'
      });
    }

    // Validate JioMart URL
    if (!url.includes('jiomart.com')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL',
        message: 'Please provide a valid JioMart product URL'
      });
    }

    console.log(`Scraping JioMart product: ${url}`);

    // Scrape the product
    const productData = await req.scraper.scrapeProduct(url);

    // Save scraped data to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `jiomart-product-${timestamp}.json`;
    const filepath = path.join(__dirname, '../scrapinghtml', filename);
    
    await fs.ensureDir(path.dirname(filepath));
    await fs.writeJson(filepath, productData, { spaces: 2 });

    res.json({
      success: true,
      message: 'Product scraped successfully',
      data: productData,
      savedTo: filename
    });

  } catch (error) {
    console.error('Error scraping JioMart product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape product',
      details: error.message,
      message: 'An error occurred while scraping the product. Please try again.'
    });
  }
});

// Route to get more detailed product data
router.post('/scrape-detailed', initializeScraper, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Product URL is required',
        message: 'Please provide a valid JioMart product URL'
      });
    }

    if (!url.includes('jiomart.com')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL',
        message: 'Please provide a valid JioMart product URL'
      });
    }

    console.log(`Getting detailed data for JioMart product: ${url}`);

    // Get basic product data
    const productData = await req.scraper.scrapeProduct(url);
    
    // Get additional detailed data
    const additionalData = await req.scraper.getMoreProductData(url);

    // Combine the data
    const detailedProductData = {
      ...productData,
      additionalData: additionalData,
      scrapedAt: new Date().toISOString()
    };

    // Save detailed data to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `jiomart-detailed-${timestamp}.json`;
    const filepath = path.join(__dirname, '../scrapinghtml', filename);
    
    await fs.ensureDir(path.dirname(filepath));
    await fs.writeJson(filepath, detailedProductData, { spaces: 2 });

    res.json({
      success: true,
      message: 'Detailed product data scraped successfully',
      data: detailedProductData,
      savedTo: filename
    });

  } catch (error) {
    console.error('Error scraping detailed JioMart product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape detailed product data',
      details: error.message,
      message: 'An error occurred while scraping detailed product data. Please try again.'
    });
  }
});

// Route to scrape multiple products
router.post('/scrape-multiple', initializeScraper, async (req, res) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Product URLs array is required',
        message: 'Please provide an array of valid JioMart product URLs'
      });
    }

    // Validate URLs
    const invalidUrls = urls.filter(url => !url.includes('jiomart.com'));
    if (invalidUrls.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URLs found',
        message: 'All URLs must be valid JioMart product URLs',
        invalidUrls: invalidUrls
      });
    }

    console.log(`Scraping ${urls.length} JioMart products`);

    const results = [];
    const errors = [];

    // Scrape each product
    for (let i = 0; i < urls.length; i++) {
      try {
        const url = urls[i];
        console.log(`Scraping product ${i + 1}/${urls.length}: ${url}`);
        
        const productData = await req.scraper.scrapeProduct(url);
        results.push({
          url: url,
          success: true,
          data: productData
        });

        // Add delay between requests to avoid being blocked
        if (i < urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error scraping product ${i + 1}:`, error);
        errors.push({
          url: urls[i],
          error: error.message
        });
      }
    }

    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `jiomart-multiple-${timestamp}.json`;
    const filepath = path.join(__dirname, '../scrapinghtml', filename);
    
    await fs.ensureDir(path.dirname(filepath));
    await fs.writeJson(filepath, { results, errors, scrapedAt: new Date().toISOString() }, { spaces: 2 });

    res.json({
      success: true,
      message: `Scraped ${results.length} products successfully`,
      totalUrls: urls.length,
      successful: results.length,
      failed: errors.length,
      results: results,
      errors: errors,
      savedTo: filename
    });

  } catch (error) {
    console.error('Error scraping multiple JioMart products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape multiple products',
      details: error.message,
      message: 'An error occurred while scraping multiple products. Please try again.'
    });
  }
});

// Route to get scraper status
router.get('/status', (req, res) => {
  try {
    const status = {
      scraperInitialized: jiomartScraper !== null,
      timestamp: new Date().toISOString(),
      platform: 'JioMart',
      features: [
        'Product name and title extraction',
        'Price information (actual and selling price)',
        'Rating and review count',
        'Product description and information',
        'Brand and category details',
        'Product images',
        'Availability status',
        'Seller information',
        'Delivery information',
        'Offers and discounts',
        'Product specifications',
        'Additional product data',
        'Customer reviews',
        'Related products',
        'FAQ extraction'
      ]
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting JioMart scraper status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scraper status',
      details: error.message
    });
  }
});

// Route to close scraper
router.post('/close', async (req, res) => {
  try {
    if (jiomartScraper) {
      await jiomartScraper.close();
      jiomartScraper = null;
    }

    res.json({
      success: true,
      message: 'JioMart scraper closed successfully'
    });
  } catch (error) {
    console.error('Error closing JioMart scraper:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close scraper',
      details: error.message
    });
  }
});

// Route to test scraper with sample URL
router.get('/test', initializeScraper, async (req, res) => {
  try {
    // Use a sample JioMart product URL for testing
    const testUrl = 'https://www.jiomart.com/p/groceries/pomegranate-economy-6-pcs-pack/590001268';
    
    console.log('Testing JioMart scraper with sample URL');

    const productData = await req.scraper.scrapeProduct(testUrl);

    res.json({
      success: true,
      message: 'JioMart scraper test successful',
      testUrl: testUrl,
      data: productData
    });

  } catch (error) {
    console.error('Error testing JioMart scraper:', error);
    res.status(500).json({
      success: false,
      error: 'JioMart scraper test failed',
      details: error.message,
      message: 'The scraper test failed. Please check the configuration.'
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('JioMart scraper error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred in the JioMart scraper'
  });
});

module.exports = router;
