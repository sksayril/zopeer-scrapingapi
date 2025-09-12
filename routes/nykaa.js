const express = require('express');
const router = express.Router();
const NykaaScraper = require('../utilities/nykaaScraper');
const fs = require('fs').promises;
const path = require('path');

// Initialize scraper instance
let nykaaScraper = null;

// Initialize scraper
const initializeScraper = async () => {
    if (!nykaaScraper) {
        nykaaScraper = new NykaaScraper();
        await nykaaScraper.init();
    }
    return nykaaScraper;
};

// Cleanup scraper
const cleanupScraper = async () => {
    if (nykaaScraper) {
        await nykaaScraper.close();
        nykaaScraper = null;
    }
};

// Error handling middleware
const handleError = (res, error, message = 'An error occurred') => {
    console.error(`${message}:`, error);
    res.status(500).json({
        success: false,
        error: message,
        details: error.message,
        timestamp: new Date().toISOString()
    });
};

// Validate URL
const validateNykaaUrl = (url) => {
    if (!url) return false;
    return url.includes('nykaa.com') && (url.includes('/p/') || url.includes('/product'));
};

// Save scraped data to file
const saveScrapedData = async (data, filename) => {
    try {
        const scrapingDir = path.join(__dirname, '../scrapinghtml');
        await fs.mkdir(scrapingDir, { recursive: true });
        
        const filePath = path.join(scrapingDir, filename);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        
        console.log(`Scraped data saved to: ${filePath}`);
        return filePath;
    } catch (error) {
        console.error('Error saving scraped data:', error);
        throw error;
    }
};

// Route: Scrape single product
router.post('/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required',
                message: 'Please provide a valid Nykaa product URL'
            });
        }

        if (!validateNykaaUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL',
                message: 'Please provide a valid Nykaa product URL'
            });
        }

        const scraper = await initializeScraper();
        const productData = await scraper.scrapeProduct(url);

        // Save scraped data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `nykaa-product-${timestamp}.json`;
        await saveScrapedData(productData, filename);

        res.json({
            success: true,
            message: 'Product scraped successfully',
            data: productData,
            savedTo: filename,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error scraping Nykaa product');
    }
});

// Route: Scrape multiple products
router.post('/scrape-multiple', async (req, res) => {
    try {
        const { urls } = req.body;
        
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'URLs array is required',
                message: 'Please provide an array of valid Nykaa product URLs'
            });
        }

        // Validate all URLs
        const invalidUrls = urls.filter(url => !validateNykaaUrl(url));
        if (invalidUrls.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URLs found',
                message: 'All URLs must be valid Nykaa product URLs',
                invalidUrls: invalidUrls
            });
        }

        const scraper = await initializeScraper();
        const productsData = await scraper.scrapeMultipleProducts(urls);

        // Save scraped data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `nykaa-products-${timestamp}.json`;
        await saveScrapedData(productsData, filename);

        res.json({
            success: true,
            message: `Scraped ${productsData.length} products successfully`,
            data: productsData,
            savedTo: filename,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error scraping multiple Nykaa products');
    }
});

// Route: Search products
router.get('/search', async (req, res) => {
    try {
        const { q: query, limit = 10 } = req.query;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required',
                message: 'Please provide a search query parameter'
            });
        }

        const scraper = await initializeScraper();
        const productUrls = await scraper.searchProducts(query, parseInt(limit));

        res.json({
            success: true,
            message: `Found ${productUrls.length} products for "${query}"`,
            query: query,
            limit: parseInt(limit),
            productUrls: productUrls,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error searching Nykaa products');
    }
});

// Route: Get product details by URL
router.get('/product', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required',
                message: 'Please provide a valid Nykaa product URL'
            });
        }

        if (!validateNykaaUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL',
                message: 'Please provide a valid Nykaa product URL'
            });
        }

        const scraper = await initializeScraper();
        const productData = await scraper.scrapeProduct(url);

        res.json({
            success: true,
            message: 'Product details retrieved successfully',
            data: productData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error getting Nykaa product details');
    }
});

// Route: Get product by ID
router.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        
        if (!productId) {
            return res.status(400).json({
                success: false,
                error: 'Product ID is required',
                message: 'Please provide a valid product ID'
            });
        }

        // Construct URL from product ID
        const url = `https://www.nykaa.com/product?product_id=${productId}`;
        
        const scraper = await initializeScraper();
        const productData = await scraper.scrapeProduct(url);

        res.json({
            success: true,
            message: 'Product details retrieved successfully',
            productId: productId,
            data: productData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error getting Nykaa product by ID');
    }
});

