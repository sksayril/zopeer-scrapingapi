const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class JioMartProductScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
  }

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set random user agent
      const randomUserAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
      await this.page.setUserAgent(randomUserAgent);
      
      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });
      
      // Set extra headers
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      });

      // Enable request interception to block unnecessary resources (but allow some for JioMart)
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        const resourceType = request.resourceType();
        const url = request.url();
        
        // Allow essential resources for JioMart
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType) && 
            !url.includes('jiomart.com') && 
            !url.includes('googleapis.com') && 
            !url.includes('gstatic.com')) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // Set additional headers to appear more like a real browser
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      console.log('JioMart scraper initialized successfully');
    } catch (error) {
      console.error('Error initializing JioMart scraper:', error);
      throw error;
    }
  }

  async scrapeProduct(url) {
    try {
      if (!this.page) {
        await this.initialize();
      }

      console.log(`Scraping JioMart product: ${url}`);
      
      // Navigate to the product page with better timeout handling
      try {
        await this.page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });
      } catch (error) {
        console.log('Initial navigation failed, trying with load event...');
        await this.page.goto(url, { 
          waitUntil: 'load',
          timeout: 60000 
        });
      }

      // Wait for the page to load completely
      await this.page.waitForTimeout(5000);

      // Get page content
      const content = await this.page.content();
      const $ = cheerio.load(content);

      // Extract product information
      const productData = await this.extractProductData($, url);

      return productData;
    } catch (error) {
      console.error('Error scraping JioMart product:', error);
      throw error;
    }
  }

  async extractProductData($, url) {
    try {
      const productData = {
        url: url,
        platform: 'JioMart',
        scrapedAt: new Date().toISOString(),
        productName: '',
        title: '',
        actualPrice: '',
        sellingPrice: '',
        discount: '',
        rating: '',
        reviewCount: '',
        brand: '',
        category: '',
        subCategory: '',
        productDescription: '',
        productInformation: {},
        images: [],
        availability: '',
        seller: '',
        deliveryInfo: '',
        offers: [],
        specifications: {},
        additionalInfo: {}
      };

      // Extract product name and title
      productData.productName = this.extractProductName($);
      productData.title = productData.productName; // JioMart uses same for both

      // Extract pricing information
      const pricingInfo = this.extractPricingInfo($);
      productData.actualPrice = pricingInfo.actualPrice;
      productData.sellingPrice = pricingInfo.sellingPrice;
      productData.discount = pricingInfo.discount;

      // Extract rating and reviews
      const ratingInfo = this.extractRatingInfo($);
      productData.rating = ratingInfo.rating;
      productData.reviewCount = ratingInfo.reviewCount;

      // Extract brand information
      productData.brand = this.extractBrand($);

      // Extract category information
      const categoryInfo = this.extractCategoryInfo($);
      productData.category = categoryInfo.category;
      productData.subCategory = categoryInfo.subCategory;

      // Extract product description
      productData.productDescription = this.extractProductDescription($);

      // Extract product information
      productData.productInformation = this.extractProductInformation($);

      // Extract images
      productData.images = this.extractImages($);

      // Extract availability
      productData.availability = this.extractAvailability($);

      // Extract seller information
      productData.seller = this.extractSeller($);

      // Extract delivery information
      productData.deliveryInfo = this.extractDeliveryInfo($);

      // Extract offers
      productData.offers = this.extractOffers($);

      // Extract specifications
      productData.specifications = this.extractSpecifications($);

      // Extract additional information
      productData.additionalInfo = this.extractAdditionalInfo($);

      return productData;
    } catch (error) {
      console.error('Error extracting product data:', error);
      throw error;
    }
  }

  extractProductName($) {
    try {
      // Try multiple selectors for product name
      const selectors = [
        '#pdp_product_name',
        '.product-header-name',
        '.product-title',
        'h1[data-testid="product-title"]',
        '.pdp-product-name',
        'h1'
      ];

      for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
          const name = element.text().trim();
          if (name && name.length > 0) {
            return name;
          }
        }
      }

      // Fallback: try to extract from breadcrumbs
      const breadcrumb = $('.jm-breadcrumbs-list-item-link').last();
      if (breadcrumb.length > 0) {
        return breadcrumb.text().trim();
      }

      return 'Product name not found';
    } catch (error) {
      console.error('Error extracting product name:', error);
      return 'Product name not found';
    }
  }

  extractPricingInfo($) {
    try {
      const pricingInfo = {
        actualPrice: '',
        sellingPrice: '',
        discount: ''
      };

      // Extract MRP (actual price)
      const mrpElement = $('.product-price .jm-heading-xs');
      if (mrpElement.length > 0) {
        pricingInfo.actualPrice = mrpElement.text().trim();
      }

      // Extract selling price (same as MRP for JioMart)
      pricingInfo.sellingPrice = pricingInfo.actualPrice;

      // Extract discount if available
      const discountElement = $('.product-price-offer .jm-badge-offer');
      if (discountElement.length > 0) {
        pricingInfo.discount = discountElement.text().trim();
      }

      // Alternative selectors for pricing
      if (!pricingInfo.actualPrice) {
        const priceSelectors = [
          '.price-current',
          '.product-price-current',
          '.selling-price',
          '[data-testid="price"]'
        ];

        for (const selector of priceSelectors) {
          const element = $(selector);
          if (element.length > 0) {
            const price = element.text().trim();
            if (price && price.includes('₹')) {
              pricingInfo.actualPrice = price;
              pricingInfo.sellingPrice = price;
              break;
            }
          }
        }
      }

      return pricingInfo;
    } catch (error) {
      console.error('Error extracting pricing info:', error);
      return { actualPrice: '', sellingPrice: '', discount: '' };
    }
  }

  extractRatingInfo($) {
    try {
      const ratingInfo = {
        rating: '',
        reviewCount: ''
      };

      // Extract rating
      const ratingElement = $('.product-rating-content-star-container .jm-rating-filled');
      if (ratingElement.length > 0) {
        // Count filled stars
        const filledStars = ratingElement.find('img[src*="star-filled"]').length;
        const halfStars = ratingElement.find('img[src*="half-star"]').length;
        ratingInfo.rating = (filledStars + (halfStars * 0.5)).toString();
      }

      // Extract review count
      const reviewElement = $('.review-count');
      if (reviewElement.length > 0) {
        ratingInfo.reviewCount = reviewElement.text().trim();
      }

      // Alternative selectors
      if (!ratingInfo.rating) {
        const ratingSelectors = [
          '.rating-value',
          '.product-rating',
          '[data-testid="rating"]'
        ];

        for (const selector of ratingSelectors) {
          const element = $(selector);
          if (element.length > 0) {
            const rating = element.text().trim();
            if (rating && !isNaN(parseFloat(rating))) {
              ratingInfo.rating = rating;
              break;
            }
          }
        }
      }

      return ratingInfo;
    } catch (error) {
      console.error('Error extracting rating info:', error);
      return { rating: '', reviewCount: '' };
    }
  }

  extractBrand($) {
    try {
      const brandSelectors = [
        '#top_brand_name',
        '.product-header-brand-text a',
        '.brand-name',
        '.product-brand'
      ];

      for (const selector of brandSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const brand = element.text().trim();
          if (brand && brand.length > 0) {
            return brand;
          }
        }
      }

      return 'Brand not specified';
    } catch (error) {
      console.error('Error extracting brand:', error);
      return 'Brand not specified';
    }
  }

  extractCategoryInfo($) {
    try {
      const categoryInfo = {
        category: '',
        subCategory: ''
      };

      // Extract from breadcrumbs
      const breadcrumbs = $('.jm-breadcrumbs-list-item-link');
      if (breadcrumbs.length >= 2) {
        categoryInfo.category = breadcrumbs.eq(1).text().trim();
        if (breadcrumbs.length >= 3) {
          categoryInfo.subCategory = breadcrumbs.eq(2).text().trim();
        }
      }

      // Extract from GTM data
      const gtmElement = $('.gtmEvents');
      if (gtmElement.length > 0) {
        const cate = gtmElement.attr('data-cate');
        const subcate = gtmElement.attr('data-subcate');
        if (cate) categoryInfo.category = cate;
        if (subcate) categoryInfo.subCategory = subcate;
      }

      return categoryInfo;
    } catch (error) {
      console.error('Error extracting category info:', error);
      return { category: '', subCategory: '' };
    }
  }

  extractProductDescription($) {
    try {
      const descriptionSelectors = [
        '.product-description',
        '.product-details',
        '.product-info',
        '.description-content',
        '.product-summary'
      ];

      for (const selector of descriptionSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const description = element.text().trim();
          if (description && description.length > 0) {
            return description;
          }
        }
      }

      // Try to extract from meta description
      const metaDescription = $('meta[name="description"]').attr('content');
      if (metaDescription) {
        return metaDescription;
      }

      return 'Product description not available';
    } catch (error) {
      console.error('Error extracting product description:', error);
      return 'Product description not available';
    }
  }

  extractProductInformation($) {
    try {
      const productInfo = {};

      // Extract from product details section
      const detailsSection = $('.product-details, .product-information, .product-specifications');
      if (detailsSection.length > 0) {
        detailsSection.find('li, .spec-item, .detail-item').each((index, element) => {
          const $element = $(element);
          const text = $element.text().trim();
          if (text && text.includes(':')) {
            const [key, value] = text.split(':').map(s => s.trim());
            if (key && value) {
              productInfo[key] = value;
            }
          }
        });
      }

      // Extract from GTM data attributes
      const gtmElement = $('.gtmEvents');
      if (gtmElement.length > 0) {
        const attributes = gtmElement[0].attribs;
        Object.keys(attributes).forEach(key => {
          if (key.startsWith('data-') && attributes[key]) {
            const cleanKey = key.replace('data-', '').replace(/-/g, ' ');
            productInfo[cleanKey] = attributes[key];
          }
        });
      }

      return productInfo;
    } catch (error) {
      console.error('Error extracting product information:', error);
      return {};
    }
  }

  extractImages($) {
    try {
      const images = [];

      // Extract main product images
      const imageSelectors = [
        '.product-image-carousel img',
        '.product-media img',
        '.swiper-slide-img',
        '.largeimage'
      ];

      imageSelectors.forEach(selector => {
        $(selector).each((index, element) => {
          const $element = $(element);
          const src = $element.attr('src') || $element.attr('data-src');
          if (src && src.includes('jiomart.com') && !images.includes(src)) {
            images.push(src);
          }
        });
      });

      return images;
    } catch (error) {
      console.error('Error extracting images:', error);
      return [];
    }
  }

  extractAvailability($) {
    try {
      const availabilitySelectors = [
        '.out-of-stock-label',
        '.availability-status',
        '.stock-status',
        '.product-availability'
      ];

      for (const selector of availabilitySelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const status = element.text().trim();
          if (status) {
            return status.toLowerCase().includes('out') ? 'Out of Stock' : 'In Stock';
          }
        }
      }

      // Check if add to cart button is available
      const addToCartBtn = $('.addtocartbtn, .add-to-cart');
      if (addToCartBtn.length > 0 && !addToCartBtn.prop('disabled')) {
        return 'In Stock';
      }

      return 'Availability not specified';
    } catch (error) {
      console.error('Error extracting availability:', error);
      return 'Availability not specified';
    }
  }

  extractSeller($) {
    try {
      const sellerSelectors = [
        '#smart_sold_by span',
        '.seller-name',
        '.product-seller',
        '.sold-by'
      ];

      for (const selector of sellerSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const seller = element.text().trim();
          if (seller && seller.length > 0) {
            return seller;
          }
        }
      }

      // Extract from GTM data
      const gtmElement = $('.gtmEvents');
      if (gtmElement.length > 0) {
        const seller = gtmElement.attr('data-sellername');
        if (seller) {
          return seller;
        }
      }

      return 'Seller not specified';
    } catch (error) {
      console.error('Error extracting seller:', error);
      return 'Seller not specified';
    }
  }

  extractDeliveryInfo($) {
    try {
      const deliverySelectors = [
        '#smart_delivery',
        '.delivery-info',
        '.shipping-info',
        '.delivery-time'
      ];

      for (const selector of deliverySelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const delivery = element.text().trim();
          if (delivery && delivery.length > 0) {
            return delivery;
          }
        }
      }

      return 'Delivery information not available';
    } catch (error) {
      console.error('Error extracting delivery info:', error);
      return 'Delivery information not available';
    }
  }

  extractOffers($) {
    try {
      const offers = [];

      // Extract from offers section
      const offerElements = $('.product-offers-list .offer-item, .offer-badge, .discount-badge');
      offerElements.each((index, element) => {
        const $element = $(element);
        const offer = $element.text().trim();
        if (offer && offer.length > 0) {
          offers.push(offer);
        }
      });

      return offers;
    } catch (error) {
      console.error('Error extracting offers:', error);
      return [];
    }
  }

  extractSpecifications($) {
    try {
      const specifications = {};

      // Extract from specifications section
      const specElements = $('.specifications .spec-item, .product-specs .spec-row');
      specElements.each((index, element) => {
        const $element = $(element);
        const specText = $element.text().trim();
        if (specText && specText.includes(':')) {
          const [key, value] = specText.split(':').map(s => s.trim());
          if (key && value) {
            specifications[key] = value;
          }
        }
      });

      return specifications;
    } catch (error) {
      console.error('Error extracting specifications:', error);
      return {};
    }
  }

  extractAdditionalInfo($) {
    try {
      const additionalInfo = {};

      // Extract package dimensions if available
      const packageInfo = $('script').filter(function() {
        return $(this).html().includes('package_dimension');
      });

      if (packageInfo.length > 0) {
        try {
          const scriptContent = packageInfo.html();
          const packageMatch = scriptContent.match(/package_dimension[^}]+}/);
          if (packageMatch) {
            additionalInfo.packageDimensions = packageMatch[0];
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      // Extract product code/SKU
      const gtmElement = $('.gtmEvents');
      if (gtmElement.length > 0) {
        const productId = gtmElement.attr('data-id');
        const articleId = gtmElement.attr('data-alternate');
        if (productId) additionalInfo.productId = productId;
        if (articleId) additionalInfo.articleId = articleId;
      }

      return additionalInfo;
    } catch (error) {
      console.error('Error extracting additional info:', error);
      return {};
    }
  }

  async getMoreProductData(url) {
    try {
      if (!this.page) {
        await this.initialize();
      }

      console.log(`Getting more product data for: ${url}`);

      // Navigate to the product page with better timeout handling
      try {
        await this.page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });
      } catch (error) {
        console.log('Initial navigation failed, trying with load event...');
        await this.page.goto(url, { 
          waitUntil: 'load',
          timeout: 60000 
        });
      }

      // Wait for page to load
      await this.page.waitForTimeout(5000);

      // Try to click "View More" or similar buttons to expand content
      const viewMoreSelectors = [
        '.view-more-btn',
        '.show-more',
        '.expand-content',
        '.read-more',
        '.see-more',
        '[data-testid="view-more"]'
      ];

      for (const selector of viewMoreSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            await element.click();
            await this.page.waitForTimeout(1000);
            console.log(`Clicked ${selector} to expand content`);
          }
        } catch (e) {
          // Continue if element not found or clickable
        }
      }

      // Get updated content
      const content = await this.page.content();
      const $ = cheerio.load(content);

      // Extract additional data
      const additionalData = {
        expandedDescription: this.extractExpandedDescription($),
        detailedSpecifications: this.extractDetailedSpecifications($),
        customerReviews: this.extractCustomerReviews($),
        relatedProducts: this.extractRelatedProducts($),
        faq: this.extractFAQ($)
      };

      return additionalData;
    } catch (error) {
      console.error('Error getting more product data:', error);
      throw error;
    }
  }

  extractExpandedDescription($) {
    try {
      const expandedSelectors = [
        '.expanded-description',
        '.full-description',
        '.detailed-description',
        '.product-full-details'
      ];

      for (const selector of expandedSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          return element.text().trim();
        }
      }

      return '';
    } catch (error) {
      console.error('Error extracting expanded description:', error);
      return '';
    }
  }

  extractDetailedSpecifications($) {
    try {
      const detailedSpecs = {};

      const specSelectors = [
        '.detailed-specifications',
        '.full-specs',
        '.product-details-table',
        '.specifications-table'
      ];

      specSelectors.forEach(selector => {
        $(selector).find('tr, .spec-row').each((index, element) => {
          const $element = $(element);
          const cells = $element.find('td, .spec-label, .spec-value');
          if (cells.length >= 2) {
            const key = cells.eq(0).text().trim();
            const value = cells.eq(1).text().trim();
            if (key && value) {
              detailedSpecs[key] = value;
            }
          }
        });
      });

      return detailedSpecs;
    } catch (error) {
      console.error('Error extracting detailed specifications:', error);
      return {};
    }
  }

  extractCustomerReviews($) {
    try {
      const reviews = [];

      const reviewSelectors = [
        '.customer-review',
        '.review-item',
        '.user-review',
        '.product-review'
      ];

      reviewSelectors.forEach(selector => {
        $(selector).each((index, element) => {
          const $element = $(element);
          const review = {
            rating: $element.find('.review-rating, .rating').text().trim(),
            title: $element.find('.review-title, .review-heading').text().trim(),
            content: $element.find('.review-content, .review-text').text().trim(),
            author: $element.find('.review-author, .reviewer-name').text().trim(),
            date: $element.find('.review-date, .review-time').text().trim()
          };

          if (review.content) {
            reviews.push(review);
          }
        });
      });

      return reviews;
    } catch (error) {
      console.error('Error extracting customer reviews:', error);
      return [];
    }
  }

  extractRelatedProducts($) {
    try {
      const relatedProducts = [];

      const relatedSelectors = [
        '.similar-recommended-product-card-container',
        '.related-product',
        '.recommended-product',
        '.you-may-also-like .product-card'
      ];

      relatedSelectors.forEach(selector => {
        $(selector).each((index, element) => {
          const $element = $(element);
          const product = {
            name: $element.find('.product-name, .product-title').text().trim(),
            price: $element.find('.product-price, .price').text().trim(),
            image: $element.find('img').attr('src') || $element.find('img').attr('data-src'),
            url: $element.attr('href') || $element.find('a').attr('href')
          };

          if (product.name) {
            relatedProducts.push(product);
          }
        });
      });

      return relatedProducts;
    } catch (error) {
      console.error('Error extracting related products:', error);
      return [];
    }
  }

  extractFAQ($) {
    try {
      const faqs = [];

      const faqSelectors = [
        '.faq-item',
        '.faq-question',
        '.product-faq'
      ];

      faqSelectors.forEach(selector => {
        $(selector).each((index, element) => {
          const $element = $(element);
          const faq = {
            question: $element.find('.faq-question, .question').text().trim(),
            answer: $element.find('.faq-answer, .answer').text().trim()
          };

          if (faq.question && faq.answer) {
            faqs.push(faq);
          }
        });
      });

      return faqs;
    } catch (error) {
      console.error('Error extracting FAQ:', error);
      return [];
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        console.log('JioMart scraper browser closed');
      }
    } catch (error) {
      console.error('Error closing JioMart scraper:', error);
    }
  }
}

module.exports = JioMartProductScraper;
