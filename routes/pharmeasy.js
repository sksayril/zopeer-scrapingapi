const express = require('express');
const router = express.Router();
const PharmEasyScraper = require('../utilities/pharmeasyScraper');
const fs = require('fs');
const path = require('path');

// Initialize scraper instance
let scraper = null;

// Initialize scraper
const initScraper = async () => {
    if (!scraper) {
        scraper = new PharmEasyScraper();
        await scraper.init();
    }
    return scraper;
};

// Cleanup scraper
const cleanupScraper = async () => {
    if (scraper) {
        await scraper.close();
        scraper = null;
    }
};

// Scrape single product
router.post('/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL is required'
            });
        }

        // Validate PharmEasy URL
        if (!url.includes('pharmeasy.in')) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid PharmEasy URL'
            });
        }

        const scraperInstance = await initScraper();
        const result = await scraperInstance.scrapeProduct(url);

        // Save result to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `pharmeasy-product-${timestamp}.json`;
        const filepath = path.join(__dirname, '..', 'scrapinghtml', filename);
        
        fs.writeFileSync(filepath, JSON.stringify(result, null, 2));

        res.json({
            success: true,
            message: 'Product scraped successfully',
            data: result,
            savedTo: filename,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error scraping PharmEasy product:', error);
        res.status(500).json({
            success: false,
            message: 'Error scraping product',
            error: error.message
        });
    }
});

// Scrape multiple products
router.post('/scrape-multiple', async (req, res) => {
    try {
        const { urls } = req.body;
        
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'URLs array is required'
            });
        }

        if (urls.length > 10) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 10 URLs allowed per request'
            });
        }

        const scraperInstance = await initScraper();
        const results = [];

        for (const url of urls) {
            try {
                if (!url.includes('pharmeasy.in')) {
                    results.push({
                        url,
                        success: false,
                        error: 'Invalid PharmEasy URL'
                    });
                    continue;
                }

                const result = await scraperInstance.scrapeProduct(url);
                results.push({
                    url,
                    success: true,
                    data: result
                });

                // Add delay between requests
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                results.push({
                    url,
                    success: false,
                    error: error.message
                });
            }
        }

        // Save results to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `pharmeasy-multiple-${timestamp}.json`;
        const filepath = path.join(__dirname, '..', 'scrapinghtml', filename);
        
        fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

        res.json({
            success: true,
            message: 'Products scraped successfully',
            results,
            savedTo: filename,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error scraping multiple PharmEasy products:', error);
        res.status(500).json({
            success: false,
            message: 'Error scraping products',
            error: error.message
        });
    }
});

// Search products
router.get('/search', async (req, res) => {
    try {
        const { query, limit = 10 } = req.query;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        // This would typically involve searching PharmEasy's search API
        // For now, we'll return a placeholder response
        res.json({
            success: true,
            message: 'Search functionality would be implemented here',
            query,
            limit: parseInt(limit),
            results: []
        });

    } catch (error) {
        console.error('Error searching PharmEasy products:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching products',
            error: error.message
        });
    }
});

// Get product by ID
router.get('/product/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Construct PharmEasy URL from product ID
        const url = `https://pharmeasy.in/online-medicine-order/${id}`;
        
        const scraperInstance = await initScraper();
        const result = await scraperInstance.scrapeProduct(url);

        res.json({
            success: true,
            message: 'Product retrieved successfully',
            data: result
        });

    } catch (error) {
        console.error('Error getting PharmEasy product:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving product',
            error: error.message
        });
    }
});

// Get scraper status
router.get('/status', (req, res) => {
    res.json({
        success: true,
        message: 'PharmEasy scraper is running',
        scraperInitialized: scraper !== null,
        timestamp: new Date().toISOString()
    });
});

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'PharmEasy scraper is healthy',
        timestamp: new Date().toISOString()
    });
});

// Cleanup endpoint
router.post('/cleanup', async (req, res) => {
    try {
        await cleanupScraper();
        res.json({
            success: true,
            message: 'Scraper cleaned up successfully'
        });
    } catch (error) {
        console.error('Error cleaning up scraper:', error);
        res.status(500).json({
            success: false,
            message: 'Error cleaning up scraper',
            error: error.message
        });
    }
});

// Test endpoint with sample PharmEasy URL
router.get('/test', async (req, res) => {
    try {
        const testUrl = 'https://pharmeasy.in/online-medicine-order/dolo-650mg-strip-of-15-tablets-44140';
        
        const scraperInstance = await initScraper();
        const result = await scraperInstance.scrapeProduct(testUrl);

        res.json({
            success: true,
            message: 'Test scraping completed successfully',
            data: result
        });

    } catch (error) {
        console.error('Error in test scraping:', error);
        res.status(500).json({
            success: false,
            message: 'Error in test scraping',
            error: error.message
        });
    }
});

// Get all saved PharmEasy products
router.get('/saved-products', (req, res) => {
    try {
        const scrapingDir = path.join(__dirname, '..', 'scrapinghtml');
        const files = fs.readdirSync(scrapingDir);
        
        const pharmeasyFiles = files
            .filter(file => file.startsWith('pharmeasy-') && file.endsWith('.json'))
            .map(file => {
                const filepath = path.join(scrapingDir, file);
                const stats = fs.statSync(filepath);
                return {
                    filename: file,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                };
            })
            .sort((a, b) => b.modified - a.modified);

        res.json({
            success: true,
            message: 'Saved PharmEasy products retrieved successfully',
            files: pharmeasyFiles,
            count: pharmeasyFiles.length
        });

    } catch (error) {
        console.error('Error getting saved products:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving saved products',
            error: error.message
        });
    }
});

// Get specific saved product
router.get('/saved-product/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        
        if (!filename.startsWith('pharmeasy-') || !filename.endsWith('.json')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid filename format'
            });
        }

        const filepath = path.join(__dirname, '..', 'scrapinghtml', filename);
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

        res.json({
            success: true,
            message: 'Saved product retrieved successfully',
            data
        });

    } catch (error) {
        console.error('Error getting saved product:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving saved product',
            error: error.message
        });
    }
});

// Cleanup on process exit
process.on('SIGINT', async () => {
    console.log('Cleaning up PharmEasy scraper...');
    await cleanupScraper();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Cleaning up PharmEasy scraper...');
    await cleanupScraper();
    process.exit(0);
});

module.exports = router;
