const express = require('express');
const router = express.Router();
const OneMgScraper = require('../utilities/oneMgScraper');
const fs = require('fs').promises;
const path = require('path');

// Initialize scraper instance
let oneMgScraper = null;

// Initialize scraper
const initializeScraper = async () => {
    if (!oneMgScraper) {
        oneMgScraper = new OneMgScraper();
        await oneMgScraper.init();
    }
    return oneMgScraper;
};

// Cleanup scraper
const cleanupScraper = async () => {
    if (oneMgScraper) {
        await oneMgScraper.close();
        oneMgScraper = null;
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
const validateOneMgUrl = (url) => {
    if (!url) return false;
    return url.includes('1mg.com') && (url.includes('/otc/') || url.includes('/drugs/') || url.includes('/product'));
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
                message: 'Please provide a valid 1mg product URL'
            });
        }

        if (!validateOneMgUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL',
                message: 'Please provide a valid 1mg product URL'
            });
        }

        const scraper = await initializeScraper();
        const productData = await scraper.scrapeProduct(url);

        // Save scraped data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `1mg-product-${timestamp}.json`;
        await saveScrapedData(productData, filename);

        res.json({
            success: true,
            message: 'Product scraped successfully',
            data: productData,
            savedTo: filename,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error scraping 1mg product');
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
                message: 'Please provide an array of valid 1mg product URLs'
            });
        }

        // Validate all URLs
        const invalidUrls = urls.filter(url => !validateOneMgUrl(url));
        if (invalidUrls.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URLs found',
                message: 'All URLs must be valid 1mg product URLs',
                invalidUrls: invalidUrls
            });
        }

        const scraper = await initializeScraper();
        const productsData = await scraper.scrapeMultipleProducts(urls);

        // Save scraped data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `1mg-products-${timestamp}.json`;
        await saveScrapedData(productsData, filename);

        res.json({
            success: true,
            message: `Scraped ${productsData.length} products successfully`,
            data: productsData,
            savedTo: filename,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error scraping multiple 1mg products');
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
        handleError(res, error, 'Error searching 1mg products');
    }
});

// Route: Get products by category
router.get('/category/:categorySlug', async (req, res) => {
    try {
        const { categorySlug } = req.params;
        const { limit = 20 } = req.query;
        
        if (!categorySlug) {
            return res.status(400).json({
                success: false,
                error: 'Category slug is required',
                message: 'Please provide a valid category slug'
            });
        }

        const scraper = await initializeScraper();
        const productUrls = await scraper.getProductsByCategory(categorySlug, parseInt(limit));

        res.json({
            success: true,
            message: `Found ${productUrls.length} products in category "${categorySlug}"`,
            categorySlug: categorySlug,
            limit: parseInt(limit),
            productUrls: productUrls,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error getting products by category');
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
                message: 'Please provide a valid 1mg product URL'
            });
        }

        if (!validateOneMgUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL',
                message: 'Please provide a valid 1mg product URL'
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
        handleError(res, error, 'Error getting 1mg product details');
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

        // Construct URL from product ID (assuming OTC product)
        const url = `https://www.1mg.com/otc/product-${productId}`;
        
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
        handleError(res, error, 'Error getting 1mg product by ID');
    }
});

