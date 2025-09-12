const express = require('express');
const router = express.Router();
const ChromaProductScraper = require('../utilities/chromaScraper');
const fs = require('fs').promises;
const path = require('path');

// Initialize scraper instance
let chromaScraper = null;

// Initialize scraper
const initializeScraper = async () => {
  if (!chromaScraper) {
    chromaScraper = new ChromaProductScraper();
    await chromaScraper.initialize();
  }
  return chromaScraper;
};

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Chroma Product Scraper',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Scrape single product
router.post('/scrape', async (req, res) => {
  try {
    const { url, usePuppeteer = true } = req.body;

    // Validate input
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
        message: 'Please provide a valid Chroma product URL'
      });
    }

    // Validate URL format
    if (!url.includes('croma.com') || !url.includes('/p/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        message: 'Please provide a valid Chroma product URL (must contain croma.com and /p/)'
      });
    }

    // Initialize scraper
    const scraper = await initializeScraper();

    // Scrape the product
    const productData = await scraper.scrapeProduct(url, usePuppeteer);

    // Return success response
    res.json({
      success: true,
      message: 'Product scraped successfully',
      data: productData,
      scrapedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /scrape endpoint:', error);
    
    res.status(500).json({
      success: false,
      error: 'Scraping failed',
      message: error.message || 'An error occurred while scraping the product',
      timestamp: new Date().toISOString()
    });
  }
});

// Scrape multiple products
router.post('/scrape-batch', async (req, res) => {
  try {
    const { urls, usePuppeteer = true } = req.body;

    // Validate input
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URLs array is required',
        message: 'Please provide an array of valid Chroma product URLs'
      });
    }

    // Validate URLs
    const invalidUrls = urls.filter(url => !url.includes('croma.com') || !url.includes('/p/'));
    if (invalidUrls.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        message: 'All URLs must be valid Chroma product URLs (must contain croma.com and /p/)',
        invalidUrls: invalidUrls
      });
    }

    // Limit batch size
    if (urls.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Batch size exceeded',
        message: 'Maximum 10 URLs allowed per batch request'
      });
    }

    // Initialize scraper
    const scraper = await initializeScraper();

    // Scrape all products
    const results = [];
    const errors = [];

    for (let i = 0; i < urls.length; i++) {
      try {
        const productData = await scraper.scrapeProduct(urls[i], usePuppeteer);
        results.push({
          index: i,
          url: urls[i],
          success: true,
          data: productData
        });
      } catch (error) {
        errors.push({
          index: i,
          url: urls[i],
          success: false,
          error: error.message
        });
      }
    }

    // Return results
    res.json({
      success: true,
      message: `Batch scraping completed. ${results.length} successful, ${errors.length} failed`,
      results: results,
      errors: errors,
      scrapedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /scrape-batch endpoint:', error);
    
    res.status(500).json({
      success: false,
      error: 'Batch scraping failed',
      message: error.message || 'An error occurred while scraping the products',
      timestamp: new Date().toISOString()
    });
  }
});

// Get scraping history
router.get('/history', async (req, res) => {
  try {
    const scrapingDir = path.join(__dirname, '..', 'scrapinghtml');
    
    try {
      const files = await fs.readdir(scrapingDir);
      const chromaFiles = files.filter(file => file.startsWith('chroma-product-') && file.endsWith('.json'));
      
      const history = [];
      
      for (const file of chromaFiles) {
        try {
          const filepath = path.join(scrapingDir, file);
          const stats = await fs.stat(filepath);
          const content = await fs.readFile(filepath, 'utf8');
          const data = JSON.parse(content);
          
          history.push({
            filename: file,
            scrapedAt: data.scrapedAt,
            productName: data.productName,
            brand: data.brand,
            price: data.price,
            url: data.url,
            fileSize: stats.size,
            lastModified: stats.mtime
          });
        } catch (fileError) {
          console.error(`Error reading file ${file}:`, fileError);
        }
      }
      
      // Sort by scraped date (newest first)
      history.sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));
      
      res.json({
        success: true,
        message: 'Scraping history retrieved successfully',
        count: history.length,
        history: history
      });
      
    } catch (dirError) {
      res.json({
        success: true,
        message: 'No scraping history found',
        count: 0,
        history: []
      });
    }

  } catch (error) {
    console.error('Error in /history endpoint:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve history',
      message: error.message || 'An error occurred while retrieving scraping history',
      timestamp: new Date().toISOString()
    });
  }
});

