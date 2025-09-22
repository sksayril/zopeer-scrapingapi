const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class TataCliqCategoryScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });

      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await this.page.setViewport({ width: 1920, height: 1080 });
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw new Error(`Failed to initialize browser: ${error.message}`);
    }
  }

  async scrapeCategory(url) {
    if (!this.browser) {
      await this.initialize();
    }

    try {
      console.log(`Navigating to ${url}...`);
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log('Navigation complete.');
      
      try {
        console.log('Waiting for product selector...');
        await this.page.waitForSelector('div.ProductModule__base', { timeout: 30000 });
        console.log('Product selector found.');
      } catch (error) {
        console.log('Could not find product selector. Scraping will likely fail.');
      }
      
      const bodyHTML = await this.page.evaluate(() => document.body.innerHTML);
      console.log('--- BODY HTML START ---');
      console.log(bodyHTML);
      console.log('--- BODY HTML END ---');

      const $ = cheerio.load(bodyHTML);

      const products = [];
      $('.PlpComponent-product-card-container').each((i, el) => {
        const productElement = $(el);
        const product = this.extractProductData(productElement);
        if (product.productName && product.productUrl) {
          products.push(product);
        }
      });
      
      return {
        products,
        totalProducts: products.length,
        scrapedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error(`Error scraping category page ${url}:`, error);
      return {
          products: [],
          totalProducts: 0,
          error: error.message
      };
    }
  }

  extractProductData(productElement) {
    const productName = productElement.find('.ProductDescription__name').text().trim();
    const sellingPrice = this.formatPrice(productElement.find('.ProductDescription__price-value').text().trim());
    const actualPrice = this.formatPrice(productElement.find('.ProductDescription__mrp').text().trim());
    const rating = productElement.find('.ProductModule__rating-stars').attr('aria-label');
    let productUrl = productElement.find('a').attr('href');
    if (productUrl && !productUrl.startsWith('http')) {
        productUrl = 'https://www.tatacliq.com' + productUrl;
    }


    return {
      productName,
      sellingPrice,
      actualPrice,
      rating: rating ? rating.trim() : '',
      productUrl,
    };
  }
  
  formatPrice(price) {
      if (!price) return '';
      return price.replace(/₹/g, '').replace(/,/g, '').trim();
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new TataCliqCategoryScraper();
