const express = require('express');
const router = express.Router();
const MyntraScraper = require('../utilities/myntraScraper');
const MyntraCategoryScraper = require('../utilities/myntraCategoryScraper');

router.post('/scrape-category', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.includes('myntra.com')) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid Myntra.com category URL'
    });
  }
  try {
    const data = await MyntraCategoryScraper.scrapeCategory(url);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// Myntra Product Scraping API
router.post('/scrape-product', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('myntra.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Myntra.com product URL'
      });
    }

    // Scrape the product using the comprehensive scraper
    const productData = await MyntraScraper.scrapeProduct(url);
    
    if (!productData) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    res.json({
      success: true,
      message: 'Myntra product scraped successfully',
      data: productData
    });

  } catch (error) {
    console.error('Myntra scraping error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the Myntra product',
      error: error.message
    });
  }
});

// Get product by URL (GET method)
router.get('/scrape-product', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || !url.includes('myntra.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Myntra.com product URL as query parameter'
      });
    }

    // Scrape the product using the comprehensive scraper
    const productData = await MyntraScraper.scrapeProduct(url);
    
    if (!productData) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    res.json({
      success: true,
      message: 'Myntra product scraped successfully',
      data: productData
    });

  } catch (error) {
    console.error('Myntra scraping error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the Myntra product',
      error: error.message
    });
  }
});

// Scrape and save product with images
router.post('/scrape-with-images', async (req, res) => {
  try {
    const { url, downloadImages = true } = req.body;
    
    if (!url || !url.includes('myntra.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Myntra.com product URL'
      });
    }

    // Scrape the product with images
    const result = await MyntraScraper.scrapeWithImages(url, downloadImages);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    res.json({
      success: true,
      message: 'Myntra product scraped successfully with images',
      data: result
    });

  } catch (error) {
    console.error('Myntra scraping with images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping the Myntra product with images',
      error: error.message
    });
  }
});

// Scrape and save to file
router.post('/scrape-and-save', async (req, res) => {
  try {
    const { url, filename } = req.body;
    
    if (!url || !url.includes('myntra.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Myntra.com product URL'
      });
    }

    // Scrape and save the product
    const result = await MyntraScraper.scrapeAndSave(url, filename);
    
    res.json({
      success: true,
      message: 'Myntra product scraped and saved successfully',
      data: {
        filepath: result,
        message: 'Product data saved to file'
      }
    });

  } catch (error) {
    console.error('Myntra scrape and save error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while scraping and saving the Myntra product',
      error: error.message
    });
  }
});

// Extract product specifications
router.post('/product-specifications', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('myntra.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Myntra.com product URL'
      });
    }

    // Scrape the product to get specifications
    const productData = await MyntraScraper.scrapeProduct(url);
    
    if (!productData) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    // Extract only the specifications
    const specifications = productData.specifications || {};
    
    res.json({
      success: true,
      message: 'Product specifications extracted successfully',
      data: {
        url: url,
        specifications: specifications,
        scrapedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Myntra specifications extraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while extracting product specifications',
      error: error.message
    });
  }
});

// Extract product sizes and availability
router.post('/product-sizes', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('myntra.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Myntra.com product URL'
      });
    }

    // Scrape the product to get sizes
    const productData = await MyntraScraper.scrapeProduct(url);
    
    if (!productData) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    // Extract only the sizes information
    const sizes = productData.sizes || [];
    
    res.json({
      success: true,
      message: 'Product sizes extracted successfully',
      data: {
        url: url,
        sizes: sizes,
        scrapedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Myntra sizes extraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while extracting product sizes',
      error: error.message
    });
  }
});

// Extract best offers and deals
router.post('/best-offers', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('myntra.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Myntra.com product URL'
      });
    }

    // Scrape the product to get offers
    const productData = await MyntraScraper.scrapeProduct(url);
    
    if (!productData) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    // Extract only the offers information
    const bestOffers = productData.bestOffers || [];
    
    res.json({
      success: true,
      message: 'Best offers extracted successfully',
      data: {
        url: url,
        bestOffers: bestOffers,
        scrapedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Myntra offers extraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while extracting best offers',
      error: error.message
    });
  }
});

// Extract product rating and reviews
router.post('/product-rating', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('myntra.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Myntra.com product URL'
      });
    }

    // Scrape the product to get rating and reviews
    const productData = await MyntraScraper.scrapeProduct(url);
    
    if (!productData) {
      return res.status(404).json({
        success: false,
        message: 'Product information not found. The page might be protected or unavailable.'
      });
    }
    
    // Extract only the rating and reviews
    const ratingInfo = {
      rating: productData.rating,
      reviews: productData.reviews
    };
    
    res.json({
      success: true,
      message: 'Product rating and reviews extracted successfully',
      data: {
        url: url,
        ratingInfo: ratingInfo,
        scrapedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Myntra rating extraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error occurred while extracting product rating and reviews',
      error: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Myntra Scraping API is running',
    timestamp: new Date().toISOString()
  });
});

// Close browser endpoint (for cleanup)
router.post('/close-browser', async (req, res) => {
  try {
    await MyntraScraper.closeBrowser();
    res.json({
      success: true,
      message: 'Myntra scraper browser closed successfully'
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
