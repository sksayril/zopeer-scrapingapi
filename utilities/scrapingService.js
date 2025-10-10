const ScrapingOperation = require('../models/scrapingOperation.model');
const ScrapeLog = require('../models/scrapeLog.model');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

class ScrapingService {
    constructor() {
        this.scrapers = new Map();
        this.loadScrapers();
    }

    loadScrapers() {
        // Preload scrapers for known modules when available; tolerate missing ones
        const preload = [
            ['amazon', 'amazonScraper'],
            ['flipkart', 'flipkartScraper'],
            ['tatacliq', 'tatacliqScraper'],
            ['myntra', 'myntraScraper'],
            ['jiomart', 'jiomartScraper'],
            ['ajio', 'ajioScraper'],
            ['chroma', 'chromaScraper'],
            ['vijaysales', 'vijaysalesScraper'],
            ['nykaa', 'nykaaScraper'],
            ['1mg', 'oneMgScraper'],
            ['pharmeasy', 'pharmeasyScraper'],
            ['netmeds', 'netmedsScraper'],
            ['blinkit', 'blinkitScraper'],
            ['swiggy-instamart', 'swiggyInstamartScraper'],
            ['zepto', 'zeptoScraper'],
            ['bigbasket', 'bigbasketScraper'],
            ['pepperfry', 'pepperfryScraper'],
            ['homecentre', 'homecentreScraper'],
            ['shoppersstop', 'shoppersstopScraper'],
            ['urbanic', 'urbanicScraper'],
            ['ikea', 'ikeaScraper'],
            ['biba', 'bibaScraper'],
            ['lifestylestores', 'lifestylestoresScraper'],
            ['medplusmart', 'medplusmartScraper'],
            ['truemeds', 'truemedsScraper'],
            ['apollopharmacy', 'apollopharmacyScraper'],
            ['wellnessforever', 'wellnessforeverScraper'],
            ['dmart', 'dmartScraper'],
            ['licious', 'liciousScraper']
        ];

        preload.forEach(([seller, moduleName]) => {
            try {
                const mod = require(`./${moduleName}`);
                this.scrapers.set(seller, mod);
            } catch (error) {
                console.warn(`Could not preload scraper: ${moduleName}`, error.message);
            }
        });
    }

    // Resolve a scraper module for a given seller at runtime (with fallbacks)
    getScraperModuleForSeller(seller) {
        if (this.scrapers.has(seller)) return this.scrapers.get(seller);

        const specialMap = {
            '1mg': 'oneMgScraper',
            'swiggy-instamart': 'swiggyInstamartScraper'
        };

        const candidates = [];
        if (specialMap[seller]) candidates.push(specialMap[seller]);

        // Try direct pattern: seller name without hyphens + 'Scraper'
        const normalized = seller.replace(/[-_]/g, '');
        candidates.push(`${normalized}Scraper`);
        // Try camelCase pattern for common cases
        const camel = seller.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
        candidates.push(`${camel}Scraper`);

        for (const name of candidates) {
            try {
                const mod = require(`./${name}`);
                this.scrapers.set(seller, mod);
                return mod;
            } catch (_) {
                // continue trying other candidates
            }
        }
        return undefined;
    }

    // Helper method to update scrape log
    async updateScrapeLog(operation, status, action = 'System') {
        try {
            const scrapeLog = await ScrapeLog.findOne({ operationId: operation._id });
            if (scrapeLog) {
                scrapeLog.status = status;
                scrapeLog.action = action;
                scrapeLog.when = new Date();
                await scrapeLog.save();
            }
        } catch (error) {
            console.error('Error updating scrape log:', error);
            // Don't throw error to avoid breaking the main operation
        }
    }

    async createOperation(url, seller, type = 'product', options = {}) {
        try {
            if (!ScrapingOperation) {
                throw new Error('ScrapingOperation model not properly loaded');
            }

            const operation = new ScrapingOperation({
                url,
                seller,
                type,
                category: options.category,
                config: {
                    usePuppeteer: options.usePuppeteer !== false,
                    timeout: options.timeout || 30000,
                    waitTime: options.waitTime || 3000
                },
                notes: options.notes,
                tags: options.tags || []
            });

            await operation.save();
            return operation;
        } catch (error) {
            console.error('Error creating scraping operation:', error);
            throw error;
        }
    }

