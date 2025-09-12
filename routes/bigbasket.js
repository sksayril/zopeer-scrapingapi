var express = require('express');
var router = express.Router();
const BigBasketScraper = require('../utilities/bigbasketScraper');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

// Function to fetch HTML content using Puppeteer with advanced stealth
async function fetchWithPuppeteer(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new', // Use new headless mode
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-blink-features=AutomationControlled',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images',
                '--disable-javascript',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-pings',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-field-trial-config',
                '--disable-back-forward-cache',
                '--disable-ipc-flooding-protection',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        });
        
        const page = await browser.newPage();
        
        // Advanced stealth techniques
        await page.evaluateOnNewDocument(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // Override the plugins property
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            // Override the languages property
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
            
            // Override the permissions property
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // Mock chrome runtime
            window.chrome = {
                runtime: {},
            };
            
            // Remove automation indicators
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        });
        
        // Set realistic viewport
        await page.setViewport({ 
            width: 1366, 
            height: 768,
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: true,
            isMobile: false
        });
        
        // Set realistic headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        // Try to access the page with multiple strategies
        let pageContent = '';
        let success = false;
        
        // Strategy 1: Direct navigation
        try {
            await page.goto(url, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });
            
            await page.waitForTimeout(3000);
            pageContent = await page.content();
            
            if (!pageContent.includes('Access Denied') && !pageContent.includes('blocked') && pageContent.length > 1000) {
                success = true;
            }
        } catch (error) {
            console.log('Strategy 1 failed:', error.message);
        }
        
        // Strategy 2: Visit homepage first, then navigate
        if (!success) {
            try {
                await page.goto('https://www.bigbasket.com/', { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });
                
                await page.waitForTimeout(2000);
                
                // Simulate human behavior
                await page.mouse.move(100, 100);
                await page.waitForTimeout(1000);
                
                await page.goto(url, { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });
                
                await page.waitForTimeout(3000);
                pageContent = await page.content();
                
                if (!pageContent.includes('Access Denied') && !pageContent.includes('blocked') && pageContent.length > 1000) {
                    success = true;
                }
            } catch (error) {
                console.log('Strategy 2 failed:', error.message);
            }
        }
        
        // Strategy 3: Use different user agent and headers
        if (!success) {
            try {
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                
                await page.setExtraHTTPHeaders({
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                });
                
                await page.goto(url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 30000 
                });
                
                await page.waitForTimeout(5000);
                pageContent = await page.content();
                
                if (!pageContent.includes('Access Denied') && !pageContent.includes('blocked') && pageContent.length > 1000) {
                    success = true;
                }
            } catch (error) {
                console.log('Strategy 3 failed:', error.message);
            }
        }
        
        if (!success) {
            throw new Error('All strategies failed - BigBasket anti-bot protection is too strong');
        }
        
        return pageContent;
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
    const scraper = new BigBasketScraper();

    if (!url) {
        return res.status(400).json({ success: false, message: "Please provide a URL to scrape." });
    }

    try {
        let htmlContent;
        let scrapedData;
        
        try {
            // Try to fetch HTML content using Puppeteer to bypass anti-bot protection
            console.log('Fetching HTML from URL using Puppeteer:', url);
            htmlContent = await fetchWithPuppeteer(url);
            scrapedData = await scraper.scrapeProduct(htmlContent);
            scrapedData.url = url;
        } catch (puppeteerError) {
            console.log('Puppeteer failed, trying with local HTML file as fallback:', puppeteerError.message);
            
            // Fallback: Use local HTML file for testing
            const htmlFilePath = path.join(__dirname, '../scrapinghtml', 'bigbuskate.html');
            htmlContent = await fs.readFile(htmlFilePath, 'utf8');
            scrapedData = await scraper.scrapeProduct(htmlContent);
            scrapedData.url = url;
            scrapedData.note = 'Data extracted from local HTML file due to anti-bot protection';
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `bigbasket-product-${timestamp}.json`;
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
    const scraper = new BigBasketScraper();

    if (!url) {
        return res.status(400).json({ 
            success: false, 
            message: "Please provide a URL parameter. Example: /api/bigbasket/scrape?url=https://www.bigbasket.com/pd/10000067/fresho-capsicum-green-1-kg/" 
        });
    }

    try {
        let htmlContent;
        let scrapedData;
        
        try {
            // Try to fetch HTML content using Puppeteer to bypass anti-bot protection
            console.log('Fetching HTML from URL using Puppeteer:', url);
            htmlContent = await fetchWithPuppeteer(url);
            scrapedData = await scraper.scrapeProduct(htmlContent);
            scrapedData.url = url;
        } catch (puppeteerError) {
            console.log('Puppeteer failed, trying with local HTML file as fallback:', puppeteerError.message);
            
            // Fallback: Use local HTML file for testing
            const htmlFilePath = path.join(__dirname, '../scrapinghtml', 'bigbuskate.html');
            htmlContent = await fs.readFile(htmlFilePath, 'utf8');
            scrapedData = await scraper.scrapeProduct(htmlContent);
            scrapedData.url = url;
            scrapedData.note = 'Data extracted from local HTML file due to anti-bot protection';
        }

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
        const scraper = new BigBasketScraper();
        const htmlFilePath = path.join(__dirname, '../scrapinghtml', 'bigbuskate.html');
        
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