// Get specific scraping result
router.get('/result/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename || !filename.startsWith('chroma-product-') || !filename.endsWith('.json')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename',
        message: 'Filename must be a valid Chroma scraping result file'
      });
    }
    
    const filepath = path.join(__dirname, '..', 'scrapinghtml', filename);
    
    try {
      const content = await fs.readFile(filepath, 'utf8');
      const data = JSON.parse(content);
      
      res.json({
        success: true,
        message: 'Scraping result retrieved successfully',
        data: data
      });
      
    } catch (fileError) {
      res.status(404).json({
        success: false,
        error: 'File not found',
        message: 'The specified scraping result file was not found'
      });
    }

  } catch (error) {
    console.error('Error in /result/:filename endpoint:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve result',
      message: error.message || 'An error occurred while retrieving the scraping result',
      timestamp: new Date().toISOString()
    });
  }
});

// Delete specific scraping result
router.delete('/result/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename || !filename.startsWith('chroma-product-') || !filename.endsWith('.json')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename',
        message: 'Filename must be a valid Chroma scraping result file'
      });
    }
    
    const filepath = path.join(__dirname, '..', 'scrapinghtml', filename);
    
    try {
      await fs.unlink(filepath);
      
      res.json({
        success: true,
        message: 'Scraping result deleted successfully',
        filename: filename
      });
      
    } catch (fileError) {
      res.status(404).json({
        success: false,
        error: 'File not found',
        message: 'The specified scraping result file was not found'
      });
    }

  } catch (error) {
    console.error('Error in DELETE /result/:filename endpoint:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete result',
      message: error.message || 'An error occurred while deleting the scraping result',
      timestamp: new Date().toISOString()
    });
  }
});

// Clear all scraping results
router.delete('/clear-history', async (req, res) => {
  try {
    const scrapingDir = path.join(__dirname, '..', 'scrapinghtml');
    
    try {
      const files = await fs.readdir(scrapingDir);
      const chromaFiles = files.filter(file => file.startsWith('chroma-product-') && file.endsWith('.json'));
      
      let deletedCount = 0;
      
      for (const file of chromaFiles) {
        try {
          const filepath = path.join(scrapingDir, file);
          await fs.unlink(filepath);
          deletedCount++;
        } catch (fileError) {
          console.error(`Error deleting file ${file}:`, fileError);
        }
      }
      
      res.json({
        success: true,
        message: `Cleared ${deletedCount} scraping results successfully`,
        deletedCount: deletedCount
      });
      
    } catch (dirError) {
      res.json({
        success: true,
        message: 'No scraping results to clear',
        deletedCount: 0
      });
    }

  } catch (error) {
    console.error('Error in /clear-history endpoint:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear history',
      message: error.message || 'An error occurred while clearing scraping history',
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint with sample data
router.post('/test', async (req, res) => {
  try {
    // Sample Chroma URL for testing
    const sampleUrl = 'https://www.croma.com/nothing-watch-pro-2-smartwatch-with-bluetooth-calling-33-52mm-amoled-display-ip68-water-resistant-dark-grey-strap-/p/308373';
    
    // Initialize scraper
    const scraper = await initializeScraper();
    
    // Scrape the sample product
    const productData = await scraper.scrapeProduct(sampleUrl);
    
    res.json({
      success: true,
      message: 'Test scraping completed successfully',
      sampleUrl: sampleUrl,
      data: productData,
      scrapedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /test endpoint:', error);
    
    res.status(500).json({
      success: false,
      error: 'Test scraping failed',
      message: error.message || 'An error occurred during test scraping',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Chroma route error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
