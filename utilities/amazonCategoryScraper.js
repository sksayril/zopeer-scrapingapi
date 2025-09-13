const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class AmazonCategoryScraper {
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
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set user agent to avoid detection
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });
      
      // Block unnecessary resources for faster loading
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

    } catch (error) {
      throw new Error(`Failed to initialize browser: ${error.message}`);
    }
  }

  async scrapeCategoryPage(url, pageNumber = 1) {
    try {
      if (!this.browser || !this.page) {
        await this.initialize();
      }

      // Modify URL to include page number
      const modifiedUrl = this.buildPageUrl(url, pageNumber);

      console.log(`Scraping page ${pageNumber}: ${modifiedUrl}`);

      // Navigate to the category page
      await this.page.goto(modifiedUrl, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });

      // Wait for products to load
      await this.page.waitForSelector('[data-asin]', { timeout: 15000 });

      // Get page content
      const content = await this.page.content();
      const $ = cheerio.load(content);

      // Extract products data
      const products = this.extractProductsFromPage($, modifiedUrl);

      // Get pagination info
      const paginationInfo = this.extractPaginationInfo($);

      return {
        page: pageNumber,
        url: modifiedUrl,
        products: products,
        pagination: paginationInfo,
        totalProducts: products.length,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Scraping failed for page ${pageNumber}: ${error.message}`);
    }
  }

  async scrapeMultiplePages(url, startPage = 1, endPage = 3) {
    const results = [];
    
    for (let page = startPage; page <= endPage; page++) {
      try {
        const pageData = await this.scrapeCategoryPage(url, page);
        results.push(pageData);
        
        // Add delay between pages to avoid rate limiting
        if (page < endPage) {
          await this.delay(2000);
        }
      } catch (error) {
        console.error(`Error scraping page ${page}:`, error.message);
        results.push({
          page: page,
          error: error.message,
          products: [],
          totalProducts: 0
        });
      }
    }

    return {
      totalPages: endPage - startPage + 1,
      successfulPages: results.filter(r => !r.error).length,
      failedPages: results.filter(r => r.error).length,
      allProducts: results.flatMap(r => r.products || []),
      pageResults: results,
      scrapedAt: new Date().toISOString()
    };
  }

  async scrapeSpecificPages(url, pageNumbers) {
    const results = [];
    
    // Remove duplicates and sort page numbers
    const uniquePages = [...new Set(pageNumbers)].sort((a, b) => a - b);
    
    for (let i = 0; i < uniquePages.length; i++) {
      const page = uniquePages[i];
      try {
        console.log(`Scraping page ${page} (${i + 1}/${uniquePages.length})`);
        const pageData = await this.scrapeCategoryPage(url, page);
        results.push(pageData);
        
        // Add delay between pages to avoid rate limiting
        if (i < uniquePages.length - 1) {
          await this.delay(2000);
        }
      } catch (error) {
        console.error(`Error scraping page ${page}:`, error.message);
        results.push({
          page: page,
          error: error.message,
          products: [],
          totalProducts: 0
        });
      }
    }

    return {
      requestedPages: pageNumbers,
      uniquePages: uniquePages,
      totalPages: uniquePages.length,
      successfulPages: results.filter(r => !r.error).length,
      failedPages: results.filter(r => r.error).length,
      allProducts: results.flatMap(r => r.products || []),
      pageResults: results,
      scrapedAt: new Date().toISOString()
    };
  }

  buildPageUrl(baseUrl, pageNumber) {
    // Remove existing page parameter if present
    const url = new URL(baseUrl);
    url.searchParams.delete('page');
    
    // Add page parameter
    url.searchParams.set('page', pageNumber.toString());
    
    return url.toString();
  }

  extractProductsFromPage($, pageUrl) {
    const products = [];
    
    // Find all product containers
    $('[data-asin]').each((index, element) => {
      const $product = $(element);
      const asin = $product.attr('data-asin');
      
      // Skip if no ASIN or if it's not a product container
      if (!asin || asin === '' || !$product.hasClass('s-result-item')) {
        return;
      }

      try {
        const productData = this.extractProductData($product, asin, pageUrl);
        if (productData && productData.productName) {
          products.push(productData);
        }
      } catch (error) {
        console.error(`Error extracting product ${asin}:`, error.message);
      }
    });

    return products;
  }

  extractProductData($product, asin, pageUrl) {
    const productData = {
      asin: asin,
      productName: '',
      brand: '',
      sellingPrice: '',
      mrp: '',
      discount: '',
      productImage: '',
      productUrl: '',
      rating: '',
      reviewCount: '',
      availability: '',
      isSponsored: false,
      isPrime: false,
      scrapedAt: new Date().toISOString()
    };

    // Extract product name/title
    productData.productName = this.extractText($product, [
      'h2 a span',
      '.a-size-base-plus a span',
      'h2 span',
      '.a-size-mini + a span',
      '.a-link-normal span'
    ]);

    // Extract brand
    productData.brand = this.extractText($product, [
      '.a-size-mini span',
      '.a-size-base-plus',
      'h2 .a-size-base-plus'
    ]);

    // Extract selling price
    productData.sellingPrice = this.extractPrice($product, [
      '.a-price-whole',
      '.a-price .a-offscreen',
      '.a-price .a-price-whole'
    ]);

    // Extract MRP (strikethrough price)
    productData.mrp = this.extractMRP($product);

    // Extract discount percentage
    productData.discount = this.extractDiscount($product);

    // Extract product image
    productData.productImage = this.extractImage($product, [
      '.s-image',
      'img[data-image-latency]',
      '.a-dynamic-image'
    ]);

    // Extract product URL
    productData.productUrl = this.extractProductUrl($product);

    // Extract rating
    productData.rating = this.extractRating($product);

    // Extract review count
    productData.reviewCount = this.extractReviewCount($product);

    // Check if sponsored
    productData.isSponsored = $product.find('.puis-sponsored-label-text, .a-color-secondary:contains("Sponsored")').length > 0;

    // Check if Prime
    productData.isPrime = $product.find('.a-icon-prime, .s-prime').length > 0;

    // Extract availability
    productData.availability = this.extractText($product, [
      '.a-color-success',
      '.a-color-state',
      '.a-color-base'
    ]);

    return productData;
  }

  extractText($element, selectors) {
    for (const selector of selectors) {
      const text = $element.find(selector).first().text().trim();
      if (text && text.length > 0) {
        return text;
      }
    }
    return '';
  }

  extractPrice($element, selectors) {
    for (const selector of selectors) {
      const priceText = $element.find(selector).first().text().trim();
      if (priceText) {
        const priceMatch = priceText.match(/₹?([\d,]+(?:\.\d{2})?)/);
        if (priceMatch) {
          return priceMatch[1].replace(/,/g, '');
        }
      }
    }
    return '';
  }

  extractMRP($element) {
    // Look for MRP or strikethrough price
    const mrpSelectors = [
      '.a-price.a-text-price .a-offscreen',
      '.a-text-strike .a-offscreen',
      '.a-price.a-text-price .a-price-whole',
      '.a-size-base.a-color-secondary:contains("M.R.P")'
    ];

    for (const selector of mrpSelectors) {
      const mrpText = $element.find(selector).first().text().trim();
      if (mrpText) {
        const mrpMatch = mrpText.match(/₹?([\d,]+(?:\.\d{2})?)/);
        if (mrpMatch) {
          return mrpMatch[1].replace(/,/g, '');
        }
      }
    }

    // Alternative: look for MRP text pattern
    const mrpText = $element.find('.a-size-base.a-color-secondary').text();
    const mrpMatch = mrpText.match(/M\.R\.P:\s*₹?([\d,]+(?:\.\d{2})?)/);
    if (mrpMatch) {
      return mrpMatch[1].replace(/,/g, '');
    }

    return '';
  }

  extractDiscount($element) {
    // Look for discount percentage
    const discountText = $element.find('.a-letter-space + span, .a-size-base:contains("% off")').text();
    const discountMatch = discountText.match(/(\d+)%\s*off/);
    if (discountMatch) {
      return discountMatch[1] + '%';
    }
    return '';
  }

  extractImage($element, selectors) {
    for (const selector of selectors) {
      const imgSrc = $element.find(selector).first().attr('src');
      if (imgSrc && imgSrc.startsWith('http')) {
        return imgSrc;
      }
    }
    return '';
  }

  extractProductUrl($element) {
    const href = $element.find('h2 a, .a-link-normal').first().attr('href');
    if (href) {
      if (href.startsWith('http')) {
        return href;
      } else if (href.startsWith('/')) {
        return 'https://www.amazon.in' + href;
      }
    }
    return '';
  }

  extractRating($element) {
    const ratingElement = $element.find('.a-icon-alt, .a-star-mini .a-icon-alt');
    if (ratingElement.length) {
      const ratingText = ratingElement.text().trim();
      if (ratingText.includes('out of 5')) {
        return ratingText;
      }
    }
    return '';
  }

  extractReviewCount($element) {
    const reviewElement = $element.find('a[href*="reviews"], .a-size-base.s-underline-text');
    if (reviewElement.length) {
      const reviewText = reviewElement.text().trim();
      if (reviewText.match(/^\d+$/)) {
        return reviewText;
      }
    }
    return '';
  }

  extractPaginationInfo($) {
    const pagination = {
      currentPage: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    };

    // Extract current page
    const currentPageElement = $('.s-pagination-item.s-pagination-selected');
    if (currentPageElement.length) {
      pagination.currentPage = parseInt(currentPageElement.text()) || 1;
    }

    // Extract total pages
    const pageElements = $('.s-pagination-item:not(.s-pagination-disabled)');
    if (pageElements.length > 0) {
      const pageNumbers = pageElements.map((i, el) => parseInt($(el).text())).get().filter(num => !isNaN(num));
      if (pageNumbers.length > 0) {
        pagination.totalPages = Math.max(...pageNumbers);
      }
    }

    // Check for next/previous pages
    pagination.hasNextPage = $('.s-pagination-next:not(.s-pagination-disabled)').length > 0;
    pagination.hasPreviousPage = $('.s-pagination-previous:not(.s-pagination-disabled)').length > 0;

    return pagination;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = AmazonCategoryScraper;
