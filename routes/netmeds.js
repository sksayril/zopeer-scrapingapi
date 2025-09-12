const express = require('express');
const router = express.Router();
const NetmedsScraper = require('../utilities/netmedsScraper');
const fs = require('fs');
const path = require('path');

// Initialize scraper
const netmedsScraper = new NetmedsScraper();

// Scrape product from URL
router.post('/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL is required'
            });
        }

        // Validate Netmeds URL
        if (!url.includes('netmeds.com')) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid Netmeds URL'
            });
        }

        // Fetch HTML content
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const htmlContent = await response.text();
        
        // Scrape product data
        const result = await netmedsScraper.scrapeProduct(htmlContent);
        
        // Save to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `netmeds-product-${timestamp}.json`;
        const filepath = path.join(__dirname, '..', 'scrapinghtml', filename);
        
        fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
        
        result.savedTo = filename;
        result.timestamp = new Date().toISOString();
        
        res.json(result);
        
    } catch (error) {
        console.error('Error scraping Netmeds product:', error);
        res.status(500).json({
            success: false,
            message: 'Error scraping product',
            error: error.message
        });
    }
});

// Scrape product from HTML file
router.post('/scrape-file', async (req, res) => {
    try {
        const { filename } = req.body;
        
        if (!filename) {
            return res.status(400).json({
                success: false,
                message: 'Filename is required'
            });
        }

        const filepath = path.join(__dirname, '..', 'scrapinghtml', filename);
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        const htmlContent = fs.readFileSync(filepath, 'utf8');
        const result = await netmedsScraper.scrapeProduct(htmlContent);
        
        // Save result to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultFilename = `netmeds-result-${timestamp}.json`;
        const resultFilepath = path.join(__dirname, '..', 'scrapinghtml', resultFilename);
        
        fs.writeFileSync(resultFilepath, JSON.stringify(result, null, 2));
        
        result.savedTo = resultFilename;
        result.timestamp = new Date().toISOString();
        
        res.json(result);
        
    } catch (error) {
        console.error('Error scraping Netmeds from file:', error);
        res.status(500).json({
            success: false,
            message: 'Error scraping product from file',
            error: error.message
        });
    }
});

// Search products
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        // This would typically search through saved products or make API calls
        // For now, return a placeholder response
        res.json({
            success: true,
            message: 'Search functionality not implemented yet',
            query: query,
            results: []
        });
        
    } catch (error) {
        console.error('Error searching Netmeds products:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching products',
            error: error.message
        });
    }
});

// Get all scraped products
router.get('/products', (req, res) => {
    try {
        const scrapingDir = path.join(__dirname, '..', 'scrapinghtml');
        const files = fs.readdirSync(scrapingDir);
        
        const netmedsFiles = files.filter(file => 
            file.startsWith('netmeds-product-') && file.endsWith('.json')
        );
        
        const products = netmedsFiles.map(file => {
            const filepath = path.join(scrapingDir, file);
            const content = fs.readFileSync(filepath, 'utf8');
            return JSON.parse(content);
        });
        
        res.json({
            success: true,
            message: 'Products retrieved successfully',
            count: products.length,
            products: products
        });
        
    } catch (error) {
        console.error('Error getting Netmeds products:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving products',
            error: error.message
        });
    }
});

// Get specific product by filename
router.get('/product/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(__dirname, '..', 'scrapinghtml', filename);
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({
                success: false,
                message: 'Product file not found'
            });
        }
        
        const content = fs.readFileSync(filepath, 'utf8');
        const product = JSON.parse(content);
        
        res.json({
            success: true,
            message: 'Product retrieved successfully',
            product: product
        });
        
    } catch (error) {
        console.error('Error getting Netmeds product:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving product',
            error: error.message
        });
    }
});

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Netmeds scraper is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
