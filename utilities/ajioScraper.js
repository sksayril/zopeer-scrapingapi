const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class AjioProductScraper {
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

      // Enable request interception to block unnecessary resources
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        const resourceType = request.resourceType();
        const url = request.url();
        
        // Allow essential resources for Ajio
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType) && 
            !url.includes('ajio.com') && 
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
        
        // Override other bot detection properties
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        
        // Mock chrome runtime
        window.chrome = {
          runtime: {},
        };
      });

      // Set additional headers for Ajio
      await this.page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });

      console.log('Ajio scraper initialized successfully');
    } catch (error) {
      console.error('Error initializing Ajio scraper:', error);
      throw error;
    }
  }

  async scrapeProduct(url) {
    try {
      console.log(`Scraping Ajio product: ${url}`);
      
      // First try direct HTTP request to avoid access denied
      let content = '';
      try {
        content = await this.fetchWithAxios(url);
        console.log('Successfully fetched content using direct HTTP request');
      } catch (axiosError) {
        console.log('Direct HTTP request failed, trying with Puppeteer...');
        
        // Fallback to Puppeteer if direct request fails
        if (!this.page) {
          await this.initialize();
        }
        
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

        // Wait for the page to load completely and check for access denied
        await this.page.waitForTimeout(3000);
        
        // Check if we got access denied
        const pageContent = await this.page.content();
        if (pageContent.includes('Access Denied') || pageContent.includes('access denied')) {
          console.log('Access denied detected, trying alternative approach...');
          
          // Try to reload with different headers
          await this.page.setExtraHTTPHeaders({
            'Referer': 'https://www.ajio.com/',
            'Origin': 'https://www.ajio.com'
          });
          
          await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
          await this.page.waitForTimeout(5000);
        }

        // Get page content
        content = await this.page.content();
      }

      const $ = cheerio.load(content);

      // Extract product information
      const productData = await this.extractProductData($, url);

      return productData;
    } catch (error) {
      console.error('Error scraping Ajio product:', error);
      throw error;
    }
  }

  async fetchWithAxios(url) {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.ajio.com/',
        'Origin': 'https://www.ajio.com'
      };

      const response = await axios.get(url, {
        headers: headers,
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept redirects
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching with axios:', error.message);
      throw error;
    }
  }

  async extractProductData($, url) {
    try {
      const productData = {
        url: url,
        platform: 'Ajio',
        scrapedAt: new Date().toISOString(),
        productName: '',
        title: '',
        brand: '',
        price: '',
        originalPrice: '',
        discount: '',
        colors: [],
        sizes: [],
        rating: '',
        reviewCount: '',
        category: '',
        subCategory: '',
        productDescription: '',
        productDetails: {},
        images: [],
        availability: '',
        material: '',
        careInstructions: '',
        specifications: {},
        additionalInfo: {}
      };

      // First try to extract from JavaScript variables and preloaded state
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
        productData.price = pricingInfo.price;
        productData.originalPrice = pricingInfo.originalPrice;
        productData.discount = pricingInfo.discount;
      }

      if (!productData.colors || productData.colors.length === 0) {
        productData.colors = this.extractColors($);
      }

      if (!productData.sizes || productData.sizes.length === 0) {
        productData.sizes = this.extractSizes($);
      }

      if (!productData.rating) {
        const ratingInfo = this.extractRatingInfo($);
        productData.rating = ratingInfo.rating;
        productData.reviewCount = ratingInfo.reviewCount;
      }

      if (!productData.category) {
        const categoryInfo = this.extractCategoryInfo($);
        productData.category = categoryInfo.category;
        productData.subCategory = categoryInfo.subCategory;
      }

      if (!productData.productDescription || productData.productDescription === 'Product description not available') {
        productData.productDescription = this.extractProductDescription($);
      }

      if (!productData.productDetails || Object.keys(productData.productDetails).length === 0) {
        productData.productDetails = this.extractProductDetails($);
      }

      if (!productData.images || productData.images.length === 0) {
        productData.images = this.extractImages($);
      }

      if (!productData.availability || productData.availability === 'Availability not specified') {
        productData.availability = this.extractAvailability($);
      }

      if (!productData.material || productData.material === 'Material not specified') {
        productData.material = this.extractMaterial($);
      }

      if (!productData.careInstructions || productData.careInstructions === 'Care instructions not available') {
        productData.careInstructions = this.extractCareInstructions($);
      }

      if (!productData.specifications || Object.keys(productData.specifications).length === 0) {
        productData.specifications = this.extractSpecifications($);
      }

      if (!productData.additionalInfo || Object.keys(productData.additionalInfo).length === 0) {
        productData.additionalInfo = this.extractAdditionalInfo($);
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

      // Extract from __PRELOADED_STATE__
      const preloadedStateScript = $('script').filter(function() {
        return $(this).html().includes('__PRELOADED_STATE__');
      });

      if (preloadedStateScript.length > 0) {
        try {
          const scriptContent = preloadedStateScript.html();
          const stateMatch = scriptContent.match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});/s);
          if (stateMatch) {
            const preloadedState = JSON.parse(stateMatch[1]);
            
            // Extract product data from preloaded state
            if (preloadedState.product && preloadedState.product.data) {
              const product = preloadedState.product.data;
              jsData.productName = product.name || product.title || '';
              jsData.brand = product.brand || product.brandName || '';
              jsData.price = product.price || product.sellingPrice || '';
              jsData.originalPrice = product.mrp || product.originalPrice || '';
              jsData.discount = product.discount || product.discountPercentage || '';
              jsData.category = product.category || product.categoryName || '';
              jsData.subCategory = product.subCategory || product.subCategoryName || '';
              jsData.productDescription = product.description || product.longDescription || '';
              jsData.availability = product.availability || product.inStock ? 'In Stock' : 'Out of Stock';
              jsData.material = product.material || product.fabric || '';
              jsData.careInstructions = product.careInstructions || product.washingInstructions || '';
              
              // Extract colors
              if (product.variants && product.variants.colors) {
                jsData.colors = product.variants.colors.map(color => color.name || color.colorName);
              } else if (product.colors) {
                jsData.colors = product.colors.map(color => color.name || color.colorName);
              }
              
              // Extract sizes
              if (product.variants && product.variants.sizes) {
                jsData.sizes = product.variants.sizes.map(size => size.name || size.sizeName);
              } else if (product.sizes) {
                jsData.sizes = product.sizes.map(size => size.name || size.sizeName);
              }
              
              // Extract images
              if (product.images) {
                jsData.images = product.images.map(img => img.url || img.src);
              }
              
              // Extract rating
              if (product.rating) {
                jsData.rating = product.rating.toString();
              }
              
              // Extract review count
              if (product.reviewCount) {
                jsData.reviewCount = product.reviewCount.toString();
              }
            }
          }
        } catch (e) {
          console.log('Error parsing preloaded state:', e.message);
        }
      }

      // Extract from other JavaScript variables
      const scriptTags = $('script');
      scriptTags.each((index, script) => {
        const scriptContent = $(script).html();
        
        // Extract product name from various JavaScript patterns
        const namePatterns = [
          /prod-name["\s]*:["\s]*["']([^"']+)["']/i,
          /productName["\s]*:["\s]*["']([^"']+)["']/i,
          /name["\s]*:["\s]*["']([^"']+)["']/i,
          /h1\.prod-name["\s]*\.text\(\)/i
        ];
        
        namePatterns.forEach(pattern => {
          const match = scriptContent.match(pattern);
          if (match && !jsData.productName) {
            jsData.productName = match[1];
            jsData.title = match[1];
          }
        });

        // Extract brand
        const brandPatterns = [
          /brand-name["\s]*:["\s]*["']([^"']+)["']/i,
          /brandName["\s]*:["\s]*["']([^"']+)["']/i,
          /brand["\s]*:["\s]*["']([^"']+)["']/i,
          /h2\.brand-name["\s]*\.text\(\)/i
        ];
        
        brandPatterns.forEach(pattern => {
          const match = scriptContent.match(pattern);
          if (match && !jsData.brand) {
            jsData.brand = match[1];
          }
        });

        // Extract price
        const pricePatterns = [
          /prod-sp["\s]*:["\s]*["']([^"']+)["']/i,
          /price["\s]*:["\s]*["']([^"']+)["']/i,
          /sellingPrice["\s]*:["\s]*["']([^"']+)["']/i,
          /div\.prod-sp["\s]*\.text\(\)/i
        ];
        
        pricePatterns.forEach(pattern => {
          const match = scriptContent.match(pattern);
          if (match && !jsData.price) {
            jsData.price = match[1];
          }
        });

        // Extract color
        const colorPatterns = [
          /prod-color["\s]*:["\s]*["']([^"']+)["']/i,
          /color["\s]*:["\s]*["']([^"']+)["']/i,
          /colorName["\s]*:["\s]*["']([^"']+)["']/i,
          /p\.prod-color["\s]*\.text\(\)/i
        ];
        
        colorPatterns.forEach(pattern => {
          const match = scriptContent.match(pattern);
          if (match && (!jsData.colors || jsData.colors.length === 0)) {
            jsData.colors = [match[1]];
          }
        });
      });

      // Extract from JSON-LD structured data
      const jsonLdScripts = $('script[type="application/ld+json"]');
      jsonLdScripts.each((index, script) => {
        try {
          const jsonContent = $(script).html();
          const jsonData = JSON.parse(jsonContent);
          
          // Handle Product type
          if (jsonData['@type'] === 'Product' || (Array.isArray(jsonData) && jsonData.some(item => item['@type'] === 'Product'))) {
            const productData = Array.isArray(jsonData) ? jsonData.find(item => item['@type'] === 'Product') : jsonData;
            
            if (productData.name && !jsData.productName) {
              jsData.productName = productData.name;
              jsData.title = productData.name;
            }
            
            if (productData.description && !jsData.productDescription) {
              jsData.productDescription = productData.description;
            }
            
            if (productData.image && (!jsData.images || jsData.images.length === 0)) {
              const images = Array.isArray(productData.image) ? productData.image : [productData.image];
              jsData.images = images.map(img => img.url || img);
            }
            
            if (productData.brand && productData.brand.name && !jsData.brand) {
              jsData.brand = productData.brand.name;
            }
            
            if (productData.offers && productData.offers.price && !jsData.price) {
              jsData.price = `₹${productData.offers.price}`;
            }
          }
          
          // Handle ProductGroup type (common in Ajio)
          if (jsonData['@type'] === 'ProductGroup') {
            if (jsonData.name && !jsData.productName) {
              jsData.productName = jsonData.name;
              jsData.title = jsonData.name;
            }
            
            if (jsonData.brand && !jsData.brand) {
              jsData.brand = typeof jsonData.brand === 'string' ? jsonData.brand : jsonData.brand.name;
            }
            
            if (jsonData.image && (!jsData.images || jsData.images.length === 0)) {
              const images = Array.isArray(jsonData.image) ? jsonData.image : [jsonData.image];
              jsData.images = images.map(img => typeof img === 'string' ? img : img.url || img.src);
            }
            
            // Extract from hasVariant array (contains individual product variants)
            if (jsonData.hasVariant && Array.isArray(jsonData.hasVariant) && jsonData.hasVariant.length > 0) {
              const firstVariant = jsonData.hasVariant[0];
              if (firstVariant.name && !jsData.productName) {
                jsData.productName = firstVariant.name;
                jsData.title = firstVariant.name;
              }
              
              if (firstVariant.brand && !jsData.brand) {
                jsData.brand = typeof firstVariant.brand === 'string' ? firstVariant.brand : firstVariant.brand.name;
              }
              
              if (firstVariant.image && (!jsData.images || jsData.images.length === 0)) {
                const images = Array.isArray(firstVariant.image) ? firstVariant.image : [firstVariant.image];
                jsData.images = images.map(img => typeof img === 'string' ? img : img.url || img.src);
              }
              
              if (firstVariant.offers && !jsData.price) {
                const offer = Array.isArray(firstVariant.offers) ? firstVariant.offers[0] : firstVariant.offers;
                if (offer.price) {
                  jsData.price = `₹${offer.price}`;
                }
              }
            }
          }
          
          // Handle BreadcrumbList type - extract product name from the last breadcrumb item
          if (jsonData['@type'] === 'BreadcrumbList' && jsonData.itemListElement && Array.isArray(jsonData.itemListElement)) {
            const lastItem = jsonData.itemListElement[jsonData.itemListElement.length - 1];
            if (lastItem && lastItem.item && lastItem.item.name && !jsData.productName) {
              jsData.productName = lastItem.item.name;
              jsData.title = lastItem.item.name;
            }
          }
          
          // Handle array of JSON-LD objects
          if (Array.isArray(jsonData)) {
            jsonData.forEach(item => {
              // Check for Product type
              if (item['@type'] === 'Product') {
                if (item.name && !jsData.productName) {
                  jsData.productName = item.name;
                  jsData.title = item.name;
                }
                
                if (item.description && !jsData.productDescription) {
                  jsData.productDescription = item.description;
                }
                
                if (item.image && (!jsData.images || jsData.images.length === 0)) {
                  const images = Array.isArray(item.image) ? item.image : [item.image];
                  jsData.images = images.map(img => img.url || img);
                }
                
                if (item.brand && item.brand.name && !jsData.brand) {
                  jsData.brand = item.brand.name;
                }
                
                if (item.offers && item.offers.price && !jsData.price) {
                  jsData.price = `₹${item.offers.price}`;
                }
              }
              
              // Check for BreadcrumbList type
              if (item['@type'] === 'BreadcrumbList' && item.itemListElement && Array.isArray(item.itemListElement)) {
                const lastItem = item.itemListElement[item.itemListElement.length - 1];
                if (lastItem && lastItem.item && lastItem.item.name && !jsData.productName) {
                  jsData.productName = lastItem.item.name;
                  jsData.title = lastItem.item.name;
                }
              }
            });
          }
        } catch (e) {
          // Continue if JSON parsing fails
        }
      });

      // Extract from meta tags
      const metaTitle = $('meta[property="og:title"]').attr('content');
      if (metaTitle && !jsData.productName) {
        jsData.productName = metaTitle;
        jsData.title = metaTitle;
      }

      const metaDescription = $('meta[property="og:description"]').attr('content');
      if (metaDescription && !jsData.productDescription) {
        jsData.productDescription = metaDescription;
      }

      const metaImage = $('meta[property="og:image"]').attr('content');
      if (metaImage && (!jsData.images || jsData.images.length === 0)) {
        jsData.images = [metaImage];
      }

      return jsData;
    } catch (error) {
      console.error('Error extracting from JavaScript:', error);
      return {};
    }
  }

  extractProductName($, url = '') {
    try {
      // Try Ajio-specific selectors first (from the JavaScript code we found)
      const ajioSelectors = [
        'h1.prod-name',
        '.prod-name',
        'h1[class*="prod-name"]',
        '.pdp-product-name',
        '.product-name'
      ];

      for (const selector of ajioSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const name = element.text().trim();
          if (name && name.length > 0 && name !== 'Ajio') {
            return name;
          }
        }
      }

      // Try other common selectors
      const selectors = [
        '[data-testid="product-title"]',
        '.product-title',
        'h1[class*="product"]',
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
          if (name && name.length > 0 && name !== 'Ajio' && !name.includes('Buy') && !name.includes('Online')) {
            return name;
          }
        }
      }

      // Try to extract from page title (but clean it up)
      const pageTitle = $('title').text().trim();
      if (pageTitle && pageTitle !== 'Ajio') {
        // Remove common suffixes like "| Ajio.com"
        const cleanTitle = pageTitle.replace(/\s*\|\s*Ajio\.com.*$/i, '').trim();
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
      if (metaTitle && metaTitle !== 'Ajio') {
        const cleanMetaTitle = metaTitle.replace(/\s*\|\s*Ajio\.com.*$/i, '').trim();
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
      // Try Ajio-specific selectors first
      const ajioBrandSelectors = [
        'h2.brand-name',
        '.brand-name',
        'h2[class*="brand-name"]'
      ];

      for (const selector of ajioBrandSelectors) {
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
        '[data-testid="brand-name"]',
        '.product-brand',
        '.brand',
        '.pdp-brand-name',
        '.product-info-brand'
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

      // Try to extract from breadcrumbs
      const breadcrumbs = $('.breadcrumb, .breadcrumbs, [data-testid="breadcrumb"]');
      if (breadcrumbs.length > 0) {
        const brandElement = breadcrumbs.find('a').first();
        if (brandElement.length > 0) {
          return brandElement.text().trim();
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
        discount: ''
      };

      // Try Ajio-specific selectors first
      const ajioPriceSelectors = [
        'div.prod-sp',
        '.prod-sp',
        'div[class*="prod-sp"]'
      ];

      for (const selector of ajioPriceSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const priceText = element.text().trim();
          if (priceText && priceText.includes('Rs.')) {
            // Extract price from "Rs. 149" format
            const priceMatch = priceText.match(/Rs\.\s*(\d+)/);
            if (priceMatch) {
              pricingInfo.price = `₹${priceMatch[1]}`;
              break;
            }
          }
        }
      }

      // Extract current price from other selectors
      const priceSelectors = [
        '[data-testid="price"]',
        '.price',
        '.current-price',
        '.selling-price',
        '.product-price',
        '.pdp-price',
        '.price-current'
      ];

      for (const selector of priceSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const price = element.text().trim();
          if (price && (price.includes('₹') || price.includes('Rs.')) && !pricingInfo.price) {
            pricingInfo.price = price;
            break;
          }
        }
      }

      // Extract original price
      const originalPriceSelectors = [
        '[data-testid="original-price"]',
        '.original-price',
        '.mrp',
        '.strike-price',
        '.price-original',
        '.pdp-original-price'
      ];

      for (const selector of originalPriceSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const originalPrice = element.text().trim();
          if (originalPrice && (originalPrice.includes('₹') || originalPrice.includes('Rs.'))) {
            pricingInfo.originalPrice = originalPrice;
            break;
          }
        }
      }

      // Extract discount
      const discountSelectors = [
        '[data-testid="discount"]',
        '.discount',
        '.discount-percentage',
        '.offer',
        '.savings',
        '.pdp-discount'
      ];

      for (const selector of discountSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const discount = element.text().trim();
          if (discount && (discount.includes('%') || discount.includes('off'))) {
            pricingInfo.discount = discount;
            break;
          }
        }
      }

      return pricingInfo;
    } catch (error) {
      console.error('Error extracting pricing info:', error);
      return { price: '', originalPrice: '', discount: '' };
    }
  }

  extractColors($) {
    try {
      const colors = [];

      // Try Ajio-specific selectors first
      const ajioColorSelectors = [
        'p.prod-color',
        '.prod-color',
        'p[class*="prod-color"]'
      ];

      ajioColorSelectors.forEach(selector => {
        const element = $(selector);
        if (element.length > 0) {
          const colorName = element.text().trim();
          if (colorName && colorName.length > 0 && !colors.includes(colorName)) {
            colors.push(colorName);
          }
        }
      });

      // Try multiple selectors for color variants
      const colorSelectors = [
        '[data-testid="color-option"]',
        '.color-option',
        '.color-variant',
        '.product-color',
        '.color-swatch',
        '.variant-color',
        '.color-selector .option'
      ];

      colorSelectors.forEach(selector => {
        $(selector).each((index, element) => {
          const $element = $(element);
          const colorName = $element.attr('title') || 
                           $element.attr('aria-label') || 
                           $element.text().trim() ||
                           $element.find('span').text().trim();
          
          if (colorName && colorName.length > 0 && !colors.includes(colorName)) {
            colors.push(colorName);
          }
        });
      });

      // Try to extract from color swatches
      const colorSwatches = $('.color-swatch, .swatch-color');
      colorSwatches.each((index, element) => {
        const $element = $(element);
        const colorName = $element.attr('title') || 
                         $element.attr('data-color') ||
                         $element.attr('aria-label');
        
        if (colorName && colorName.length > 0 && !colors.includes(colorName)) {
          colors.push(colorName);
        }
      });

      return colors;
    } catch (error) {
      console.error('Error extracting colors:', error);
      return [];
    }
  }

  extractSizes($) {
    try {
      const sizes = [];

      // Try multiple selectors for size options
      const sizeSelectors = [
        '[data-testid="size-option"]',
        '.size-option',
        '.size-variant',
        '.product-size',
        '.size-selector .option',
        '.variant-size',
        '.size-chart .size'
      ];

      sizeSelectors.forEach(selector => {
        $(selector).each((index, element) => {
          const $element = $(element);
          const size = $element.text().trim() || 
                      $element.attr('data-size') ||
                      $element.attr('aria-label');
          
          if (size && size.length > 0 && !sizes.includes(size)) {
            sizes.push(size);
          }
        });
      });

      // Try to extract from size chart
      const sizeChart = $('.size-chart, .size-guide');
      if (sizeChart.length > 0) {
        sizeChart.find('td, .size-item').each((index, element) => {
          const $element = $(element);
          const size = $element.text().trim();
          if (size && size.length > 0 && !sizes.includes(size) && isNaN(size) === false) {
            sizes.push(size);
          }
        });
      }

      return sizes;
    } catch (error) {
      console.error('Error extracting sizes:', error);
      return [];
    }
  }

  extractRatingInfo($) {
    try {
      const ratingInfo = {
        rating: '',
        reviewCount: ''
      };

      // Extract rating
      const ratingSelectors = [
        '[data-testid="rating"]',
        '.rating',
        '.product-rating',
        '.star-rating',
        '.rating-value',
        '.pdp-rating'
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

      // Extract review count
      const reviewSelectors = [
        '[data-testid="review-count"]',
        '.review-count',
        '.reviews-count',
        '.rating-count',
        '.pdp-review-count'
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
      return { rating: '', reviewCount: '' };
    }
  }

  extractCategoryInfo($) {
    try {
      const categoryInfo = {
        category: '',
        subCategory: ''
      };

      // Extract from breadcrumbs
      const breadcrumbs = $('.breadcrumb, .breadcrumbs, [data-testid="breadcrumb"]');
      if (breadcrumbs.length > 0) {
        const breadcrumbItems = breadcrumbs.find('a, span');
        if (breadcrumbItems.length >= 2) {
          categoryInfo.category = breadcrumbItems.eq(1).text().trim();
          if (breadcrumbItems.length >= 3) {
            categoryInfo.subCategory = breadcrumbItems.eq(2).text().trim();
          }
        }
      }

      // Extract from navigation or category links
      const categorySelectors = [
        '.category-name',
        '.product-category',
        '.breadcrumb-category'
      ];

      categorySelectors.forEach(selector => {
        const element = $(selector);
        if (element.length > 0 && !categoryInfo.category) {
          categoryInfo.category = element.text().trim();
        }
      });

      return categoryInfo;
    } catch (error) {
      console.error('Error extracting category info:', error);
      return { category: '', subCategory: '' };
    }
  }

  extractProductDescription($) {
    try {
      const descriptionSelectors = [
        '[data-testid="product-description"]',
        '.product-description',
        '.product-details',
        '.description',
        '.pdp-description',
        '.product-info-description'
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

  extractProductDetails($) {
    try {
      const productDetails = {};

      // Extract from all text content that might contain product details
      const allText = $('body').text();
      
      // Look for specific patterns in the text
      const patterns = {
        'Package Contains': /Package contains[:\s]*([^.\n]+)/i,
        'Wash Care': /(Machine wash|Wash Care)[:\s]*([^.\n]+)/i,
        'Waist Rise': /Waist Rise[:\s]*([^.\n]+)/i,
        'Fabric Composition': /(Fabric Composition|100% Cotton)[:\s]*([^.\n]+)/i,
        'MRP': /MRP[:\s]*([^.\n]+)/i,
        'Marketed By': /Marketed By[:\s]*([^.\n]+)/i,
        'Net Qty': /Net Qty[:\s]*([^.\n]+)/i,
        'Imported By': /Imported By[:\s]*([^.\n]+)/i,
        'Manufactured By': /Manufactured By[:\s]*([^.\n]+)/i,
        'Country Of Origin': /Country Of Origin[:\s]*([^.\n]+)/i,
        'Customer Care Address': /Customer Care Address[:\s]*([^.\n]+)/i,
        'Commodity': /Commodity[:\s]*([^.\n]+)/i
      };

      Object.keys(patterns).forEach(key => {
        const match = allText.match(patterns[key]);
        if (match) {
          productDetails[key] = match[1] || match[2] || match[0];
        }
      });

      // Extract from product details section
      const detailsSelectors = [
        '.product-details',
        '.product-information',
        '.product-specifications',
        '.pdp-details',
        '.product-features',
        '.product-info',
        '.details-section',
        '.product-specs',
        '.specifications'
      ];

      detailsSelectors.forEach(selector => {
        $(selector).find('li, .detail-item, .spec-item, .info-item, p, div, span').each((index, element) => {
          const $element = $(element);
          const text = $element.text().trim();
          
          // Handle different formats
          if (text && text.includes(':')) {
            const [key, value] = text.split(':').map(s => s.trim());
            if (key && value && !productDetails[key]) {
              productDetails[key] = value;
            }
          } else if (text && text.length > 0) {
            // Handle simple text items
            const lowerText = text.toLowerCase();
            if (lowerText.includes('package contains') && !productDetails['Package Contains']) {
              productDetails['Package Contains'] = text;
            } else if ((lowerText.includes('wash care') || lowerText.includes('machine wash')) && !productDetails['Wash Care']) {
              productDetails['Wash Care'] = text;
            } else if (lowerText.includes('waist rise') && !productDetails['Waist Rise']) {
              productDetails['Waist Rise'] = text;
            } else if ((lowerText.includes('fabric composition') || lowerText.includes('100% cotton')) && !productDetails['Fabric Composition']) {
              productDetails['Fabric Composition'] = text;
            } else if (lowerText.includes('mrp') && text.includes('Rs.') && !productDetails['MRP']) {
              productDetails['MRP'] = text;
            } else if (lowerText.includes('marketed by') && !productDetails['Marketed By']) {
              productDetails['Marketed By'] = text;
            } else if (lowerText.includes('net qty') && !productDetails['Net Qty']) {
              productDetails['Net Qty'] = text;
            } else if (lowerText.includes('imported by') && !productDetails['Imported By']) {
              productDetails['Imported By'] = text;
            } else if (lowerText.includes('manufactured by') && !productDetails['Manufactured By']) {
              productDetails['Manufactured By'] = text;
            } else if (lowerText.includes('country of origin') && !productDetails['Country Of Origin']) {
              productDetails['Country Of Origin'] = text;
            } else if (lowerText.includes('customer care') && !productDetails['Customer Care Address']) {
              productDetails['Customer Care Address'] = text;
            } else if (lowerText.includes('commodity') && !productDetails['Commodity']) {
              productDetails['Commodity'] = text;
            }
          }
        });
      });

      // Also extract from any table or structured data
      $('table tr, .spec-table tr, .product-table tr').each((index, element) => {
        const $element = $(element);
        const cells = $element.find('td, th');
        if (cells.length >= 2) {
          const key = cells.eq(0).text().trim();
          const value = cells.eq(1).text().trim();
          if (key && value && !productDetails[key]) {
            productDetails[key] = value;
          }
        }
      });

      // Extract from any div or span that might contain product details
      $('div, span').each((index, element) => {
        const $element = $(element);
        const text = $element.text().trim();
        
        if (text && text.includes(':')) {
          const [key, value] = text.split(':').map(s => s.trim());
          if (key && value && key.length < 50 && value.length < 200 && !productDetails[key]) {
            // Only add if it looks like a product detail
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('package') || lowerKey.includes('wash') || lowerKey.includes('fabric') || 
                lowerKey.includes('mrp') || lowerKey.includes('marketed') || lowerKey.includes('imported') ||
                lowerKey.includes('manufactured') || lowerKey.includes('country') || lowerKey.includes('care') ||
                lowerKey.includes('commodity') || lowerKey.includes('waist') || lowerKey.includes('net')) {
              productDetails[key] = value;
            }
          }
        }
      });

      return productDetails;
    } catch (error) {
      console.error('Error extracting product details:', error);
      return {};
    }
  }

  extractImages($) {
    try {
      const images = [];

      // Extract main product images
      const imageSelectors = [
        '[data-testid="product-image"]',
        '.product-image img',
        '.pdp-image img',
        '.product-gallery img',
        '.image-gallery img',
        '.product-photos img'
      ];

      imageSelectors.forEach(selector => {
        $(selector).each((index, element) => {
          const $element = $(element);
          const src = $element.attr('src') || $element.attr('data-src');
          if (src && src.includes('ajio.com') && !images.includes(src)) {
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
        '[data-testid="availability"]',
        '.availability',
        '.stock-status',
        '.product-availability',
        '.in-stock',
        '.out-of-stock'
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
      const addToCartBtn = $('[data-testid="add-to-cart"], .add-to-cart, .addtocart');
      if (addToCartBtn.length > 0 && !addToCartBtn.prop('disabled')) {
        return 'In Stock';
      }

      return 'Availability not specified';
    } catch (error) {
      console.error('Error extracting availability:', error);
      return 'Availability not specified';
    }
  }

  extractMaterial($) {
    try {
      // First try to extract from product details
      const productDetails = this.extractProductDetails($);
      if (productDetails['Fabric Composition']) {
        return productDetails['Fabric Composition'];
      }

      // Try specific selectors
      const materialSelectors = [
        '[data-testid="material"]',
        '.material',
        '.fabric',
        '.product-material',
        '.composition',
        '.fabric-composition'
      ];

      for (const selector of materialSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const material = element.text().trim();
          if (material && material.length > 0) {
            return material;
          }
        }
      }

      // Try to find material information in the text
      const allText = $('body').text();
      const materialMatch = allText.match(/(100% Cotton|Fabric Composition[:\s]*([^.\n]+)|Material[:\s]*([^.\n]+))/i);
      if (materialMatch) {
        return materialMatch[1] || materialMatch[2] || materialMatch[3];
      }

      return 'Material not specified';
    } catch (error) {
      console.error('Error extracting material:', error);
      return 'Material not specified';
    }
  }

  extractCareInstructions($) {
    try {
      // First try to extract from product details
      const productDetails = this.extractProductDetails($);
      if (productDetails['Wash Care']) {
        return productDetails['Wash Care'];
      }

      // Try specific selectors
      const careSelectors = [
        '[data-testid="care-instructions"]',
        '.care-instructions',
        '.washing-instructions',
        '.care-guide',
        '.product-care',
        '.wash-care'
      ];

      for (const selector of careSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const care = element.text().trim();
          if (care && care.length > 0) {
            return care;
          }
        }
      }

      // Try to find care instructions in the text
      const allText = $('body').text();
      const careMatch = allText.match(/(Machine wash|Wash Care[:\s]*([^.\n]+)|Care Instructions[:\s]*([^.\n]+))/i);
      if (careMatch) {
        return careMatch[1] || careMatch[2] || careMatch[3];
      }

      return 'Care instructions not available';
    } catch (error) {
      console.error('Error extracting care instructions:', error);
      return 'Care instructions not available';
    }
  }

  extractSpecifications($) {
    try {
      const specifications = {};

      // Extract from specifications section
      const specSelectors = [
        '.specifications',
        '.product-specs',
        '.spec-table',
        '.product-attributes'
      ];

      specSelectors.forEach(selector => {
        $(selector).find('tr, .spec-row, .attribute-item').each((index, element) => {
          const $element = $(element);
          const cells = $element.find('td, .spec-label, .spec-value');
          if (cells.length >= 2) {
            const key = cells.eq(0).text().trim();
            const value = cells.eq(1).text().trim();
            if (key && value) {
              specifications[key] = value;
            }
          }
        });
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

      // Extract product ID/SKU
      const productIdSelectors = [
        '[data-testid="product-id"]',
        '.product-id',
        '.sku',
        '.product-code'
      ];

      productIdSelectors.forEach(selector => {
        const element = $(selector);
        if (element.length > 0) {
          const productId = element.text().trim();
          if (productId) {
            additionalInfo.productId = productId;
          }
        }
      });

      // Extract from meta tags
      const metaProductId = $('meta[property="product:id"]').attr('content');
      if (metaProductId) {
        additionalInfo.productId = metaProductId;
      }

      return additionalInfo;
    } catch (error) {
      console.error('Error extracting additional info:', error);
      return {};
    }
  }

  async getMoreProductData(url) {
    try {
      console.log(`Getting more product data for: ${url}`);

      // First try direct HTTP request
      let content = '';
      try {
        content = await this.fetchWithAxios(url);
        console.log('Successfully fetched content using direct HTTP request for more data');
      } catch (axiosError) {
        console.log('Direct HTTP request failed for more data, trying with Puppeteer...');
        
        // Fallback to Puppeteer if direct request fails
        if (!this.page) {
          await this.initialize();
        }

        // Navigate to the product page
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
          '[data-testid="view-more"]',
          '.view-more-btn',
          '.show-more',
          '.expand-content',
          '.read-more',
          '.see-more',
          '.load-more'
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
        content = await this.page.content();
      }

      const $ = cheerio.load(content);

      // Extract additional data
      const additionalData = {
        expandedDescription: this.extractExpandedDescription($),
        detailedSpecifications: this.extractDetailedSpecifications($),
        customerReviews: this.extractCustomerReviews($),
        relatedProducts: this.extractRelatedProducts($),
        sizeGuide: this.extractSizeGuide($),
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
        '.product-review',
        '[data-testid="review"]'
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
        '.related-product',
        '.recommended-product',
        '.you-may-also-like .product-card',
        '.similar-products .product-item'
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

  extractSizeGuide($) {
    try {
      const sizeGuide = {};

      const sizeGuideSelectors = [
        '.size-guide',
        '.size-chart',
        '.measurement-guide'
      ];

      sizeGuideSelectors.forEach(selector => {
        const element = $(selector);
        if (element.length > 0) {
          const table = element.find('table');
          if (table.length > 0) {
            const headers = [];
            table.find('thead th, tr:first-child td').each((index, th) => {
              headers.push($(th).text().trim());
            });

            const rows = [];
            table.find('tbody tr, tr:not(:first-child)').each((index, tr) => {
              const row = {};
              $(tr).find('td').each((cellIndex, td) => {
                if (headers[cellIndex]) {
                  row[headers[cellIndex]] = $(td).text().trim();
                }
              });
              if (Object.keys(row).length > 0) {
                rows.push(row);
              }
            });

            sizeGuide.table = { headers, rows };
          }
        }
      });

      return sizeGuide;
    } catch (error) {
      console.error('Error extracting size guide:', error);
      return {};
    }
  }

  extractFAQ($) {
    try {
      const faqs = [];

      const faqSelectors = [
        '.faq-item',
        '.faq-question',
        '.product-faq',
        '[data-testid="faq"]'
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
        console.log('Ajio scraper browser closed');
      }
    } catch (error) {
      console.error('Error closing Ajio scraper:', error);
    }
  }
}

module.exports = AjioProductScraper;
