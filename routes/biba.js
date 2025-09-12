var express = require('express');
var router = express.Router();
const BibaScraper = require('../utilities/bibaScraper');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// Function to fetch HTML content using axios
async function fetchWithAxios(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 30000
        });
        
        return response.data;
    } catch (error) {
        console.error('Axios error:', error);
        throw error;
    }
}

router.post('/scrape', async (req, res) => {
    const { url } = req.body;
    const scraper = new BibaScraper();

    if (!url) {
        return res.status(400).json({ success: false, message: "Please provide a URL to scrape." });
    }

    try {
        // Fetch HTML content using axios
        console.log('Fetching HTML from URL using axios:', url);
        const htmlContent = await fetchWithAxios(url);
        const scrapedData = await scraper.scrapeProduct(htmlContent);
        scrapedData.url = url;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `biba-product-${timestamp}.json`;
        const filePath = path.join(__dirname, '../scraped_data', filename);

        // Ensure the directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(scrapedData, null, 2));

        res.json({ 
            success: true, 
            message: "Product scraped successfully", 
            data: scrapedData, 
            savedTo: filename, 
            timestamp: new Date().toISOString() 
        });
    } catch (error) {
        console.error('Scraping error:', error);
        if (error.code === 'ECONNABORTED') {
            res.status(408).json({ 
                success: false, 
                message: "Request timeout - Page took too long to load", 
                error: error.message 
            });
        } else if (error.response && error.response.status === 403) {
            res.status(403).json({ 
                success: false, 
                message: "Access denied - Website blocked the request", 
                error: error.message 
            });
        } else if (error.response && error.response.status >= 500) {
            res.status(502).json({ 
                success: false, 
                message: "Server error - Website is experiencing issues", 
                error: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: "Failed to scrape product", 
                error: error.message 
            });
        }
    }
});

router.get('/scrape', async (req, res) => {
    const { url } = req.query;
    const scraper = new BibaScraper();

    if (!url) {
        return res.status(400).json({ 
            success: false, 
            message: "Please provide a URL parameter. Example: /api/biba/scrape?url=https://www.biba.in/orange-cotton-printed-anarkali-suit-set/SKDVIN8652ESS25ORG.html" 
        });
    }

    try {
        // Fetch HTML content using axios
        console.log('Fetching HTML from URL using axios:', url);
        const htmlContent = await fetchWithAxios(url);
        const scrapedData = await scraper.scrapeProduct(htmlContent);
        scrapedData.url = url;

        res.json({ 
            success: true, 
            message: "Product scraped successfully", 
            data: scrapedData, 
            timestamp: new Date().toISOString() 
        });
    } catch (error) {
        console.error('Scraping error:', error);
        if (error.code === 'ECONNABORTED') {
            res.status(408).json({ 
                success: false, 
                message: "Request timeout - Page took too long to load", 
                error: error.message 
            });
        } else if (error.response && error.response.status === 403) {
            res.status(403).json({ 
                success: false, 
                message: "Access denied - Website blocked the request", 
                error: error.message 
            });
        } else if (error.response && error.response.status >= 500) {
            res.status(502).json({ 
                success: false, 
                message: "Server error - Website is experiencing issues", 
                error: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: "Failed to scrape product", 
                error: error.message 
            });
        }
    }
});

router.get('/test', async (req, res) => {
    try {
        const scraper = new BibaScraper();
        const htmlFilePath = path.join(__dirname, '../scrapinghtml', 'biba.html');
        
        const htmlContent = await fs.readFile(htmlFilePath, 'utf8');
        const scrapedData = await scraper.scrapeProduct(htmlContent);
        
        res.json({ 
            success: true, 
            message: "Test scraping completed", 
            data: scrapedData 
        });
    } catch (error) {
        console.error('Test scraping error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to test scrape", 
            error: error.message 
        });
    }
});

module.exports = router;
