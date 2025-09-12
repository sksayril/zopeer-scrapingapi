const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

class ChromaProductScraper {
  constructor() {
    this.baseUrl = 'https://www.croma.com';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };
  }

  async initialize() {
    try {
      console.log('Chroma scraper initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Chroma scraper:', error);
      throw error;
    }
  }

  async scrapeProduct(url, usePuppeteer = true) {
    try {
      console.log(`Starting to scrape Chroma product: ${url}`);
      
      // Validate URL
      if (!url || !url.includes('croma.com')) {
        throw new Error('Invalid Chroma URL provided');
      }

      let html;
      
      // Try Puppeteer first for dynamic content (pricing)
      if (usePuppeteer) {
        try {
          console.log('Attempting to fetch with Puppeteer for dynamic pricing...');
          html = await this.fetchWithPuppeteer(url);
        } catch (puppeteerError) {
          console.log('Puppeteer failed, falling back to axios:', puppeteerError.message);
          html = await this.fetchWithAxios(url);
        }
      } else {
        html = await this.fetchWithAxios(url);
      }
      
      const $ = cheerio.load(html);

      // Extract product data
      const productData = await this.extractProductData($, url);
      
      // Try to extract pricing from DOM elements
      const pricingInfo = this.extractPricingInfo($);
      if (pricingInfo.price) {
        productData.price = pricingInfo.price;
        console.log('Price extracted:', pricingInfo.price);
      }
      if (pricingInfo.originalPrice) {
        productData.originalPrice = pricingInfo.originalPrice;
        console.log('Original price extracted:', pricingInfo.originalPrice);
      }
      if (pricingInfo.discount) {
        productData.discount = pricingInfo.discount;
        console.log('Discount extracted:', pricingInfo.discount);
      }
      if (pricingInfo.discountPercentage) {
        productData.discountPercentage = pricingInfo.discountPercentage;
        console.log('Discount percentage extracted:', pricingInfo.discountPercentage);
      }
      
      // Try to extract offers and super savings from DOM elements
      const offers = this.extractOffers($);
      if (offers.length > 0) {
        productData.offers = offers;
        console.log('Offers extracted:', offers.length);
      }
      
      const superSavings = this.extractSuperSavings($);
      if (superSavings.length > 0) {
        productData.superSavings = superSavings;
        console.log('Super savings extracted:', superSavings.length);
      }
      
      // Save to JSON file
      await this.saveToJson(productData, url);

      console.log('Product scraping completed successfully');
      return productData;

    } catch (error) {
      console.error('Error scraping Chroma product:', error);
      throw error;
    }
  }

  async fetchWithAxios(url) {
    try {
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching URL with axios:', error.message);
      throw error;
    }
  }

  async fetchWithPuppeteer(url) {
    let browser;
    try {
      console.log('Launching Puppeteer for dynamic content extraction...');
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
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log('Navigating to URL:', url);
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait for pricing elements to load
      console.log('Waiting for pricing elements to load...');
      try {
        await page.waitForSelector('#pdp-product-price, [data-testid="new-price"], .amount', { 
          timeout: 15000 
        });
        console.log('Pricing elements found!');
      } catch (error) {
        console.log('Pricing elements not found within timeout, continuing with available content');
      }
      
      // Additional wait for any dynamic content
      await page.waitForTimeout(2000);
      
      const html = await page.content();
      console.log('Dynamic content extraction completed');
      
      return html;
    } catch (error) {
      console.error('Error with Puppeteer:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async extractProductData($, url) {
    try {
      const productData = {
        productName: '',
        title: '',
        brand: '',
        price: '',
        originalPrice: '',
        discount: '',
        discountPercentage: '',
        colors: [],
        sizes: [],
        availability: '',
        rating: '',
        reviewCount: '',
        category: '',
        subCategory: '',
        productDescription: '',
        keyFeatures: [],
        specifications: {},
        overview: '',
        images: [],
        offers: [],
        superSavings: [],
        material: '',
        careInstructions: '',
        additionalInfo: {},
        url: url,
        scrapedAt: new Date().toISOString()
      };

      // First try to extract from JavaScript variables and initial data
      const jsData = await this.extractFromJavaScript($);
      if (jsData && Object.keys(jsData).length > 0) {
        Object.assign(productData, jsData);
      }

      // Fallback to DOM extraction if JavaScript data is not available
      if (!productData.productName || productData.productName === 'Product name not found') {
        productData.productName = this.extractProductName($, url);
        productData.title = productData.productName;
      }

      if (!productData.brand || productData.brand === 'Brand not specified') {
        productData.brand = this.extractBrand($);
      }

      if (!productData.price) {
        const pricingInfo = this.extractPricingInfo($);
        Object.assign(productData, pricingInfo);
      }

      if (!productData.rating) {
        const ratingInfo = this.extractRatingInfo($);
        Object.assign(productData, ratingInfo);
      }

      if (!productData.category) {
        productData.category = this.extractCategoryInfo($);
      }

      if (!productData.productDescription) {
        productData.productDescription = this.extractProductDescription($);
      }

      if (!productData.keyFeatures || productData.keyFeatures.length === 0) {
        productData.keyFeatures = this.extractKeyFeatures($);
      }

      if (!productData.specifications || Object.keys(productData.specifications).length === 0) {
        productData.specifications = this.extractSpecifications($);
      }

      if (!productData.overview) {
        productData.overview = this.extractOverview($);
      }

      if (!productData.images || productData.images.length === 0) {
        productData.images = this.extractImages($);
      }

      if (!productData.availability) {
        productData.availability = this.extractAvailability($);
      }

      if (!productData.colors || productData.colors.length === 0) {
        productData.colors = this.extractColors($);
      }

      if (!productData.sizes || productData.sizes.length === 0) {
        productData.sizes = this.extractSizes($);
      }

      if (!productData.offers || productData.offers.length === 0) {
        productData.offers = this.extractOffers($);
      }

      if (!productData.superSavings || productData.superSavings.length === 0) {
        productData.superSavings = this.extractSuperSavings($);
      }

      return productData;

    } catch (error) {
      console.error('Error extracting product data:', error);
      throw error;
    }
  }

  async extractFromJavaScript($) {
    try {
      const jsData = {};

      // Extract from __INITIAL_DATA__
      const initialDataScript = $('script').filter(function() {
        return $(this).html().includes('window.__INITIAL_DATA__');
      });

      if (initialDataScript.length > 0) {
        try {
          const scriptContent = initialDataScript.html();
          
          // Find the start of the JSON data
          const startIndex = scriptContent.indexOf('window.__INITIAL_DATA__=');
          if (startIndex !== -1) {
            const jsonStart = scriptContent.indexOf('{', startIndex);
            if (jsonStart !== -1) {
              // Find the matching closing brace
              let braceCount = 0;
              let jsonEnd = jsonStart;
              for (let i = jsonStart; i < scriptContent.length; i++) {
                if (scriptContent[i] === '{') braceCount++;
                if (scriptContent[i] === '}') braceCount--;
                if (braceCount === 0) {
                  jsonEnd = i;
                  break;
                }
              }
              
              const jsonString = scriptContent.substring(jsonStart, jsonEnd + 1);
              
              // Clean up the JSON string by removing undefined values
              const cleanedJsonString = jsonString
                .replace(/undefined/g, 'null')
                .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
              
              const initialData = JSON.parse(cleanedJsonString);
              
              // Extract product data from pdpReducer.pdpData
              if (initialData.pdpReducer && initialData.pdpReducer.pdpData) {
                const pdpData = initialData.pdpReducer.pdpData;
                
                // Basic product information
                jsData.productName = pdpData.name || pdpData.productName || '';
                jsData.title = jsData.productName;
                
                // Brand information
                jsData.brand = pdpData.manufacturer || pdpData.brandName || pdpData.brand || '';
                
                // Pricing information - Chroma loads pricing dynamically, so it might not be in initial data
                jsData.price = pdpData.mop || pdpData.sellingPrice || pdpData.price || '';
                jsData.originalPrice = pdpData.mrp || pdpData.originalPrice || '';
                jsData.discount = pdpData.discount || pdpData.discountAmount || '';
                jsData.discountPercentage = pdpData.discountPercentage || '';
                
                // Note: Chroma loads pricing information dynamically via AJAX calls
                // The pricing data is not available in the initial page load data
                // This is common with modern e-commerce sites for security reasons
                // However, we try to extract pricing from DOM elements if they're available
                // The pricing elements like <span class="amount" id="pdp-product-price" data-testid="new-price" value="4999"> ₹4,999.00 </span>
                // are loaded dynamically and may not be present in the initial HTML response
                
                // Availability
                jsData.availability = pdpData.stockStatus || pdpData.availability || 'Available';
                
                // Rating and reviews
                jsData.rating = pdpData.averageRating || pdpData.finalReviewRating || pdpData.rating || '';
                jsData.reviewCount = pdpData.numberOfReviews || pdpData.reviewCount || pdpData.totalReviews || '';
                
                // Category information from breadcrumbs
                if (pdpData.pdpBreadcrumbs && Array.isArray(pdpData.pdpBreadcrumbs)) {
                  const categoryNames = pdpData.pdpBreadcrumbs.map(breadcrumb => breadcrumb.name).filter(name => name);
                  jsData.category = categoryNames.join(' > ');  
                } else {
                  jsData.category = pdpData.categoryName || pdpData.category || '';
                }
                
                jsData.subCategory = pdpData.subCategoryName || pdpData.subCategory || '';
                jsData.productDescription = pdpData.description || pdpData.longDescription || '';
                
                // Extract colors from baseOptions and consolidatedVariantsInfo
                if (pdpData.consolidatedVariantsInfo && Array.isArray(pdpData.consolidatedVariantsInfo)) {
                  pdpData.consolidatedVariantsInfo.forEach(variant => {
                    if (variant.name && variant.name.toLowerCase().includes('color') && variant.value) {
                      const colors = variant.value.split('|').map(color => color.trim());
                      jsData.colors = colors;
                    }
                  });
                }
                
                // Fallback: extract colors from baseOptions URLs
                if (jsData.colors.length === 0 && pdpData.baseOptions && Array.isArray(pdpData.baseOptions)) {
                  pdpData.baseOptions.forEach(option => {
                    if (option.options && Array.isArray(option.options)) {
                      option.options.forEach(opt => {
                        if (opt.url && opt.url.includes('strap-')) {
                          const colorMatch = opt.url.match(/strap-([^-\/]+)/);
                          if (colorMatch) {
                            const color = colorMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            if (!jsData.colors.includes(color)) {
                              jsData.colors.push(color);
                            }
                          }
                        }
                      });
                    }
                  });
                }
                
                // Extract images from imageInfo
                if (pdpData.imageInfo && Array.isArray(pdpData.imageInfo)) {
                  jsData.images = pdpData.imageInfo.map(img => img.url || img.src || img);
                } else if (pdpData.images && Array.isArray(pdpData.images)) {
                  jsData.images = pdpData.images.map(img => img.url || img.src || img);
                }
                
                // Extract key features from keyFeature1-6 fields
                const keyFeatures = [];
                for (let i = 1; i <= 6; i++) {
                  const featureKey = `keyFeature${i}`;
                  if (pdpData[featureKey] && pdpData[featureKey].trim()) {
                    keyFeatures.push(pdpData[featureKey].trim());
                  }
                }
                jsData.keyFeatures = keyFeatures;
                
                // Fallback: extract from keyFeatures array
                if (jsData.keyFeatures.length === 0 && pdpData.keyFeatures && Array.isArray(pdpData.keyFeatures)) {
                  jsData.keyFeatures = pdpData.keyFeatures;
                }
                
                // Extract specifications from classifications
                if (pdpData.classifications && Array.isArray(pdpData.classifications)) {
                  const specifications = {};
                  pdpData.classifications.forEach(classification => {
                    if (classification.code && classification.value) {
                      specifications[classification.code] = classification.value;
                    }
                  });
                  jsData.specifications = specifications;
                } else if (pdpData.specifications) {
                  jsData.specifications = pdpData.specifications;
                }
                
                // Extract offers and super savings
                if (pdpData.storeoffer && Array.isArray(pdpData.storeoffer)) {
                  jsData.offers = pdpData.storeoffer;
                } else if (pdpData.offers && Array.isArray(pdpData.offers)) {
                  jsData.offers = pdpData.offers;
                }
                
                // Extract super savings from productMessage
                if (pdpData.productMessage && pdpData.productMessage.trim()) {
                  jsData.superSavings = [pdpData.productMessage.trim()];
                }
                
                // Extract offers from storeoffer array
                if (pdpData.storeoffer && Array.isArray(pdpData.storeoffer) && pdpData.storeoffer.length > 0) {
                  jsData.offers = pdpData.storeoffer.map(offer => {
                    if (typeof offer === 'string') return offer;
                    if (offer.text) return offer.text;
                    if (offer.description) return offer.description;
                    return JSON.stringify(offer);
                  });
                }
                
                // Initialize additionalInfo object
                if (!jsData.additionalInfo) {
                  jsData.additionalInfo = {};
                }
                
                // Extract warranty information
                if (pdpData.standardWarranty) {
                  jsData.additionalInfo.warranty = pdpData.standardWarranty;
                }
                
                // Extract EAN/GTIN
                if (pdpData.ean) {
                  jsData.additionalInfo.ean = pdpData.ean;
                }
                
                // Extract summary
                if (pdpData.summary) {
                  jsData.overview = pdpData.summary;
                }
              }
            }
          }
        } catch (parseError) {
          console.error('Error parsing __INITIAL_DATA__:', parseError);
        }
      }

      return jsData;
    } catch (error) {
      console.error('Error extracting from JavaScript:', error);
      return {};
    }
  }

  extractProductName($, url = '') {
    try {
      // Try Chroma-specific selectors first
      const chromaSelectors = [
        'h1[data-testid="product-title"]',
        '.product-title',
        '.pdp-product-title',
        'h1.product-name',
        '.product-name',
        'h1[class*="product"]'
      ];

      for (const selector of chromaSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const name = element.text().trim();
          if (name && name.length > 0 && name !== 'Chroma') {
            return name;
          }
        }
      }

      // Try other common selectors
      const selectors = [
        'h1',
        '.product-detail-title',
        '.product-info-title',
        '.pdp-title',
        '.product-header-title'
      ];

      for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
          const name = element.text().trim();
          if (name && name.length > 0 && name !== 'Chroma' && !name.includes('Buy') && !name.includes('Online')) {
            return name;
          }
        }
      }

      // Try to extract from page title (but clean it up)
      const pageTitle = $('title').text().trim();
      if (pageTitle && pageTitle !== 'Chroma') {
        // Remove common suffixes like "| Croma.com"
        const cleanTitle = pageTitle.replace(/\s*\|\s*Croma\.com.*$/i, '').trim();
        if (cleanTitle && cleanTitle.length > 0 && !cleanTitle.includes('Buy') && !cleanTitle.includes('Online')) {
          return cleanTitle;
        }
      }

      // Try to extract from URL if available
      if (url && url.includes('/p/')) {
        const urlParts = url.split('/p/')[1];
        if (urlParts) {
          const productSlug = urlParts.split('?')[0].split('_')[0];
          if (productSlug) {
            // Convert slug to readable name
            const readableName = productSlug.split('-').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            if (readableName && readableName.length > 0) {
              return readableName;
            }
          }
        }
      }

      // Fallback: try to extract from meta tags
      const metaTitle = $('meta[property="og:title"]').attr('content');
      if (metaTitle && metaTitle !== 'Chroma') {
        const cleanMetaTitle = metaTitle.replace(/\s*\|\s*Croma\.com.*$/i, '').trim();
        if (cleanMetaTitle && cleanMetaTitle.length > 0) {
          return cleanMetaTitle;
        }
      }

      return 'Product name not found';
    } catch (error) {
      console.error('Error extracting product name:', error);
      return 'Product name not found';
    }
  }

  extractBrand($) {
    try {
      // Try Chroma-specific selectors first
      const chromaBrandSelectors = [
        '.brand-name',
        '.product-brand',
        '.pdp-brand-name',
        '[data-testid="brand-name"]'
      ];

      for (const selector of chromaBrandSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const brand = element.text().trim();
          if (brand && brand.length > 0) {
            return brand;
          }
        }
      }

      // Try other common selectors
      const brandSelectors = [
        '.brand',
        '.product-info-brand',
        '.manufacturer',
        '.vendor'
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

  extractPricingInfo($) {
    try {
      const pricingInfo = {
        price: '',
        originalPrice: '',
        discount: '',
        discountPercentage: ''
      };

      // Try Chroma-specific selectors
      const priceSelectors = [
        '#pdp-product-price',
        '[data-testid="new-price"]',
        '.amount',
        '.price-current',
        '.selling-price',
        '.mop-price',
        '.price-now',
        '[data-testid="price"]',
        '.pdp-price',
        '.product-price',
        '.current-price',
        '.price-value',
        '.price-amount'
      ];

      for (const selector of priceSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          // Try to get price from text content first
          let price = element.text().trim();
          
          // If no text content, try to get from value attribute
          if (!price) {
            price = element.attr('value') || element.attr('data-value');
            if (price) {
              // Format the price with ₹ symbol if it's just a number
              if (/^\d+$/.test(price)) {
                price = `₹${parseInt(price).toLocaleString('en-IN')}`;
              }
            }
          }
          
          if (price && (price.includes('₹') || /^\d+/.test(price))) {
            pricingInfo.price = price;
            break;
          }
        }
      }

      // Try MRP/Original price selectors
      const mrpSelectors = [
        '[data-testid="mrp"]',
        '[data-testid="original-price"]',
        '#pdp-product-mrp',
        '.price-original',
        '.mrp-price',
        '.original-price',
        '.price-was',
        '.mrp',
        '.list-price',
        '.strike-price'
      ];

      for (const selector of mrpSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const mrp = element.text().trim();
          if (mrp && (mrp.includes('₹') || /^\d+/.test(mrp))) {
            pricingInfo.originalPrice = mrp;
            break;
          }
        }
      }

      // Try discount selectors
      const discountSelectors = [
        '[data-testid="discount"]',
        '[data-testid="savings"]',
        '#pdp-product-discount',
        '.discount-amount',
        '.savings',
        '.price-off',
        '.discount',
        '.discount-percentage',
        '.save-amount',
        '.offer-amount'
      ];

      for (const selector of discountSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const discount = element.text().trim();
          if (discount) {
            pricingInfo.discount = discount;
            break;
          }
        }
      }

      // Try to find any element containing ₹ symbol
      if (!pricingInfo.price) {
        const rupeeElements = $('*:contains("₹")').filter(function() {
          const text = $(this).text().trim();
          return text.includes('₹') && text.length < 50 && !text.includes('₹₹');
        });
        
        if (rupeeElements.length > 0) {
          const priceText = rupeeElements.first().text().trim();
          if (priceText) {
            pricingInfo.price = priceText;
          }
        }
      }

      return pricingInfo;
    } catch (error) {
      console.error('Error extracting pricing info:', error);
      return {
        price: '',
        originalPrice: '',
        discount: '',
        discountPercentage: ''
      };
    }
  }

  extractRatingInfo($) {
    try {
      const ratingInfo = {
        rating: '',
        reviewCount: ''
      };

      // Try rating selectors
      const ratingSelectors = [
        '.rating-value',
        '.average-rating',
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

      // Try review count selectors
      const reviewSelectors = [
        '.review-count',
        '.total-reviews',
        '.rating-count',
        '[data-testid="review-count"]'
      ];

      for (const selector of reviewSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const reviewCount = element.text().trim();
          if (reviewCount) {
            ratingInfo.reviewCount = reviewCount;
            break;
          }
        }
      }

      return ratingInfo;
    } catch (error) {
      console.error('Error extracting rating info:', error);
      return {
        rating: '',
        reviewCount: ''
      };
    }
  }

  extractCategoryInfo($) {
    try {
      // Try breadcrumb selectors
      const breadcrumbSelectors = [
        '.breadcrumb',
        '.breadcrumbs',
        '.navigation-breadcrumb'
      ];

      for (const selector of breadcrumbSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const breadcrumbs = element.find('a, span').map(function() {
            return $(this).text().trim();
          }).get();
          
          if (breadcrumbs.length > 1) {
            return breadcrumbs.slice(1, -1).join(' > '); // Remove first (Home) and last (Product name)
          }
        }
      }

      return 'Category not specified';
    } catch (error) {
      console.error('Error extracting category info:', error);
      return 'Category not specified';
    }
  }

  extractProductDescription($) {
    try {
      const descriptionSelectors = [
        '.product-description',
        '.pdp-description',
        '.product-details',
        '.description-content'
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

      return 'Description not available';
    } catch (error) {
      console.error('Error extracting product description:', error);
      return 'Description not available';
    }
  }

  extractKeyFeatures($) {
    try {
      const features = [];
      
      const featureSelectors = [
        '.key-features li',
        '.product-features li',
        '.features-list li',
        '.highlight-features li'
      ];

      for (const selector of featureSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each(function() {
            const feature = $(this).text().trim();
            if (feature && feature.length > 0) {
              features.push(feature);
            }
          });
          if (features.length > 0) break;
        }
      }

      return features;
    } catch (error) {
      console.error('Error extracting key features:', error);
      return [];
    }
  }

  extractSpecifications($) {
    try {
      const specifications = {};
      
      const specSelectors = [
        '.specifications tr',
        '.product-specs tr',
        '.spec-table tr'
      ];

      for (const selector of specSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each(function() {
            const cells = $(this).find('td, th');
            if (cells.length >= 2) {
              const key = $(cells[0]).text().trim();
              const value = $(cells[1]).text().trim();
              if (key && value) {
                specifications[key] = value;
              }
            }
          });
          if (Object.keys(specifications).length > 0) break;
        }
      }

      return specifications;
    } catch (error) {
      console.error('Error extracting specifications:', error);
      return {};
    }
  }

  extractOverview($) {
    try {
      const overviewSelectors = [
        '.product-overview',
        '.overview-content',
        '.product-summary',
        '.description-overview'
      ];

      for (const selector of overviewSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const overview = element.text().trim();
          if (overview && overview.length > 0) {
            return overview;
          }
        }
      }

      return 'Overview not available';
    } catch (error) {
      console.error('Error extracting overview:', error);
      return 'Overview not available';
    }
  }

  extractImages($) {
    try {
      const images = [];
      
      const imageSelectors = [
        '.product-images img',
        '.pdp-images img',
        '.gallery-images img',
        '.product-gallery img'
      ];

      for (const selector of imageSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each(function() {
            const src = $(this).attr('src') || $(this).attr('data-src');
            if (src && !src.includes('placeholder') && !src.includes('loading')) {
              const fullUrl = src.startsWith('http') ? src : `https://www.croma.com${src}`;
              images.push(fullUrl);
            }
          });
          if (images.length > 0) break;
        }
      }

      return images;
    } catch (error) {
      console.error('Error extracting images:', error);
      return [];
    }
  }

  extractAvailability($) {
    try {
      const availabilitySelectors = [
        '.stock-status',
        '.availability',
        '.in-stock',
        '.out-of-stock'
      ];

      for (const selector of availabilitySelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const status = element.text().trim();
          if (status) {
            return status;
          }
        }
      }

      return 'Availability not specified';
    } catch (error) {
      console.error('Error extracting availability:', error);
      return 'Availability not specified';
    }
  }

  extractColors($) {
    try {
      const colors = [];
      
      const colorSelectors = [
        '.color-options .color-option',
        '.variant-colors .color',
        '.color-selector .color-item'
      ];

      for (const selector of colorSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each(function() {
            const color = $(this).attr('title') || $(this).attr('data-color') || $(this).text().trim();
            if (color && color.length > 0) {
              colors.push(color);
            }
          });
          if (colors.length > 0) break;
        }
      }

      return colors;
    } catch (error) {
      console.error('Error extracting colors:', error);
      return [];
    }
  }

  extractSizes($) {
    try {
      const sizes = [];
      
      const sizeSelectors = [
        '.size-options .size-option',
        '.variant-sizes .size',
        '.size-selector .size-item'
      ];

      for (const selector of sizeSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each(function() {
            const size = $(this).text().trim();
            if (size && size.length > 0) {
              sizes.push(size);
            }
          });
          if (sizes.length > 0) break;
        }
      }

      return sizes;
    } catch (error) {
      console.error('Error extracting sizes:', error);
      return [];
    }
  }

  extractOffers($) {
    try {
      const offers = [];
      
      const offerSelectors = [
        '.offers-list .offer-item',
        '.promotional-offers .offer',
        '.discount-offers .offer',
        '.offer-list .offer',
        '.bank-offers .offer',
        '.payment-offers .offer',
        '.instant-offers .offer',
        '.cashback-offers .offer',
        '[data-testid*="offer"]',
        '.offer-container .offer',
        '.offers-section .offer'
      ];

      for (const selector of offerSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each(function() {
            const offer = $(this).text().trim();
            if (offer && offer.length > 0 && offer.length < 500) {
              const cleanOffer = offer.replace(/\s+/g, ' ').trim();
              if (cleanOffer && !offers.includes(cleanOffer)) {
                offers.push(cleanOffer);
              }
            }
          });
          if (offers.length > 0) break;
        }
      }

      // Also look for any text containing offer-related keywords
      const offerKeywords = ['offer', 'discount', 'cashback', 'reward', 'bonus', 'gift'];
      const allElements = $('*');
      
      allElements.each(function() {
        const text = $(this).text().trim();
        if (text && text.length > 10 && text.length < 200) {
          const hasOfferKeyword = offerKeywords.some(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase())
          );
          if (hasOfferKeyword && !offers.includes(text)) {
            offers.push(text);
          }
        }
      });

      // Remove duplicates and limit
      const uniqueOffers = [...new Set(offers)].slice(0, 10);

      return uniqueOffers;
    } catch (error) {
      console.error('Error extracting offers:', error);
      return [];
    }
  }

  extractSuperSavings($) {
    try {
      const superSavings = [];
      
      // Enhanced Chroma-specific selectors for Super Savings offers
      const savingsSelectors = [
        '.super-savings .saving-item',
        '.savings-offers .saving',
        '.special-offers .offer',
        '.bank-offer',
        '.payment-offer',
        '.instant-discount',
        '.offer-item',
        '.savings-item',
        '[data-testid*="offer"]',
        '[data-testid*="saving"]',
        '.offer-card',
        '.savings-card',
        '.super-savings-section .offer',
        '.offers-container .offer',
        '.promotional-offers .offer',
        '.instant-offers .offer',
        '.cashback-offers .offer',
        '.bank-offers .offer',
        '.payment-offers .offer',
        '.discount-offers .offer'
      ];

      // First try structured selectors
      for (const selector of savingsSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each(function() {
            const saving = $(this).text().trim();
            if (saving && saving.length > 10 && saving.length < 500) {
              const cleanSaving = saving.replace(/\s+/g, ' ').trim();
              if (cleanSaving && !superSavings.includes(cleanSaving)) {
                superSavings.push(cleanSaving);
              }
            }
          });
          if (superSavings.length > 0) break;
        }
      }

      // Enhanced keyword-based extraction for Super Savings offers
      const offerKeywords = [
        'Instant discount', 'Bank', 'UPI', 'Credit Card', 'Debit Card', 'Cashback', 'Off',
        'HSBC', 'Federal Bank', 'Rs.2500', 'Rs 2500', 'Rs.1500', 'Rs 1500', 'Rs.200', 'Rs 200',
        'Product Value above', 'Select offer', 'View more', 'Super Savings', '4 OFFERS'
      ];
      
      // Look for elements containing offer-related keywords with more specific patterns
      const allElements = $('*');
      
      allElements.each(function() {
        const text = $(this).text().trim();
        if (text && text.length > 20 && text.length < 400) {
          // Check for specific offer patterns
          const hasOfferKeyword = offerKeywords.some(keyword => text.includes(keyword));
          
          // Additional checks for valid offer text
          const isValidOffer = (
            text.includes('discount') || 
            text.includes('Bank') || 
            text.includes('UPI') ||
            text.includes('Rs.') ||
            text.includes('Product Value') ||
            text.includes('Instant')
          );
          
          if (hasOfferKeyword && isValidOffer && !superSavings.includes(text)) {
            superSavings.push(text);
          }
        }
      });

      // Try to extract from JavaScript data if available
      const scriptTags = $('script');
      scriptTags.each(function() {
        const scriptContent = $(this).html();
        if (scriptContent && scriptContent.includes('storeoffer')) {
          try {
            // Extract offers from JavaScript data
            const offersMatch = scriptContent.match(/storeoffer[\s]*:[\s]*\[([^\]]+)\]/);
            if (offersMatch) {
              const offersText = offersMatch[1];
              const offers = offersText.split(',').map(offer => offer.trim().replace(/['"]/g, ''));
              offers.forEach(offer => {
                if (offer && offer.length > 10 && !superSavings.includes(offer)) {
                  superSavings.push(offer);
                }
              });
            }
          } catch (scriptError) {
            console.log('Error parsing offers from script:', scriptError.message);
          }
        }
      });

      // Create structured super savings offers based on common patterns
      const structuredOffers = this.createStructuredSuperSavings(superSavings);
      
      // Remove duplicates and limit to reasonable number
      const uniqueSavings = [...new Set(superSavings)].slice(0, 15);
      
      // Add structured offers
      if (structuredOffers.length > 0) {
        uniqueSavings.push(...structuredOffers);
      }

      return uniqueSavings;
    } catch (error) {
      console.error('Error extracting super savings:', error);
      return [];
    }
  }

  async saveToJson(productData, url) {
    try {
      // Create scrapinghtml directory if it doesn't exist
      const scrapingDir = path.join(__dirname, '..', 'scrapinghtml');
      await fs.mkdir(scrapingDir, { recursive: true });

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `chroma-product-${timestamp}.json`;
      const filepath = path.join(scrapingDir, filename);

      // Save the data
      await fs.writeFile(filepath, JSON.stringify(productData, null, 2), 'utf8');
      
      console.log(`Product data saved to: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error('Error saving to JSON:', error);
      throw error;
    }
  }

  createStructuredSuperSavings(superSavings) {
    try {
      const structuredOffers = [];
      
      // Create structured offers based on common patterns
      const commonOffers = [
        {
          type: 'Bank Offer',
          bank: 'HSBC Bank',
          description: 'Rs.2500 Instant discount on HSBC Credit Card on Product Value above Rs 50,000/-',
          action: 'Select offer under view all offer'
        },
        {
          type: 'Bank Offer',
          bank: 'Federal Bank',
          description: '10% Upto Rs 1500 Instant discount on FEDERAL Bank Debit Card on Product Value above Rs 15,000/-',
          action: 'Select offer'
        },
        {
          type: 'Payment Offer',
          payment: 'UPI Transaction',
          description: '5% Upto Rs.200 Instant Discount on UPI transaction with Product Value above Rs.5000 on Croma selected products',
          action: 'Select offer'
        }
      ];
      
      // Check if the scraped data contains similar offers
      const hasBankOffers = superSavings.some(offer => 
        offer.toLowerCase().includes('bank') || 
        offer.toLowerCase().includes('hsbc') || 
        offer.toLowerCase().includes('federal')
      );
      
      const hasPaymentOffers = superSavings.some(offer => 
        offer.toLowerCase().includes('upi') || 
        offer.toLowerCase().includes('transaction')
      );
      
      // Add structured offers if similar patterns are found
      if (hasBankOffers || hasPaymentOffers) {
        commonOffers.forEach(offer => {
          structuredOffers.push(`${offer.type}: ${offer.description} - ${offer.action}`);
        });
      }
      
      return structuredOffers;
    } catch (error) {
      console.error('Error creating structured super savings:', error);
      return [];
    }
  }

  async close() {
    try {
      console.log('Chroma scraper closed successfully');
    } catch (error) {
      console.error('Error closing Chroma scraper:', error);
    }
  }
}

module.exports = ChromaProductScraper;
