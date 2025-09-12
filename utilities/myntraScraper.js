const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class MyntraProductScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
          '--disable-renderer-backgrounding'
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
        'Pragma': 'no-cache'
      });

      console.log('✅ Myntra Product Scraper Browser initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Myntra product scraper browser:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Myntra Product Scraper Browser closed');
    }
  }

  async scrapeProduct(url) {
    try {
      if (!this.browser) {
        await this.initialize();
      }

      console.log(`🌐 Navigating to Myntra product: ${url}`);
      
      // Navigate to the product page
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for product content to load
      await this.page.waitForSelector('h1', { timeout: 10000 });

      // Wait for images and content to load
      await this.page.waitForTimeout(3000);

      // Scroll to load all content
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await this.page.waitForTimeout(2000);

      // Get the page content
      const content = await this.page.content();
      const $ = cheerio.load(content);

      // Extract product information
      const product = this.extractProductInfo($, url);

      console.log(`📦 Myntra product scraped successfully: ${product.title}`);
      return product;

    } catch (error) {
      console.error('❌ Error scraping Myntra product:', error);
      throw error;
    }
  }

  extractProductInfo($, url) {
    try {
      // Extract product title from script data
      let title = 'Product Title Not Found';
      let brand = 'Brand Not Found';
      let currentPrice = 'Price Not Found';
      let originalPrice = '';
      let discount = '';
      let images = [];
      let rating = 'Rating Not Available';
      let reviews = '';
      let specifications = {};
      let sizes = [];
      let description = '';
      let bestOffers = [];
      let deliveryInfo = '';
      let returnPolicy = '';
      let category = '';

      // Try to extract from script data first (most reliable)
      $('script').each((i, el) => {
        const scriptContent = $(el).html();
        if (scriptContent && scriptContent.includes('window.__myx')) {
          try {
            const scriptText = scriptContent.trim();
            const startIndex = scriptText.indexOf('window.__myx = {');
            if (startIndex !== -1) {
              const jsonStart = scriptText.indexOf('{', startIndex);
              const jsonEnd = scriptText.lastIndexOf('}') + 1;
              const jsonStr = scriptText.substring(jsonStart, jsonEnd);
              const data = JSON.parse(jsonStr);
              
              if (data.pdpData) {
                const pdpData = data.pdpData;
                
                // Extract title
                if (pdpData.name) {
                  title = pdpData.name;
                }
                
                // Extract brand
                if (pdpData.brand && pdpData.brand.name) {
                  brand = pdpData.brand.name;
                }
                
                // Extract prices
                if (pdpData.mrp) {
                  originalPrice = `₹${pdpData.mrp}`;
                }
                
                // Extract images
                if (pdpData.media && pdpData.media.albums) {
                  pdpData.media.albums.forEach(album => {
                    if (album.images) {
                      album.images.forEach(img => {
                        if (img.imageURL && !img.imageURL.includes('placeholder')) {
                          images.push(img.imageURL);
                        }
                      });
                    }
                  });
                }
                
                // Extract rating and reviews
                if (pdpData.ratings) {
                  if (pdpData.ratings.averageRating) {
                    rating = `${pdpData.ratings.averageRating}/5`;
                  }
                  if (pdpData.ratings.totalCount) {
                    reviews = `${pdpData.ratings.totalCount} reviews`;
                  }
                }
                
                // Extract product details
                if (pdpData.productDetails) {
                  pdpData.productDetails.forEach(detail => {
                    if (detail.description) {
                      description += detail.description + ' ';
                    }
                  });
                }
                
                       // Extract specifications from article attributes
       if (pdpData.articleAttributes) {
         Object.keys(pdpData.articleAttributes).forEach(key => {
           if (pdpData.articleAttributes[key] && pdpData.articleAttributes[key] !== 'NA') {
             specifications[key] = pdpData.articleAttributes[key];
           }
         });
       }
       
       // Extract category information
       if (pdpData.analytics) {
         if (pdpData.analytics.masterCategory) {
           category = pdpData.analytics.masterCategory;
         }
       }
       
       // Extract sizes from size chart data
       if (pdpData.sizechart && pdpData.sizechart.sizeRepresentationUrl) {
         // This will be handled in the DOM extraction fallback
       }
       
       // Extract best offers and deals
       if (pdpData.urgency) {
         pdpData.urgency.forEach(urgencyItem => {
           if (urgencyItem.type === 'PURCHASED' && urgencyItem.value > 0) {
             bestOffers.push(`${urgencyItem.value} people purchased this recently`);
           }
         });
       }
       
       // Extract delivery and return information from cross links
       if (pdpData.crossLinks) {
         pdpData.crossLinks.forEach(link => {
           if (link.title && link.title.toLowerCase().includes('delivery')) {
             deliveryInfo = link.title;
           }
           if (link.title && link.title.toLowerCase().includes('return')) {
             returnPolicy = link.title;
           }
         });
       }
              }
            }
          } catch (parseError) {
            console.log('Could not parse script data, falling back to DOM extraction');
          }
        }
      });

      // Fallback to DOM extraction if script data is not available
      if (title === 'Product Title Not Found') {
        title = $('h1').first().text().trim() || 'Product Title Not Found';
      }
      
      if (brand === 'Brand Not Found') {
        brand = $('.brand-name').text().trim() || $('.pdp-brand').text().trim() || 'Brand Not Found';
      }
      
             if (currentPrice === 'Price Not Found') {
         // Try multiple selectors for current price
         const priceSelectors = [
           '.pdp-price',
           '.price',
           '.selling-price',
           '.current-price',
           '.product-price',
           '[class*="price"]',
           '[data-testid="product-price"]'
         ];
         
         for (const selector of priceSelectors) {
           const text = $(selector).text().trim();
           if (text && text.includes('₹') && text.length < 20) {
             currentPrice = text;
             break;
           }
         }
         
         // If still no price, try to find any price-like text
         if (currentPrice === 'Price Not Found') {
           $('*').each((i, el) => {
             const text = $(el).text();
             if (text && text.includes('₹') && text.length < 20 && !text.includes('MRP')) {
               currentPrice = text.trim();
               return false; // Break the loop
             }
           });
         }
       }
      
      if (originalPrice === '') {
        originalPrice = $('.pdp-original-price').text().trim() || $('.original-price').text().trim() || $('.strike').text().trim() || '';
      }
      
      if (discount === '') {
        discount = $('.pdp-discount').text().trim() || $('.discount').text().trim() || '';
      }
      
      if (images.length === 0) {
        $('img').each((i, el) => {
          const src = $(el).attr('src') || $(el).attr('data-src');
          if (src && !src.includes('placeholder') && !src.includes('logo') && !src.includes('icon')) {
            images.push(src);
          }
        });
      }
      
      if (rating === 'Rating Not Available') {
        rating = $('.pdp-rating').text().trim() || $('.rating').first().text().trim() || 'Rating Not Available';
      }
      
      if (reviews === '') {
        reviews = $('.pdp-reviews').text().trim() || $('.reviews').first().text().trim() || '';
      }
      
      if (Object.keys(specifications).length === 0) {
        $('.pdp-productDetails tr, .product-details tr').each((i, el) => {
          const key = $(el).find('td').first().text().trim();
          const value = $(el).find('td').last().text().trim();
          if (key && value) {
            specifications[key] = value;
          }
        });
      }
      
             if (sizes.length === 0) {
         // Try multiple selectors for sizes
         const sizeSelectors = [
           '.size-selector button',
           '.size-buttons button', 
           '[data-testid="size-selector"] button',
           '.size-selector .size-button',
           '.size-chart .size-option',
           '.pdp-size-selector button',
           '.size-selector .size-option'
         ];
         
         for (const selector of sizeSelectors) {
           $(selector).each((i, el) => {
             const size = $(el).text().trim();
             const isAvailable = !$(el).hasClass('disabled') && 
                               !$(el).hasClass('out-of-stock') && 
                               !$(el).hasClass('unavailable');
             if (size && size.length < 10) { // Filter out long text that's not a size
               sizes.push({
                 size: size,
                 available: isAvailable
               });
             }
           });
           if (sizes.length > 0) break; // Stop if we found sizes
         }
         
         // If still no sizes, try to extract from size chart
         if (sizes.length === 0) {
           $('.size-chart img').each((i, el) => {
             const alt = $(el).attr('alt');
             if (alt && alt.includes('size')) {
               sizes.push({
                 size: alt.replace('size', '').trim(),
                 available: true
               });
             }
           });
         }
       }
      
      if (description === '') {
        description = $('.pdp-description').text().trim() || $('.description').text().trim() || '';
      }
      
             if (bestOffers.length === 0) {
         // Try multiple selectors for offers
         const offerSelectors = [
           '.pdp-offers .offer-item',
           '.offers .offer-item', 
           '.discount-offers .offer',
           '.product-offers .offer',
           '.deal-badge',
           '.discount-badge',
           '.offer-badge',
           '.pdp-deals .deal-item',
           '.product-deals .deal'
         ];
         
         for (const selector of offerSelectors) {
           $(selector).each((i, el) => {
             const offerText = $(el).text().trim();
             if (offerText && offerText.length > 0 && offerText.length < 100) {
               bestOffers.push(offerText);
             }
           });
           if (bestOffers.length > 0) break;
         }
         
         // Also look for discount information in the page
         if (bestOffers.length === 0) {
           $('[class*="discount"], [class*="offer"], [class*="deal"]').each((i, el) => {
             const text = $(el).text().trim();
             if (text && (text.includes('%') || text.includes('OFF') || text.includes('discount'))) {
               bestOffers.push(text);
             }
           });
         }
       }
      
             if (deliveryInfo === '') {
         // Try multiple selectors for delivery info
         const deliverySelectors = [
           '.pdp-delivery-info',
           '.delivery-info',
           '.delivery-details',
           '.shipping-info',
           '.delivery-time',
           '[class*="delivery"]',
           '[class*="shipping"]'
         ];
         
         for (const selector of deliverySelectors) {
           const text = $(selector).text().trim();
           if (text && text.length > 0 && text.length < 200) {
             deliveryInfo = text;
             break;
           }
         }
         
         // Look for delivery information in the page
         if (!deliveryInfo) {
           $('*').each((i, el) => {
             const text = $(el).text();
             if (text && (text.includes('delivery') || text.includes('shipping')) && text.length < 100) {
               deliveryInfo = text.trim();
               return false; // Break the loop
             }
           });
         }
       }
       
       if (returnPolicy === '') {
         // Try multiple selectors for return policy
         const returnSelectors = [
           '.pdp-return-policy',
           '.return-policy',
           '.return-details',
           '.return-info',
           '[class*="return"]',
           '[class*="refund"]'
         ];
         
         for (const selector of returnSelectors) {
           const text = $(selector).text().trim();
           if (text && text.length > 0 && text.length < 200) {
             returnPolicy = text;
             break;
           }
         }
         
         // Look for return information in the page
         if (!returnPolicy) {
           $('*').each((i, el) => {
             const text = $(el).text();
             if (text && (text.includes('return') || text.includes('refund')) && text.length < 100) {
               returnPolicy = text.trim();
               return false; // Break the loop
             }
           });
         }
       }
      
      if (category === '') {
        category = $('.breadcrumb-item').last().text().trim() || $('.category').text().trim() || '';
      }

             // Extract product ID from URL
       const productId = url.split('/').pop() || '';
       
       // Extract additional metadata
       const metadata = {};
       if (Object.keys(specifications).length > 0) {
         metadata.totalSpecifications = Object.keys(specifications).length;
       }
       if (images.length > 0) {
         metadata.totalImages = images.length;
       }
       if (sizes.length > 0) {
         metadata.totalSizes = sizes.length;
         metadata.availableSizes = sizes.filter(s => s.available).length;
       }
       
       // Calculate discount percentage if possible
       let discountPercentage = '';
       if (originalPrice && currentPrice && originalPrice !== currentPrice) {
         try {
           const original = parseInt(originalPrice.replace(/[^\d]/g, ''));
           const current = parseInt(currentPrice.replace(/[^\d]/g, ''));
           if (original > 0 && current > 0) {
             const discountPercent = Math.round(((original - current) / original) * 100);
             discountPercentage = `${discountPercent}% OFF`;
           }
         } catch (e) {
           // Ignore calculation errors
         }
       }

       const productData = {
         url: url,
         productId: productId,
         title: title,
         brand: brand,
         currentPrice: currentPrice,
         originalPrice: originalPrice,
         discount: discount || discountPercentage,
         images: images,
         rating: rating,
         reviews: reviews,
         specifications: specifications,
         sizes: sizes,
         description: description,
         bestOffers: bestOffers,
         deliveryInfo: deliveryInfo,
         returnPolicy: returnPolicy,
         category: category,
         metadata: metadata,
         scrapedAt: new Date().toISOString()
       };

      return productData;

    } catch (error) {
      console.error('❌ Error extracting product info:', error);
      return {
        url: url,
        error: 'Failed to extract product information',
        scrapedAt: new Date().toISOString()
      };
    }
  }

  async scrapeWithImages(url, downloadImages = true) {
    try {
      const productData = await this.scrapeProduct(url);
      
      if (downloadImages && productData.images && productData.images.length > 0) {
        const imageUrls = await this.downloadProductImages(productData.images, productData.productId);
        productData.downloadedImages = imageUrls;
      }
      
      return productData;
    } catch (error) {
      console.error('❌ Error scraping with images:', error);
      throw error;
    }
  }

  async downloadProductImages(imageUrls, productId) {
    try {
      const downloadDir = path.join(__dirname, '..', 'downloads', 'myntra', productId);
      await fs.ensureDir(downloadDir);
      
      const downloadedImages = [];
      
      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const imageUrl = imageUrls[i];
          const filename = `image_${i + 1}.jpg`;
          const filepath = path.join(downloadDir, filename);
          
          const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'stream',
            timeout: 10000
          });
          
          const writer = fs.createWriteStream(filepath);
          response.data.pipe(writer);
          
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
          
          downloadedImages.push({
            originalUrl: imageUrl,
            localPath: filepath,
            filename: filename
          });
          
          console.log(`✅ Downloaded image ${i + 1}/${imageUrls.length}`);
          
        } catch (error) {
          console.error(`❌ Failed to download image ${i + 1}:`, error.message);
        }
      }
      
      return downloadedImages;
      
    } catch (error) {
      console.error('❌ Error downloading images:', error);
      return [];
    }
  }

  async scrapeAndSave(url, filename = null) {
    try {
      const productData = await this.scrapeProduct(url);
      
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `myntra_product_${timestamp}.json`;
      }
      
      const saveDir = path.join(__dirname, '..', 'downloads', 'myntra');
      await fs.ensureDir(saveDir);
      
      const filepath = path.join(saveDir, filename);
      await fs.writeJson(filepath, productData, { spaces: 2 });
      
      console.log(`✅ Product data saved to: ${filepath}`);
      return filepath;
      
    } catch (error) {
      console.error('❌ Error scraping and saving:', error);
      throw error;
    }
  }

  async closeBrowser() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        console.log('✅ Myntra scraper browser closed successfully');
      }
    } catch (error) {
      console.error('❌ Error closing browser:', error);
      throw error;
    }
  }
}

// Create singleton instance
const myntraScraper = new MyntraProductScraper();

// Export the scraper instance and class
module.exports = {
  MyntraProductScraper,
  scrapeProduct: (url) => myntraScraper.scrapeProduct(url),
  scrapeWithImages: (url, downloadImages) => myntraScraper.scrapeWithImages(url, downloadImages),
  scrapeAndSave: (url, filename) => myntraScraper.scrapeAndSave(url, filename),
  closeBrowser: () => myntraScraper.closeBrowser()
};
