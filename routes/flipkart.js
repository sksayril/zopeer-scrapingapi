const express = require('express');
const router = express.Router();
const FlipkartScraper = require('../utilities/flipkartScraper');

// Flipkart Product Scraping API
router.post('/scrape-product', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('flipkart.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Flipkart.com product URL'
      });
    }

    // Scrape the product using the comprehensive scraper
    const productData = await FlipkartScraper.scrapeProduct(url);
    
    if (!productData) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    res.json({
      success: true,
      message: 'Flipkart product scraped successfully',
      data: productData
    });

  } catch (error) {
    console.error('Flipkart scraping error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the Flipkart product',
      error: error.message
    });
  }
});

// Get product by URL (GET method)
router.get('/scrape-product', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || !url.includes('flipkart.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Flipkart.com product URL as query parameter'
      });
    }

    // Scrape the product using the comprehensive scraper
    const productData = await FlipkartScraper.scrapeProduct(url);
    
    if (!productData) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    res.json({
      success: true,
      message: 'Flipkart product scraped successfully',
      data: productData
    });

  } catch (error) {
    console.error('Flipkart scraping error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the Flipkart product',
      error: error.message
    });
  }
});

// Scrape and save product with images
router.post('/scrape-with-images', async (req, res) => {
  try {
    const { url, downloadImages = true } = req.body;
    
    if (!url || !url.includes('flipkart.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Flipkart.com product URL'
      });
    }

    // Scrape the product with images
    const result = await FlipkartScraper.scrapeWithImages(url, downloadImages);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    res.json({
      success: true,
      message: 'Flipkart product scraped successfully with images',
      data: result
    });

  } catch (error) {
    console.error('Flipkart scraping with images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the Flipkart product with images',
      error: error.message
    });
  }
});

// Scrape and save to file
router.post('/scrape-and-save', async (req, res) => {
  try {
    const { url, filename } = req.body;
    
    if (!url || !url.includes('flipkart.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Flipkart.com product URL'
      });
    }

    // Scrape and save the product
    const result = await FlipkartScraper.scrapeAndSave(url, filename);
    
    res.json({
      success: true,
      message: 'Flipkart product scraped and saved successfully',
      data: {
        filepath: result,
        message: 'Product data saved to file'
      }
    });

  } catch (error) {
    console.error('Flipkart scrape and save error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping and saving the Flipkart product',
      error: error.message
    });
  }
});

// Extract view more offers information
router.post('/view-more-offers', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('flipkart.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Flipkart.com product URL'
      });
    }

    // Scrape the product to get view more offers info
    const productData = await FlipkartScraper.scrapeProduct(url);
    
    if (!productData) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    // Extract only the view more offers information
    const viewMoreOffers = productData.viewMoreOffers || {};
    
    res.json({
      success: true,
      message: 'View more offers information extracted successfully',
      data: {
        url: url,
        viewMoreOffers: viewMoreOffers,
        scrapedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Flipkart view more offers extraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while extracting view more offers information',
      error: error.message
    });
  }
});

// Test view more offers expansion specifically
router.post('/test-view-more-expansion', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('flipkart.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Flipkart.com product URL'
      });
    }

    console.log('🧪 Testing view more offers expansion for:', url);
    
    // Scrape the product with enhanced logging
    const productData = await FlipkartScraper.scrapeProduct(url);
    
    if (!productData) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    // Analyze the results
    const analysis = {
      totalOffers: productData.offers ? productData.offers.length : 0,
      viewMoreOffers: productData.viewMoreOffers || {},
      offersBreakdown: {
        regularOffers: 0,
        viewMoreOffers: 0
      },
      offerTypes: new Set(),
      expandedStatus: 'unknown'
    };
    
    if (productData.offers) {
      productData.offers.forEach(offer => {
        if (offer.type === 'viewMore') {
          analysis.offersBreakdown.viewMoreOffers++;
          analysis.expandedStatus = offer.status || 'unknown';
        } else {
          analysis.offersBreakdown.regularOffers++;
          analysis.offerTypes.add(offer.type);
        }
      });
    }
    
    res.json({
      success: true,
      message: 'View more offers expansion test completed',
      data: {
        url: url,
        analysis: analysis,
        allOffers: productData.offers || [],
        viewMoreInfo: productData.viewMoreOffers || {},
        scrapedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Flipkart view more expansion test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while testing view more offers expansion',
      error: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Flipkart Scraping API is running',
    timestamp: new Date().toISOString()
  });
});

// Close browser endpoint (for cleanup)
router.post('/close-browser', async (req, res) => {
  try {
    await FlipkartScraper.closeBrowser();
    res.json({
      success: true,
      message: 'Flipkart scraper browser closed successfully'
    });
  } catch (error) {
    console.error('Error closing browser:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while closing the browser',
      error: error.message
    });
  }
});

module.exports = router;
