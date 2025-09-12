var express = require('express');
var router = express.Router();
const LiciousScraper = require('../utilities/liciousScraper');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

// Function to fetch HTML content using Puppeteer
async function fetchWithPuppeteer(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        
        // Set user agent to mimic a real browser
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set viewport
        await page.setViewport({ width: 1366, height: 768 });
        
        // Navigate to the URL
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait for the page to load completely
        await page.waitForTimeout(3000);
        
        // Get the HTML content
        const htmlContent = await page.content();
        
        return htmlContent;
    } catch (error) {
        console.error('Puppeteer error:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

router.post('/scrape', async (req, res) => {
    const { url } = req.body;
    const scraper = new LiciousScraper();

    if (!url) {
        return res.status(400).json({ success: false, message: "Please provide a URL to scrape." });
    }

    try {
        // Fetch HTML content using Puppeteer
        console.log('Fetching HTML from URL using Puppeteer:', url);
        const htmlContent = await fetchWithPuppeteer(url);
        const scrapedData = await scraper.scrapeProduct(htmlContent);
        scrapedData.url = url;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `licious-product-${timestamp}.json`;
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
        if (error.name === 'TimeoutError') {
            res.status(408).json({ 
                success: false, 
                message: "Request timeout - Page took too long to load", 
                error: error.message 
            });
        } else if (error.message.includes('net::ERR_')) {
            res.status(502).json({ 
                success: false, 
                message: "Network error - Unable to reach the website", 
                error: error.message 
            });
        } else if (error.message.includes('Navigation timeout')) {
            res.status(408).json({ 
                success: false, 
                message: "Navigation timeout - Page failed to load within time limit", 
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
    const scraper = new LiciousScraper();

    if (!url) {
        return res.status(400).json({ 
            success: false, 
            message: "Please provide a URL parameter. Example: /api/licious/scrape?url=https://www.licious.in/seafood/freshwater-rohu-bengali-cut-without-head-pr_6j4jhlmxsk1" 
        });
    }

    try {
        // Fetch HTML content using Puppeteer
        console.log('Fetching HTML from URL using Puppeteer:', url);
        const htmlContent = await fetchWithPuppeteer(url);
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
        if (error.name === 'TimeoutError') {
            res.status(408).json({ 
                success: false, 
                message: "Request timeout - Page took too long to load", 
                error: error.message 
            });
        } else if (error.message.includes('net::ERR_')) {
            res.status(502).json({ 
                success: false, 
                message: "Network error - Unable to reach the website", 
                error: error.message 
            });
        } else if (error.message.includes('Navigation timeout')) {
            res.status(408).json({ 
                success: false, 
                message: "Navigation timeout - Page failed to load within time limit", 
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
        const scraper = new LiciousScraper();
        const htmlContent = await fs.readFile(path.join(__dirname, '../scrapinghtml/licious.html'), 'utf8');
        const result = await scraper.scrapeProduct(htmlContent);
        result.url = 'https://www.licious.in/seafood/freshwater-rohu-bengali-cut-without-head-pr_6j4jhlmxsk1';
        res.json({ success: true, message: "Licious scraper test successful", data: result });
    } catch (error) {
        console.error('Licious scraper test failed:', error);
        res.status(500).json({ success: false, message: "Licious scraper test failed", error: error.message });
    }
});

module.exports = router;
