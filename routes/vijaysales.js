const express = require('express');
const router = express.Router();
const VijaySalesScraper = require('../utilities/vijaysalesScraper');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Initialize scraper
const vijaySalesScraper = new VijaySalesScraper();

/**
 * GET /vijaysales/scrape/url
 * Scrape product information directly from Vijay Sales URL
 */
router.get('/scrape', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL parameter is required'
            });
        }

        // Validate URL
        if (!url.includes('vijaysales.com')) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid Vijay Sales URL'
            });
        }

        console.log(`Scraping Vijay Sales product from URL: ${url}`);
        
        // Fetch HTML content from URL
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 30000
        });

        // Scrape product data
        const productData = await vijaySalesScraper.scrapeProduct(response.data, url);
        
        res.json({
            success: true,
            message: 'Product scraped successfully from URL',
            data: productData
        });

    } catch (error) {
        console.error('Error scraping Vijay Sales product from URL:', error);
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return res.status(400).json({
                success: false,
                message: 'Unable to connect to the provided URL. Please check if the URL is correct and accessible.',
                error: error.message
            });
        }
        
        if (error.response && error.response.status === 404) {
            return res.status(404).json({
                success: false,
                message: 'Product page not found. Please check if the URL is correct.',
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to scrape product from URL',
            error: error.message
        });
    }
});

/**
 * GET /vijaysales/scrape
 * Scrape product information from Vijay Sales HTML file
 */
router.get('/scrape', async (req, res) => {
    try {
        const { file, url } = req.query;
        
        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'File parameter is required'
            });
        }

        const filePath = path.join(__dirname, '../scrapinghtml', file);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'HTML file not found'
            });
        }

        console.log(`Scraping Vijay Sales product from file: ${file}`);
        
        // Scrape product data
        const productData = await vijaySalesScraper.scrapeFromFile(filePath, url || '');
        
        res.json({
            success: true,
            message: 'Product scraped successfully',
            data: productData
        });

    } catch (error) {
        console.error('Error scraping Vijay Sales product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to scrape product',
            error: error.message
        });
    }
});

/**
 * POST /vijaysales/scrape/url
 * Scrape product information directly from Vijay Sales URL (POST method)
 */
router.post('/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL is required in request body'
            });
        }

        // Validate URL
        if (!url.includes('vijaysales.com')) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid Vijay Sales URL'
            });
        }

        console.log(`Scraping Vijay Sales product from URL: ${url}`);
        
        // Fetch HTML content from URL
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 30000
        });

        // Scrape product data
        const productData = await vijaySalesScraper.scrapeProduct(response.data, url);
        
        res.json({
            success: true,
            message: 'Product scraped successfully from URL',
            data: productData
        });

    } catch (error) {
        console.error('Error scraping Vijay Sales product from URL:', error);
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return res.status(400).json({
                success: false,
                message: 'Unable to connect to the provided URL. Please check if the URL is correct and accessible.',
                error: error.message
            });
        }
        
        if (error.response && error.response.status === 404) {
            return res.status(404).json({
                success: false,
                message: 'Product page not found. Please check if the URL is correct.',
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to scrape product from URL',
            error: error.message
        });
    }
});

/**
 * POST /vijaysales/scrape
 * Scrape product information from provided HTML content
 */
router.post('/scrape', async (req, res) => {
    try {
        const { htmlContent, productUrl } = req.body;
        
        if (!htmlContent) {
            return res.status(400).json({
                success: false,
                message: 'HTML content is required'
            });
        }

        console.log('Scraping Vijay Sales product from provided HTML content');
        
        // Scrape product data
        const productData = await vijaySalesScraper.scrapeProduct(htmlContent, productUrl || '');
        
        res.json({
            success: true,
            message: 'Product scraped successfully',
            data: productData
        });

    } catch (error) {
        console.error('Error scraping Vijay Sales product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to scrape product',
            error: error.message
        });
    }
});