    async executeOperation(operationId) {
        let operation;
        try {
            if (!ScrapingOperation || typeof ScrapingOperation.findById !== 'function') {
                throw new Error('ScrapingOperation model not properly loaded');
            }

            operation = await ScrapingOperation.findById(operationId);
            
            if (!operation) {
                throw new Error('Operation not found');
            }

            // Mark as started
            await operation.markAsStarted();
            
            // Update scrape log to in_progress
            await this.updateScrapeLog(operation, 'in_progress', 'System');

            // Get the appropriate scraper
            let ScraperModule = this.scrapers.get(operation.seller) || this.getScraperModuleForSeller(operation.seller);
            if (!ScraperModule) {
                throw new Error(`No scraper found for seller: ${operation.seller}`);
            }

            // Support classes, functions, or plain objects exporting scrapeProduct
            let scraper;
            if (typeof ScraperModule === 'function') {
                scraper = new ScraperModule();
            } else if (ScraperModule && typeof ScraperModule.scrapeProduct === 'function') {
                scraper = ScraperModule; // already an instance-like object
            } else if (ScraperModule && typeof ScraperModule.default === 'function') {
                scraper = new ScraperModule.default();
            } else if (ScraperModule && ScraperModule.default && typeof ScraperModule.default.scrapeProduct === 'function') {
                scraper = ScraperModule.default;
            } else {
                throw new Error(`Scraper module for ${operation.seller} is not constructible`);
            }
            let scrapedData;
            let totalProducts = 0;

            if (operation.type === 'product') {
                // Scrape single product
                const htmlContent = await this.fetchWithPuppeteer(operation.url, operation.config);
                scrapedData = await scraper.scrapeProduct(htmlContent);
                scrapedData.url = operation.url;
                totalProducts = 1;
            } else if (operation.type === 'category') {
                // Scrape category (multiple products)
                scrapedData = await this.scrapeCategory(operation.url, scraper, operation.config);
                totalProducts = Array.isArray(scrapedData.products) ? scrapedData.products.length : 0;
            }

            // Save data to file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${operation.seller}-${operation.type}-${timestamp}.json`;
            const filePath = path.join(__dirname, '../scraped_data', filename);
            
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(scrapedData, null, 2));

            // Mark as completed
            await operation.markAsCompleted(scrapedData, totalProducts);
            operation.dataFile = filePath;
            await operation.save();
            
            // Update scrape log to success
            await this.updateScrapeLog(operation, 'success', 'System');

            return {
                operation,
                scrapedData,
                totalProducts
            };
        } catch (error) {
            console.error('Error executing operation:', error);
            if (operation && typeof operation.markAsFailed === 'function') {
                await operation.markAsFailed(error.message, {
                    stack: error.stack,
                    name: error.name
                });
                
                // Update scrape log to failed
                await this.updateScrapeLog(operation, 'failed', 'System');
            }
            throw error;
        }
    }

    async fetchWithPuppeteer(url, config = {}) {
        const {
            usePuppeteer = true,
            timeout = 30000,
            waitTime = 3000
        } = config;

        if (!usePuppeteer) {
            // Fallback to axios or other HTTP client
            const axios = require('axios');
            const response = await axios.get(url, {
                timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            return response.data;
        }

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
            
            // Set user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Set viewport
            await page.setViewport({ width: 1366, height: 768 });
            
            // Navigate to the URL
            await page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout 
            });
            
            // Wait for additional time
            await page.waitForTimeout(waitTime);
            
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

    async scrapeCategory(url, scraper, config) {
        // This is a simplified category scraping implementation
        // In a real scenario, you would implement category-specific logic
        const htmlContent = await this.fetchWithPuppeteer(url, config);
        
        // For now, we'll assume the scraper has a scrapeCategory method
        if (typeof scraper.scrapeCategory === 'function') {
            return await scraper.scrapeCategory(htmlContent);
        } else {
            // Fallback: try to extract product links and scrape them individually
            const cheerio = require('cheerio');
            const $ = cheerio.load(htmlContent);
            const productLinks = [];
            
            // Common selectors for product links
            const linkSelectors = [
                'a[href*="/product/"]',
                'a[href*="/p/"]',
                'a[href*="/dp/"]',
                '.product-link',
                '.product-item a'
            ];
            
            linkSelectors.forEach(selector => {
                $(selector).each((i, el) => {
                    const href = $(el).attr('href');
                    if (href && !productLinks.includes(href)) {
                        productLinks.push(href);
                    }
                });
            });
            
            // Limit to first 10 products for demo
            const limitedLinks = productLinks.slice(0, 10);
            const products = [];
            
            for (const link of limitedLinks) {
                try {
                    const fullUrl = link.startsWith('http') ? link : new URL(link, url).href;
                    const productHtml = await this.fetchWithPuppeteer(fullUrl, config);
                    const productData = await scraper.scrapeProduct(productHtml);
                    productData.url = fullUrl;
                    products.push(productData);
                } catch (error) {
                    console.error(`Error scraping product ${link}:`, error.message);
                }
            }
            
            return {
                categoryUrl: url,
                scrapedAt: new Date().toISOString(),
                totalProducts: products.length,
                products
            };
        }
    }

    async getPendingOperations() {
        try {
            if (!ScrapingOperation || typeof ScrapingOperation.find !== 'function') {
                console.error('ScrapingOperation model not properly loaded');
                return [];
            }
            return await ScrapingOperation.find({
                status: 'pending'
            }).sort({ attemptTime: 1 });
        } catch (error) {
            console.error('Error getting pending operations:', error);
            return [];
        }
    }

    async getOperationStats() {
        try {
            if (!ScrapingOperation || typeof ScrapingOperation.getStats !== 'function') {
                console.error('ScrapingOperation model not properly loaded');
                return [];
            }
            return await ScrapingOperation.getStats();
        } catch (error) {
            console.error('Error getting operation stats:', error);
            return [];
        }
    }

    async getSellerStats() {
        try {
            if (!ScrapingOperation || typeof ScrapingOperation.getSellerStats !== 'function') {
                console.error('ScrapingOperation model not properly loaded');
                return [];
            }
            return await ScrapingOperation.getSellerStats();
        } catch (error) {
            console.error('Error getting seller stats:', error);
            return [];
        }
    }

    async retryFailedOperations() {
        try {
            if (!ScrapingOperation || typeof ScrapingOperation.find !== 'function') {
                console.error('ScrapingOperation model not properly loaded');
                return [];
            }

            const failedOperations = await ScrapingOperation.find({
                status: 'failed',
                retryCount: { $lt: 3 } // Max 3 retries
            });

            const retryPromises = failedOperations.map(async (operation) => {
                try {
                    await operation.incrementRetry();
                    return await this.executeOperation(operation._id);
                } catch (error) {
                    console.error(`Retry failed for operation ${operation._id}:`, error);
                    return null;
                }
            });

            const results = await Promise.allSettled(retryPromises);
            return results.filter(result => result.status === 'fulfilled' && result.value !== null);
        } catch (error) {
            console.error('Error retrying failed operations:', error);
            return [];
        }
    }

    async cleanupOldOperations(daysOld = 30) {
        try {
            if (!ScrapingOperation || typeof ScrapingOperation.find !== 'function') {
                console.error('ScrapingOperation model not properly loaded');
                return [];
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const oldOperations = await ScrapingOperation.find({
                createdAt: { $lt: cutoffDate },
                status: { $in: ['success', 'failed'] }
            });

            const deletePromises = oldOperations.map(async (operation) => {
                try {
                    // Delete associated data file
                    if (operation.dataFile) {
                        await fs.unlink(operation.dataFile).catch(() => {});
                    }
                    
                    // Delete operation record
                    await ScrapingOperation.findByIdAndDelete(operation._id);
                    return operation._id;
                } catch (error) {
                    console.error(`Error cleaning up operation ${operation._id}:`, error);
                    return null;
                }
            });

            const deletedIds = await Promise.all(deletePromises);
            return deletedIds.filter(id => id !== null);
        } catch (error) {
            console.error('Error cleaning up old operations:', error);
            return [];
        }
    }
}

module.exports = ScrapingService;
