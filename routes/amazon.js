const express = require('express');
const router = express.Router();
const AmazonScraper = require('../utilities/amazonScraper');

// Amazon Product Scraping API
router.post('/scrape-product', async (req, res) => {
  const scraper = new AmazonScraper();
  
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('amazon.in')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Amazon.in product URL'
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
    console.error('Amazon scraping error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the product',
      error: error.message
    });
  } finally {
    await scraper.close();
  }
});

// Get product by URL (GET method)
router.get('/scrape-product', async (req, res) => {
  const scraper = new AmazonScraper();
  
  try {
    const { url } = req.query;
    
    if (!url || !url.includes('amazon.in')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Amazon.in product URL as query parameter'
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
    console.error('Amazon scraping error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the product',
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
    message: 'Amazon Scraping API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
