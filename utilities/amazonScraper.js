const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class AmazonScraper {
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

  async scrapeProduct(url) {
    try {
      if (!this.browser || !this.page) {
        await this.initialize();
      }

      // Navigate to the product page
      await this.page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });

      // Wait for key elements to load
      await this.page.waitForSelector('#productTitle', { timeout: 15000 });

      // Get page content
      const content = await this.page.content();
      const $ = cheerio.load(content);

      // Extract product data
      const productData = this.extractProductData($, url);

      // Validate extracted data
      if (!productData.productName) {
        throw new Error('Product information not found. The page might be protected or unavailable.');
      }

      return productData;

    } catch (error) {
      throw new Error(`Scraping failed: ${error.message}`);
    }
  }

  extractProductData($, url) {
    const productData = {
      productName: '',
      sellingPrice: '',
      actualPrice: '',
      offers: [],
      specifications: {},
      description: '',
      color: '',
      mainImage: '',
      additionalImages: [],
      availability: '',
      rating: '',
      reviewCount: '',
      brand: '',
      model: '',
      url: url,
      scrapedAt: new Date().toISOString()
    };

    // Product Title
    productData.productName = this.extractText($, [
      '#productTitle',
      'h1.a-size-large',
      'h1.a-size-base-plus',
      '.a-size-large.a-spacing-none'
    ]);

    // Brand and Model extraction
    if (productData.productName) {
      const brandMatch = productData.productName.match(/^([A-Za-z\s]+)/);
      if (brandMatch) {
        productData.brand = brandMatch[1].trim();
      }
    }

    // Price Information
    productData.sellingPrice = this.extractPrice($, [
      '.a-price-whole',
      '.a-price .a-offscreen',
      '#priceblock_ourprice'
    ]);

    // Actual Price (strikethrough price)
    productData.actualPrice = this.extractActualPrice($);

    // Offers and Deals
    productData.offers = this.extractOffers($);

    // Color Selection
    productData.color = this.extractText($, [
      '.a-button-selected .a-button-text',
      '.a-color-selected .a-color-name',
      '#variation_color_name .selection'
    ]);

    // Main Product Image
    productData.mainImage = this.extractImage($, [
      '#landingImage',
      '#imgBlkFront',
      '.a-dynamic-image'
    ]);

    // Additional Images
    productData.additionalImages = this.extractAdditionalImages($, productData.mainImage);

    // Product Description
    productData.description = this.extractDescription($);

    // Specifications
    productData.specifications = this.extractSpecifications($);

    // Availability
    productData.availability = this.extractText($, [
      '#availability .a-size-medium',
      '#availability .a-color-success',
      '#availability .a-color-state'
    ]);

    // Rating and Reviews
    productData.rating = this.extractRating($);
    productData.reviewCount = this.extractReviewCount($);

    return productData;
  }

  extractText($, selectors) {
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length) {
        const text = element.text().trim();
        if (text && text.length > 0) {
          return text;
        }
      }
    }
    return '';
  }

  extractPrice($, selectors) {
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length) {
        const text = element.text().trim();
        if (text) {
          // Extract numeric price - take only the first complete price
          const priceMatch = text.match(/₹?([\d,]+(?:\.\d{2})?)/);
          if (priceMatch) {
            return priceMatch[1].replace(/,/g, '');
          }
        }
      }
    }
    return '';
  }

  extractActualPrice($) {
    // Look for strikethrough or original price elements
    const actualPriceSelectors = [
      '.a-price.a-text-price .a-offscreen',
      '.a-text-strike .a-offscreen',
      '.a-price.a-text-price .a-price-whole',
      '.a-price.a-text-price .a-price-fraction',
      '.a-price.a-text-price .a-price-symbol'
    ];

    for (const selector of actualPriceSelectors) {
      const element = $(selector);
      if (element.length) {
        const text = element.text().trim();
        if (text) {
          // Extract only the first price found
          const priceMatch = text.match(/₹?([\d,]+(?:\.\d{2})?)/);
          if (priceMatch) {
            return priceMatch[1].replace(/,/g, '');
          }
        }
      }
    }

    // Alternative: look for price elements with specific classes
    const priceElements = $('.a-price.a-text-price');
    if (priceElements.length) {
      const priceText = priceElements.first().text().trim();
      const priceMatch = priceText.match(/₹?([\d,]+(?:\.\d{2})?)/);
      if (priceMatch) {
        return priceMatch[1].replace(/,/g, '');
      }
    }

    return '';
  }

  extractOffers($) {
    const offers = [];
    
    // Extract offers from various locations
    $('.a-box-group .a-box, .a-section .a-box, .a-color-secondary').each((index, element) => {
      const offerText = $(element).find('.a-text-bold, .a-size-base, .a-color-secondary').text().trim();
      if (offerText && offerText.length > 5 && !offers.includes(offerText)) {
        offers.push(offerText);
      }
    });

    // Extract deal badges
    $('.a-badge-text, .a-color-price').each((index, element) => {
      const dealText = $(element).text().trim();
      if (dealText && dealText.length > 2 && !offers.includes(dealText)) {
        offers.push(dealText);
      }
    });

    return offers;
  }

  extractImage($, selectors) {
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length) {
        const src = element.attr('src') || element.attr('data-old-hires') || element.attr('data-a-dynamic-image');
        if (src && src.startsWith('http')) {
          return src;
        }
      }
    }
    return '';
  }

  extractAdditionalImages($, mainImage) {
    const images = [];
    
    $('.a-button-thumbnail img, .a-dynamic-image, .a-thumbnail img').each((index, element) => {
      const imgSrc = $(element).attr('src') || $(element).attr('data-old-hires');
      if (imgSrc && imgSrc.startsWith('http') && imgSrc !== mainImage && !images.includes(imgSrc)) {
        images.push(imgSrc);
      }
    });

    return images.slice(0, 10); // Limit to 10 additional images
  }

  extractDescription($) {
    const descriptions = [];
    
    // Extract from product description
    $('#productDescription p, #feature-bullets ul li, .a-expander-content p').each((index, element) => {
      const text = $(element).text().trim();
      if (text && text.length > 10) {
        descriptions.push(text);
      }
    });

    return descriptions.join(' ').substring(0, 1000); // Limit description length
  }

  extractSpecifications($) {
    const specs = {};
    
    // Extract from specification tables
    $('.a-expander-content table tr, .a-expander-content .a-list-item, .a-section table tr').each((index, element) => {
      const key = $(element).find('td:first-child, .a-text-bold, .a-color-secondary').text().trim();
      const value = $(element).find('td:last-child, .a-list-item, .a-color-base').text().trim();
      
      if (key && value && key.length > 2 && value.length > 1) {
        const cleanKey = key.replace(/[^\w\s]/g, '').trim();
        if (cleanKey && !specs[cleanKey]) {
          specs[cleanKey] = value;
        }
      }
    });

    return specs;
  }

  extractRating($) {
    const ratingElement = $('.a-icon-alt, .a-icon-star .a-icon-alt');
    if (ratingElement.length) {
      const ratingText = ratingElement.text().trim();
      if (ratingText.includes('out of 5')) {
        return ratingText;
      }
    }
    return '';
  }

  extractReviewCount($) {
    const reviewElement = $('a[href*="reviews"], .a-size-base.a-link-normal');
    if (reviewElement.length) {
      const reviewText = reviewElement.text().trim();
      if (reviewText.includes('reviews') || reviewText.includes('ratings') || reviewText.includes('customer')) {
        return reviewText;
      }
    }
    return '';
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = AmazonScraper;