// Route: Get scraper status
router.get('/status', async (req, res) => {
    try {
        const isInitialized = nykaaScraper !== null;
        
        res.json({
            success: true,
            message: 'Nykaa scraper status',
            initialized: isInitialized,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error getting scraper status');
    }
});

// Route: Initialize scraper
router.post('/init', async (req, res) => {
    try {
        await initializeScraper();
        
        res.json({
            success: true,
            message: 'Nykaa scraper initialized successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error initializing Nykaa scraper');
    }
});

// Route: Cleanup scraper
router.post('/cleanup', async (req, res) => {
    try {
        await cleanupScraper();
        
        res.json({
            success: true,
            message: 'Nykaa scraper cleaned up successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error cleaning up Nykaa scraper');
    }
});

// Route: Get all saved scraped files
router.get('/files', async (req, res) => {
    try {
        const scrapingDir = path.join(__dirname, '../scrapinghtml');
        
        try {
            const files = await fs.readdir(scrapingDir);
            const nykaaFiles = files.filter(file => file.startsWith('nykaa-') && file.endsWith('.json'));
            
            const fileDetails = await Promise.all(
                nykaaFiles.map(async (file) => {
                    const filePath = path.join(scrapingDir, file);
                    const stats = await fs.stat(filePath);
                    return {
                        filename: file,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    };
                })
            );

            res.json({
                success: true,
                message: 'Nykaa scraped files retrieved successfully',
                files: fileDetails,
                count: fileDetails.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            if (error.code === 'ENOENT') {
                res.json({
                    success: true,
                    message: 'No scraped files found',
                    files: [],
                    count: 0,
                    timestamp: new Date().toISOString()
                });
            } else {
                throw error;
            }
        }

    } catch (error) {
        handleError(res, error, 'Error getting scraped files');
    }
});

// Route: Get specific scraped file
router.get('/files/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        if (!filename.endsWith('.json') || !filename.startsWith('nykaa-')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid filename',
                message: 'Filename must be a valid Nykaa scraped file'
            });
        }

        const scrapingDir = path.join(__dirname, '../scrapinghtml');
        const filePath = path.join(scrapingDir, filename);
        
        try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(fileContent);
            
            res.json({
                success: true,
                message: 'File retrieved successfully',
                filename: filename,
                data: data,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({
                    success: false,
                    error: 'File not found',
                    message: `File ${filename} does not exist`
                });
            } else {
                throw error;
            }
        }

    } catch (error) {
        handleError(res, error, 'Error getting scraped file');
    }
});

// Route: Delete scraped file
router.delete('/files/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        if (!filename.endsWith('.json') || !filename.startsWith('nykaa-')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid filename',
                message: 'Filename must be a valid Nykaa scraped file'
            });
        }

        const scrapingDir = path.join(__dirname, '../scrapinghtml');
        const filePath = path.join(scrapingDir, filename);
        
        try {
            await fs.unlink(filePath);
            
            res.json({
                success: true,
                message: 'File deleted successfully',
                filename: filename,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({
                    success: false,
                    error: 'File not found',
                    message: `File ${filename} does not exist`
                });
            } else {
                throw error;
            }
        }

    } catch (error) {
        handleError(res, error, 'Error deleting scraped file');
    }
});

// Route: Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Nykaa scraper service is healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Route: Get API documentation
router.get('/docs', (req, res) => {
    const documentation = {
        title: 'Nykaa Scraper API Documentation',
        version: '1.0.0',
        description: 'API for scraping product data from Nykaa.com',
        endpoints: {
            'POST /api/nykaa/scrape': {
                description: 'Scrape a single product from Nykaa',
                parameters: {
                    url: 'Nykaa product URL (required)'
                },
                example: {
                    url: 'https://www.nykaa.com/l-oreal-paris-hyaluron-moisture-72h-moisture-filling-shampoo-with-hyaluronic-acid/p/6671067'
                }
            },
            'POST /api/nykaa/scrape-multiple': {
                description: 'Scrape multiple products from Nykaa',
                parameters: {
                    urls: 'Array of Nykaa product URLs (required)'
                }
            },
            'GET /api/nykaa/search': {
                description: 'Search products on Nykaa',
                parameters: {
                    q: 'Search query (required)',
                    limit: 'Number of results (optional, default: 10)'
                }
            },
            'GET /api/nykaa/product': {
                description: 'Get product details by URL',
                parameters: {
                    url: 'Nykaa product URL (required)'
                }
            },
            'GET /api/nykaa/product/:productId': {
                description: 'Get product details by product ID',
                parameters: {
                    productId: 'Product ID (required)'
                }
            },
            'GET /api/nykaa/status': {
                description: 'Get scraper status'
            },
            'POST /api/nykaa/init': {
                description: 'Initialize the scraper'
            },
            'POST /api/nykaa/cleanup': {
                description: 'Cleanup the scraper'
            },
            'GET /api/nykaa/files': {
                description: 'Get list of all scraped files'
            },
            'GET /api/nykaa/files/:filename': {
                description: 'Get specific scraped file content'
            },
            'DELETE /api/nykaa/files/:filename': {
                description: 'Delete a scraped file'
            },
            'GET /api/nykaa/health': {
                description: 'Health check endpoint'
            }
        },
        dataStructure: {
            product: {
                title: 'Product title',
                brand: 'Product brand',
                productId: 'Product ID',
                mrp: 'Maximum Retail Price',
                sellingPrice: 'Current selling price',
                discount: 'Discount percentage',
                images: 'Array of product images',
                sizes: 'Array of available sizes',
                rating: 'Product rating',
                reviews: 'Review count and ratings',
                description: 'Product description',
                features: 'Array of product features',
                ingredients: 'Array of ingredients',
                category: 'Product category',
                availability: 'Stock availability',
                additionalDetails: 'Additional product details'
            }
        }
    };

    res.json(documentation);
});

// Cleanup on process exit
process.on('SIGINT', async () => {
    console.log('Cleaning up Nykaa scraper...');
    await cleanupScraper();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Cleaning up Nykaa scraper...');
    await cleanupScraper();
    process.exit(0);
});

module.exports = router;