// Route: Get scraper status
router.get('/status', async (req, res) => {
    try {
        const isInitialized = oneMgScraper !== null;
        
        res.json({
            success: true,
            message: '1mg scraper status',
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
            message: '1mg scraper initialized successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error initializing 1mg scraper');
    }
});

// Route: Cleanup scraper
router.post('/cleanup', async (req, res) => {
    try {
        await cleanupScraper();
        
        res.json({
            success: true,
            message: '1mg scraper cleaned up successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error, 'Error cleaning up 1mg scraper');
    }
});

// Route: Get all saved scraped files
router.get('/files', async (req, res) => {
    try {
        const scrapingDir = path.join(__dirname, '../scrapinghtml');
        
        try {
            const files = await fs.readdir(scrapingDir);
            const oneMgFiles = files.filter(file => file.startsWith('1mg-') && file.endsWith('.json'));
            
            const fileDetails = await Promise.all(
                oneMgFiles.map(async (file) => {
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
                message: '1mg scraped files retrieved successfully',
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
        
        if (!filename.endsWith('.json') || !filename.startsWith('1mg-')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid filename',
                message: 'Filename must be a valid 1mg scraped file'
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
        
        if (!filename.endsWith('.json') || !filename.startsWith('1mg-')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid filename',
                message: 'Filename must be a valid 1mg scraped file'
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
        message: '1mg scraper service is healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Route: Get API documentation
router.get('/docs', (req, res) => {
    const documentation = {
        title: '1mg Scraper API Documentation',
        version: '1.0.0',
        description: 'API for scraping product data from 1mg.com',
        endpoints: {
            'POST /api/1mg/scrape': {
                description: 'Scrape a single product from 1mg',
                parameters: {
                    url: '1mg product URL (required)'
                },
                example: {
                    url: 'https://www.1mg.com/otc/tynor-b-02-soft-cervical-collar-with-support-medium-otc344139'
                }
            },
            'POST /api/1mg/scrape-multiple': {
                description: 'Scrape multiple products from 1mg',
                parameters: {
                    urls: 'Array of 1mg product URLs (required)'
                }
            },
            'GET /api/1mg/search': {
                description: 'Search products on 1mg',
                parameters: {
                    q: 'Search query (required)',
                    limit: 'Number of results (optional, default: 10)'
                }
            },
            'GET /api/1mg/category/:categorySlug': {
                description: 'Get products by category',
                parameters: {
                    categorySlug: 'Category slug (required)',
                    limit: 'Number of results (optional, default: 20)'
                }
            },
            'GET /api/1mg/product': {
                description: 'Get product details by URL',
                parameters: {
                    url: '1mg product URL (required)'
                }
            },
            'GET /api/1mg/product/:productId': {
                description: 'Get product details by product ID',
                parameters: {
                    productId: 'Product ID (required)'
                }
            },
            'GET /api/1mg/status': {
                description: 'Get scraper status'
            },
            'POST /api/1mg/init': {
                description: 'Initialize the scraper'
            },
            'POST /api/1mg/cleanup': {
                description: 'Cleanup the scraper'
            },
            'GET /api/1mg/files': {
                description: 'Get list of all scraped files'
            },
            'GET /api/1mg/files/:filename': {
                description: 'Get specific scraped file content'
            },
            'DELETE /api/1mg/files/:filename': {
                description: 'Delete a scraped file'
            },
            'GET /api/1mg/health': {
                description: 'Health check endpoint'
            }
        },
        dataStructure: {
            product: {
                title: 'Product title',
                productId: 'Product ID',
                brand: 'Product brand',
                mrp: 'Maximum Retail Price',
                sellingPrice: 'Current selling price',
                discount: 'Discount percentage',
                discountPercent: 'Discount percentage text',
                images: 'Array of product images',
                sizes: 'Array of available sizes/variants',
                rating: 'Product rating and reviews',
                description: 'Product description',
                highlights: 'Array of product highlights',
                manufacturer: 'Manufacturer information',
                marketer: 'Marketer information',
                specifications: 'Array of product specifications',
                quantities: 'Available quantities',
                availability: 'Stock availability',
                offers: 'Additional offers/coupons',
                category: 'Product category breadcrumbs',
                standardPack: 'Standard pack information',
                vendorInfo: 'Vendor information',
                tags: 'Product tags'
            }
        }
    };

    res.json(documentation);
});

// Cleanup on process exit
process.on('SIGINT', async () => {
    console.log('Cleaning up 1mg scraper...');
    await cleanupScraper();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Cleaning up 1mg scraper...');
    await cleanupScraper();
    process.exit(0);
});

module.exports = router;
