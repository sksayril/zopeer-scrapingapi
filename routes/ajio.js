const express = require('express');
const router = express.Router();
const AjioProductScraper = require('../utilities/ajioScraper');
const fs = require('fs-extra');
const path = require('path');

// Initialize scraper instance
let ajioScraper = null;

// Middleware to initialize scraper if needed
const initializeScraper = async (req, res, next) => {
  try {
    if (!ajioScraper) {
      ajioScraper = new AjioProductScraper();
      await ajioScraper.initialize();
    }
    req.scraper = ajioScraper;
    next();
  } catch (error) {
    console.error('Error initializing Ajio scraper:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize scraper',
      details: error.message
    });
  }
};

// Route to scrape a single Ajio product
router.post('/scrape', initializeScraper, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Product URL is required',
        message: 'Please provide a valid Ajio product URL'
      });
    }

    // Validate Ajio URL
    if (!url.includes('ajio.com')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL',
        message: 'Please provide a valid Ajio product URL'
      });
    }

    console.log(`Scraping Ajio product: ${url}`);

    // Scrape the product
    const productData = await req.scraper.scrapeProduct(url);

    // Save scraped data to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ajio-product-${timestamp}.json`;
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
    console.error('Error scraping Ajio product:', error);
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
        message: 'Please provide a valid Ajio product URL'
      });
    }

    if (!url.includes('ajio.com')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL',
        message: 'Please provide a valid Ajio product URL'
      });
    }

    console.log(`Getting detailed data for Ajio product: ${url}`);

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
    const filename = `ajio-detailed-${timestamp}.json`;
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
    console.error('Error scraping detailed Ajio product:', error);
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
        message: 'Please provide an array of valid Ajio product URLs'
      });
    }

    // Validate URLs
    const invalidUrls = urls.filter(url => !url.includes('ajio.com'));
    if (invalidUrls.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URLs found',
        message: 'All URLs must be valid Ajio product URLs',
        invalidUrls: invalidUrls
      });
    }

    console.log(`Scraping ${urls.length} Ajio products`);

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
    const filename = `ajio-multiple-${timestamp}.json`;
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
    console.error('Error scraping multiple Ajio products:', error);
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
      scraperInitialized: ajioScraper !== null,
      timestamp: new Date().toISOString(),
      platform: 'Ajio',
      features: [
        'Product name and title extraction',
        'Brand information',
        'Price information (current and original price)',
        'Color/colour variants',
        'Available sizes',
        'Rating and review count',
        'Product description and details',
        'Category and subcategory',
        'Product images',
        'Availability status',
        'Material and care instructions',
        'Product specifications',
        'Additional product data',
        'Customer reviews',
        'Related products',
        'Size guide',
        'FAQ extraction'
      ]
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting Ajio scraper status:', error);
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
    if (ajioScraper) {
      await ajioScraper.close();
      ajioScraper = null;
    }

    res.json({
      success: true,
      message: 'Ajio scraper closed successfully'
    });
  } catch (error) {
    console.error('Error closing Ajio scraper:', error);
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
    // Use the actual Ajio product URL for testing
    const testUrl = 'https://www.ajio.com/yousta-girls-lightly-washed-barrel-fit-jeans/p/443080622_blue?';
    
    console.log('Testing Ajio scraper with actual product URL');

    const productData = await req.scraper.scrapeProduct(testUrl);

    res.json({
      success: true,
      message: 'Ajio scraper test successful',
      testUrl: testUrl,
      data: productData
    });

  } catch (error) {
    console.error('Error testing Ajio scraper:', error);
    res.status(500).json({
      success: false,
      error: 'Ajio scraper test failed',
      details: error.message,
      message: 'The scraper test failed. Please check the configuration.'
    });
  }
});

// Route to extract specific product information
router.post('/extract-info', initializeScraper, async (req, res) => {
  try {
    const { url, fields } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Product URL is required',
        message: 'Please provide a valid Ajio product URL'
      });
    }

    if (!url.includes('ajio.com')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL',
        message: 'Please provide a valid Ajio product URL'
      });
    }

    console.log(`Extracting specific info for Ajio product: ${url}`);

    // Scrape the product
    const productData = await req.scraper.scrapeProduct(url);

    // Filter data based on requested fields
    let filteredData = productData;
    if (fields && Array.isArray(fields) && fields.length > 0) {
      filteredData = {};
      fields.forEach(field => {
        if (productData.hasOwnProperty(field)) {
          filteredData[field] = productData[field];
        }
      });
    }

    res.json({
      success: true,
      message: 'Product information extracted successfully',
      data: filteredData,
      requestedFields: fields || 'all'
    });

  } catch (error) {
    console.error('Error extracting Ajio product info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract product information',
      details: error.message,
      message: 'An error occurred while extracting product information. Please try again.'
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Ajio scraper error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred in the Ajio scraper'
  });
});

module.exports = router;
