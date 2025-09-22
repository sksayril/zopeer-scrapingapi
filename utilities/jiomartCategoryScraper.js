const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class JioMartCategoryScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  async scrapeCategory(url) {
    if (!this.browser) {
      await this.initialize();
    }

    try {
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      const products = [];
      $('li.ais-InfiniteHits-item').each((index, element) => {
        const productElement = $(element);
        const product = this.extractProductData(productElement);
        products.push(product);
      });

      return {
        products,
        totalProducts: products.length,
        scrapedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Error scraping JioMart category page: ${error.message}`);
    }
  }

  extractProductData(element) {
    const productUrl = `https://www.jiomart.com${element.find('a.plp-card-wrapper').attr('href')}`;
    const gtmEventsElement = element.find('.gtmEvents');
    const imagePath = gtmEventsElement.attr('data-image');
    let imageUrl = '';
    if (imagePath) {
        imageUrl = `https://www.jiomart.com/images/product/150x150/${imagePath}`;
    } else {
        const imageElement = element.find('img.plp-card-image');
        imageUrl = imageElement.attr('src') || imageElement.attr('data-src') || '';
    }

    const brand = gtmEventsElement.attr('data-manu');
    const productName = element.find('.plp-card-details-name').text().trim();
    const price = element.find('.plp-card-details-price .jm-heading-xxs').text().trim();
    const originalPrice = element.find('.plp-card-details-price .strike-text').text().trim();
    const discount = element.find('.plp-card-details-discount .jm-badge').text().trim();

    return {
      productUrl,
      imageUrl,
      brand: brand ? brand.trim() : '',
      productName,
      price,
      originalPrice,
      discount,
    };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = JioMartCategoryScraper;
