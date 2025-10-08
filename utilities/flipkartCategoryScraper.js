const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class FlipkartCategoryScraper {
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
          '--disable-features=VizDisplayCompositor',
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions',
          '--disable-plugins'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set user agent to avoid detection
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });
      
      // Block unnecessary resources for faster loading (but allow images for extraction)
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        if (['stylesheet', 'font'].includes(req.resourceType())) {
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

      console.log(`Scraping Flipkart page ${pageNumber}: ${modifiedUrl}`);

      // Navigate to the category page with better error handling
      try {
        await this.page.goto(modifiedUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 20000 
        });
        
        // Wait a bit for dynamic content to load
        await this.delay(3000);
        
      } catch (error) {
        console.log('Navigation failed, trying with different wait strategy...');
        try {
          await this.page.goto(modifiedUrl, { 
            waitUntil: 'load', 
            timeout: 15000 
          });
          await this.delay(2000);
        } catch (error2) {
          throw new Error(`Failed to navigate to page: ${error2.message}`);
        }
      }

      // Wait for products to load - try multiple selectors with shorter timeouts
      let productsFound = false;
      const selectors = ['[data-id]', '.slAVV4', 'div[style*="width: 25%"]', 'img[src*="rukminim"]'];
      
      for (const selector of selectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          console.log(`Found products using selector: ${selector}`);
          productsFound = true;
          break;
        } catch (error) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }
      
      if (!productsFound) {
        console.log('No product selectors found, proceeding with content extraction...');
      }

      // Get page content
      const content = await this.page.content();
      const $ = cheerio.load(content);

      // Check if we got a valid page
      const pageTitle = $('title').text();
      console.log(`Page title: ${pageTitle}`);
      
      // Check for common error pages or blocks
      if (pageTitle.includes('Access Denied') || pageTitle.includes('Blocked') || 
          $('body').text().includes('Access Denied') || $('body').text().includes('blocked')) {
        throw new Error('Page access denied or blocked by Flipkart');
      }

      // Extract products data
      const products = this.extractProductsFromPage($, modifiedUrl);

      // Get pagination info
      const paginationInfo = this.extractPaginationInfo($);

      // If no products found, try to get some debug info
      if (products.length === 0) {
        console.log('No products found. Debug info:');
        console.log(`- Page has ${$('div').length} div elements`);
        console.log(`- Page has ${$('img').length} images`);
        console.log(`- Page has ${$('a').length} links`);
        console.log(`- Page content length: ${content.length} characters`);
      }

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

  async scrapeSpecificPages(url, pageNumbers) {
    const results = [];
    
    // Remove duplicates and sort page numbers
    const uniquePages = [...new Set(pageNumbers)].sort((a, b) => a - b);
    
    for (let i = 0; i < uniquePages.length; i++) {
      const page = uniquePages[i];
      try {
        console.log(`Scraping Flipkart page ${page} (${i + 1}/${uniquePages.length})`);
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
    
    // Find all product containers - try multiple selectors
    const productSelectors = [
      '[data-id]',
      '.slAVV4',
      'div[style*="width: 25%"]'
    ];
    
    let productElements = $();
    
    for (const selector of productSelectors) {
      productElements = $(selector);
      if (productElements.length > 0) {
        console.log(`Found ${productElements.length} products using selector: ${selector}`);
        break;
      }
    }
    
    productElements.each((index, element) => {
      const $product = $(element);
      let productId = $product.attr('data-id');
      
      // If no data-id, try to extract from other attributes or generate one
      if (!productId) {
        const href = $product.find('a').first().attr('href');
        if (href) {
          const pidMatch = href.match(/pid=([^&]+)/);
          if (pidMatch) {
            productId = pidMatch[1];
          } else {
            productId = `product_${index}`;
          }
        } else {
          productId = `product_${index}`;
        }
      }
      
      // Check if this looks like a product container
      const hasProductContent = $product.find('.slAVV4, .wjcEIp, .Nx9bqj, .DByuf4').length > 0;
      
      if (!hasProductContent) {
        return;
      }

      try {
        const productData = this.extractProductData($product, productId, pageUrl);
        if (productData && productData.productName) {
          products.push(productData);
        }
      } catch (error) {
        console.error(`Error extracting product ${productId}:`, error.message);
      }
    });

    return products;
  }

  extractProductData($product, productId, pageUrl) {
    const productData = {
      productId: productId,
      productName: '',
      brand: '',
      sellingPrice: '',
      actualPrice: '',
      discount: '',
      productImage: '',
      productUrl: '',
      rating: '',
      reviewCount: '',
      availability: '',
      isWishlisted: false,
      scrapedAt: new Date().toISOString()
    };

    // Extract product name/title
    productData.productName = this.extractText($product, [
      '.wjcEIp',
      'a[title]',
      '.slAVV4 a[title]',
      'a[href*="/p/"]',
      '.slAVV4 a'
    ]);

    // Extract brand (usually first part of product name)
    if (productData.productName) {
      const brandMatch = productData.productName.match(/^([A-Za-z\s]+)/);
      if (brandMatch) {
        productData.brand = brandMatch[1].trim();
      }
    }

    // Extract selling price
    productData.sellingPrice = this.extractPrice($product, [
      '.Nx9bqj',
      '.hl05eU .Nx9bqj',
      '.hl05eU div:first-child',
      '.hl05eU div:contains("₹")',
      'div:contains("₹")'
    ]);

    // Extract actual price (MRP)
    productData.actualPrice = this.extractPrice($product, [
      '.yRaY8j',
      '.hl05eU .yRaY8j',
      '.hl05eU div:nth-child(2)',
      '.hl05eU div:contains("₹"):not(:first-child)'
    ]);

    // Extract discount percentage
    productData.discount = this.extractDiscount($product);

    // Extract product image
    productData.productImage = this.extractImage($product, [
      '.DByuf4',
      '.slAVV4 img',
      'img[alt]',
      'img[src*="rukminim"]',
      'img[src*="flixcart"]',
      'img[src*="image"]',
      'img[loading="eager"]',
      'img[class*="image"]',
      'img[class*="product"]',
      'img'
    ]);
    
    // Debug logging for image extraction
    if (!productData.productImage) {
      const imgCount = $product.find('img').length;
      const imgSources = $product.find('img').map((i, el) => $(el).attr('src')).get();
      console.log(`No image found for product ${productId}. Found ${imgCount} images:`, imgSources);
    }

    // Extract product URL
    productData.productUrl = this.extractProductUrl($product);

    // Extract rating
    productData.rating = this.extractRating($product);

    // Extract review count
    productData.reviewCount = this.extractReviewCount($product);

    // Check if wishlisted
    productData.isWishlisted = $product.find('.N1bADF').length > 0;

    // Extract availability
    productData.availability = this.extractAvailability($product);

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

  extractDiscount($element) {
    // Look for discount percentage
    const discountText = $element.find('.UkUFwK span, .UkUFwK').text();
    const discountMatch = discountText.match(/(\d+)%\s*off/);
    if (discountMatch) {
      return discountMatch[1] + '%';
    }
    return '';
  }

  extractImage($element, selectors) {
    // Try specific selectors first
    for (const selector of selectors) {
      const $img = $element.find(selector).first();
      if ($img.length) {
        const imgSrc = this.getImageSource($img);
        if (imgSrc) {
          return imgSrc;
        }
      }
    }
    
    // Fallback: look for any img tag in the product container
    const $allImages = $element.find('img');
    for (let i = 0; i < $allImages.length; i++) {
      const $img = $allImages.eq(i);
      const imgSrc = this.getImageSource($img);
      if (imgSrc) {
        return imgSrc;
      }
    }
    
    return '';
  }

  getImageSource($img) {
    // Try multiple attributes for image source
    const possibleAttrs = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-srcset'];
    
    for (const attr of possibleAttrs) {
      const imgSrc = $img.attr(attr);
      if (imgSrc) {
        // Handle srcset (take the first URL)
        if (attr === 'data-srcset' && imgSrc.includes(',')) {
          const firstSrc = imgSrc.split(',')[0].trim().split(' ')[0];
          return this.normalizeImageUrl(firstSrc);
        }
        
        return this.normalizeImageUrl(imgSrc);
      }
    }
    
    return null;
  }

  normalizeImageUrl(imgSrc) {
    if (!imgSrc) return '';
    
    // Handle relative URLs
    if (imgSrc.startsWith('//')) {
      return 'https:' + imgSrc;
    } else if (imgSrc.startsWith('http')) {
      return imgSrc;
    } else if (imgSrc.startsWith('/')) {
      return 'https://www.flipkart.com' + imgSrc;
    }
    
    return imgSrc;
  }

  extractProductUrl($element) {
    // Try multiple anchor selectors commonly used by Flipkart for product cards
    const linkSelectors = [
      'a.CGtC98',           // observed in provided snippet
      'a[href*="/p/"]',
      'a[href*="/product/"]',
      'a[href*="/dp/"]',
      '.VJA3rP a',
      '.wjcEIp a',
      '.DMMoT0 a',
      'a'
    ];

    let href = '';
    for (const sel of linkSelectors) {
      const candidate = $element.find(sel).first().attr('href');
      if (candidate && typeof candidate === 'string' && candidate.length > 1) {
        href = candidate;
        break;
      }
    }

    if (!href) return '';

    // Normalize to absolute URL
    try {
      if (href.startsWith('http')) {
        return href;
      }
      if (href.startsWith('//')) {
        return 'https:' + href;
      }
      // handle relative paths
      return new URL(href, 'https://www.flipkart.com').href;
    } catch (_) {
      // Fallback simple concat for odd cases
      if (href.startsWith('/')) return 'https://www.flipkart.com' + href;
      return href;
    }
  }

  extractRating($element) {
    const ratingElement = $element.find('.XQDdHH');
    if (ratingElement.length) {
      const ratingText = ratingElement.text().trim();
      if (ratingText.match(/^\d+(\.\d+)?$/)) {
        return ratingText + ' out of 5 stars';
      }
    }
    return '';
  }

  extractReviewCount($element) {
    const reviewElement = $element.find('.Wphh3N');
    if (reviewElement.length) {
      const reviewText = reviewElement.text().trim();
      // Remove parentheses and extract number
      const reviewMatch = reviewText.match(/\(([\d,]+)\)/);
      if (reviewMatch) {
        return reviewMatch[1].replace(/,/g, '');
      }
    }
    return '';
  }

  extractAvailability($element) {
    // Check for availability status
    const availabilityText = $element.find('.DShtpz span, .yiggsN, .MWz963 span').text().trim();
    if (availabilityText) {
      if (availabilityText.includes('unavailable')) {
        return 'Out of Stock';
      } else if (availabilityText.includes('few left')) {
        return 'Limited Stock';
      } else if (availabilityText.includes('Not Available')) {
        return 'Not Available';
      } else {
        return 'In Stock';
      }
    }
    return 'In Stock';
  }

  extractPaginationInfo($) {
    const pagination = {
      currentPage: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    };

    // Extract current page from pagination - try multiple selectors
    const paginationSelectors = [
      '._2MImiq span:contains("Page")',
      '._2MImiq',
      'span:contains("Page")',
      'div:contains("Page")'
    ];

    for (const selector of paginationSelectors) {
      const currentPageElement = $(selector);
      if (currentPageElement.length) {
        const pageText = currentPageElement.text();
        const pageMatch = pageText.match(/Page (\d+) of (\d+)/);
        if (pageMatch) {
          pagination.currentPage = parseInt(pageMatch[1]);
          pagination.totalPages = parseInt(pageMatch[2]);
          break;
        }
      }
    }

    // Check for next/previous pages - try multiple selectors
    const nextSelectors = [
      '._1LKTO3:contains("Next")',
      'a:contains("Next")',
      'button:contains("Next")',
      'span:contains("Next")'
    ];

    const prevSelectors = [
      '._1LKTO3:contains("Previous")',
      'a:contains("Previous")',
      'button:contains("Previous")',
      'span:contains("Previous")'
    ];

    for (const selector of nextSelectors) {
      if ($(selector).length > 0) {
        pagination.hasNextPage = true;
        break;
      }
    }

    for (const selector of prevSelectors) {
      if ($(selector).length > 0) {
        pagination.hasPreviousPage = true;
        break;
      }
    }

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

module.exports = FlipkartCategoryScraper;
