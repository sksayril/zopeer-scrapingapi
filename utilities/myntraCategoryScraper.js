const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class MyntraCategoryScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1280, height: 800 });
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    } catch (error) {
      throw new Error(`Failed to initialize browser: ${error.message}`);
    }
  }

  async scrapeCategory(url) {
    if (!this.page) {
      await this.initialize();
    }

    try {
      await this.page.goto(url, { waitUntil: 'networkidle2' });
      const html = await this.page.content();
      const $ = cheerio.load(html);

      const products = [];
      // Selector will be identified from myntracategories.html
      $('.product-base').each((index, element) => {
        const productElement = $(element);
        const product = this.extractProductData(productElement);
        products.push(product);
      });

      return {
        products,
        totalProducts: products.length,
      };
    } catch (error) {
      throw new Error(`Failed to scrape category page: ${error.message}`);
    }
  }

  extractProductData(element) {
    const imageUrl = element.find('picture > img').attr('src') || element.find('img').attr('src');
    const price = element.find('.product-discountedPrice').text().trim();
    const originalPrice = element.find('.product-strike').text().trim();
    const discount = element.find('.product-discountPercentage').text().trim();
    
    const productData = {
      brand: element.find('.product-brand').text().trim(),
      productName: element.find('.product-product').text().trim(),
      price: price,
      originalPrice: originalPrice,
      discount: discount,
      productUrl: `https://www.myntra.com/${element.find('a').attr('href')}`,
      imageUrl: imageUrl
    };
    return productData;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = new MyntraCategoryScraper();
