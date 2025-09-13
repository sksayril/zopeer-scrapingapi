const express = require('express');
const router = express.Router();
const AmazonScraper = require('../utilities/amazonScraper');
const AmazonCategoryScraper = require('../utilities/amazonCategoryScraper');

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

// Amazon Category Scraping API
router.post('/scrape-category', async (req, res) => {
  const scraper = new AmazonCategoryScraper();
  
  try {
    const { url, page, pages } = req.body;
    
    if (!url || !url.includes('amazon.in')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Amazon.in category URL'
      });
    }

    let result;
    
    if (page) {
      // Scrape single page
      result = await scraper.scrapeCategoryPage(url, parseInt(page));
    } else if (pages && Array.isArray(pages)) {
      // Scrape multiple specific pages
      result = await scraper.scrapeSpecificPages(url, pages.map(p => parseInt(p)));
    } else {
      // Default: scrape first page
      result = await scraper.scrapeCategoryPage(url, 1);
    }
    
    res.json({
      success: true,
      message: 'Category scraped successfully',
      data: result
    });

  } catch (error) {
    console.error('Amazon category scraping error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the category',
      error: error.message
    });
  } finally {
    await scraper.close();
  }
});

// Amazon Category Scraping API (GET method)
router.get('/scrape-category', async (req, res) => {
  const scraper = new AmazonCategoryScraper();
  
  try {
    const { url, page, pages } = req.query;
    
    if (!url || !url.includes('amazon.in')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Amazon.in category URL as query parameter'
      });
    }

    let result;
    
    if (page) {
      // Scrape single page
      result = await scraper.scrapeCategoryPage(url, parseInt(page));
    } else if (pages) {
      // Scrape multiple specific pages (comma-separated)
      const pageNumbers = pages.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
      result = await scraper.scrapeSpecificPages(url, pageNumbers);
    } else {
      // Default: scrape first page
      result = await scraper.scrapeCategoryPage(url, 1);
    }
    
    res.json({
      success: true,
      message: 'Category scraped successfully',
      data: result
    });

  } catch (error) {
    console.error('Amazon category scraping error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the category',
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