/**
 * GET /vijaysales/scrape/save
 * Scrape product and save to JSON file
 */
router.get('/scrape/save', async (req, res) => {
    try {
        const { file, url, output } = req.query;
        
        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'File parameter is required'
            });
        }

        const filePath = path.join(__dirname, '../scrapinghtml', file);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'HTML file not found'
            });
        }

        console.log(`Scraping Vijay Sales product from file: ${file}`);
        
        // Scrape product data
        const productData = await vijaySalesScraper.scrapeFromFile(filePath, url || '');
        
        // Generate output filename if not provided
        const outputFileName = output || `vijaysales-product-${Date.now()}.json`;
        const outputPath = path.join(__dirname, '../scrapinghtml', outputFileName);
        
        // Save to file
        await vijaySalesScraper.saveToFile(productData, outputPath);
        
        res.json({
            success: true,
            message: 'Product scraped and saved successfully',
            data: productData,
            outputFile: outputFileName
        });

    } catch (error) {
        console.error('Error scraping and saving Vijay Sales product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to scrape and save product',
            error: error.message
        });
    }
});

/**
 * GET /vijaysales/files
 * List available HTML files for scraping
 */
router.get('/files', (req, res) => {
    try {
        const scrapingDir = path.join(__dirname, '../scrapinghtml');
        
        if (!fs.existsSync(scrapingDir)) {
            return res.status(404).json({
                success: false,
                message: 'Scraping directory not found'
            });
        }

        const files = fs.readdirSync(scrapingDir)
            .filter(file => file.endsWith('.html'))
            .map(file => ({
                name: file,
                path: file,
                size: fs.statSync(path.join(scrapingDir, file)).size,
                modified: fs.statSync(path.join(scrapingDir, file)).mtime
            }));

        res.json({
            success: true,
            message: 'HTML files retrieved successfully',
            files: files
        });

    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list files',
            error: error.message
        });
    }
});

/**
 * GET /vijaysales/analyze/:filename
 * Analyze HTML file structure without full scraping
 */
router.get('/analyze/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, '../scrapinghtml', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'HTML file not found'
            });
        }

        const htmlContent = fs.readFileSync(filePath, 'utf8');
        const cheerio = require('cheerio');
        const $ = cheerio.load(htmlContent);
        
        // Basic analysis
        const analysis = {
            filename,
            fileSize: fs.statSync(filePath).size,
            hasProductName: $('h1.productFullDetail__productName').length > 0,
            hasPrice: $('.product__price--price').length > 0,
            hasRating: $('.product__title--reviews-star').length > 0,
            hasImages: $('.carousel__root').length > 0,
            hasFeatures: $('.productfeatures').length > 0,
            hasSpecifications: $('table.specifications').length > 0,
            hasOffers: $('.product__tags--label').length > 0,
            hasEMI: $('.product__price--emi').length > 0,
            hasBreadcrumbs: $('.cmp-breadcrumb').length > 0,
            productName: $('h1.productFullDetail__productName span[role="name"]').text().trim() || 'Not found',
            currentPrice: $('.product__price--price[data-final-price]').attr('data-final-price') || 'Not found',
            originalPrice: $('.product__price--mrp span[data-mrp]').attr('data-mrp') || 'Not found',
            rating: $('.product__title--reviews-star').attr('data-rating-summary') || 'Not found',
            imageCount: $('.thumbnail__image').length,
            offerCount: $('.product__tags--label').length
        };

        res.json({
            success: true,
            message: 'File analysis completed',
            analysis: analysis
        });

    } catch (error) {
        console.error('Error analyzing file:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze file',
            error: error.message
        });
    }
});

/**
 * GET /vijaysales/test/url
 * Test URL scraping with a sample Vijay Sales URL
 */
router.get('/test/url', async (req, res) => {
    try {
        // Use a sample Vijay Sales URL for testing
        const testUrl = 'https://www.vijaysales.com/p/P234571/234571/lg-7-kg-5-star-fully-automatic-front-load-washing-machine-with-inverter-direct-drive-steam-full-touch-control-fhb1207z2m-middle-black';
        
        console.log(`Testing URL scraping with: ${testUrl}`);
        
        const response = await axios.get(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 30000
        });

        const productData = await vijaySalesScraper.scrapeProduct(response.data, testUrl);
        
        res.json({
            success: true,
            message: 'URL scraping test completed successfully',
            testUrl: testUrl,
            data: productData
        });

    } catch (error) {
        console.error('Error testing URL scraping:', error);
        res.status(500).json({
            success: false,
            message: 'URL scraping test failed',
            error: error.message
        });
    }
});

/**
 * GET /vijaysales/test
 * Test endpoint to verify scraper functionality
 */
router.get('/test', async (req, res) => {
    try {
        const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Test Product</title></head>
        <body>
            <h1 class="productFullDetail__productName">
                <span role="name">Test Product Name</span>
            </h1>
            <div class="product__price--price" data-final-price="29990">₹29,990</div>
            <div class="product__price--mrp">
                <span data-mrp="44490">₹44,490</span>
            </div>
            <div class="product__title--reviews-star" data-rating-summary="4.8"></div>
            <div class="product__title--stats">
                <span>4.8 (12 Ratings & 12 Reviews)</span>
            </div>
        </body>
        </html>
        `;

        const productData = await vijaySalesScraper.scrapeProduct(testHtml, 'https://test.com');
        
        res.json({
            success: true,
            message: 'Scraper test completed successfully',
            testData: productData
        });

    } catch (error) {
        console.error('Error testing scraper:', error);
        res.status(500).json({
            success: false,
            message: 'Scraper test failed',
            error: error.message
        });
    }
});

/**
 * GET /vijaysales/debug
 * Debug endpoint to analyze HTML structure from URL
 */
router.get('/debug', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL parameter is required'
            });
        }

        console.log(`Debugging Vijay Sales URL: ${url}`);
        
        // Fetch HTML content from URL
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 30000
        });

        const cheerio = require('cheerio');
        const $ = cheerio.load(response.data);
        
        // Analyze HTML structure
        const analysis = {
            url: url,
            title: $('title').text().trim(),
            hasProductName: $('h1.productFullDetail__productName').length > 0,
            hasPrice: $('.product__price--price').length > 0,
            hasRating: $('.product__title--reviews-star').length > 0,
            hasFeatures: $('.product__keyfeatures--list').length > 0,
            hasSpecifications: $('.accordion-panel').length > 0,
            hasImages: $('.thumbnail__image').length > 0,
            hasOffers: $('.product__tags--label').length > 0,
            hasEMI: $('.product__price--emi').length > 0,
            hasBreadcrumbs: $('.cmp-breadcrumb').length > 0,
            productName: $('h1.productFullDetail__productName span[role="name"]').text().trim() || 'Not found',
            currentPrice: $('.product__price--price[data-final-price]').attr('data-final-price') || 'Not found',
            originalPrice: $('.product__price--mrp span[data-mrp]').attr('data-mrp') || 'Not found',
            rating: $('.product__title--reviews-star').attr('data-rating-summary') || 'Not found',
            imageCount: $('.thumbnail__image').length,
            offerCount: $('.product__tags--label').length,
            featureCount: $('.product__keyfeatures--list li').length,
            specCount: $('.accordion-panel ul li').length,
            loyaltyPoints: $('.product__price--loyalty b').text().trim() || 'Not found',
            warranty: $('#warranty_title').text().trim() || 'Not found'
        };

        res.json({
            success: true,
            message: 'Debug analysis completed',
            analysis: analysis
        });

    } catch (error) {
        console.error('Error debugging URL:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to debug URL',
            error: error.message
        });
    }
});

/**
 * GET /vijaysales/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Vijay Sales scraper is healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

module.exports = router;
