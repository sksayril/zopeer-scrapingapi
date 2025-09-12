const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class FlipkartProductScraper {
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

      console.log('✅ Product Scraper Browser initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize product scraper browser:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Product Scraper Browser closed');
    }
  }

  async scrapeProduct(url) {
    try {
      if (!this.browser) {
        await this.initialize();
      }

      console.log(`🌐 Navigating to product: ${url}`);
      
      // Navigate to the product page
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for product content to load
      await this.page.waitForSelector('h1', { timeout: 10000 });

      // Wait for images to load
      await this.page.waitForTimeout(2000);

      // Expand all offers if available
      const $ = await this.scrapeAllOffers();
      
      // Extract product information
      const product = this.extractProductInfo($, url);

      console.log(`📦 Product scraped successfully: ${product.title}`);
      return product;

    } catch (error) {
      console.error('❌ Error scraping product:', error);
      throw error;
    }
  }

  extractProductInfo($, url) {
    try {
      // Extract product title
      const title = $('h1._6EBuvT .VU-ZEz, h1[class*="title"], .product-title, span[class*="B_NuCI"]').first().text().trim();
      
      // Extract product ID from URL
      const productId = this.extractProductId(url);
      
      // Extract price information
      const currentPrice = $('.Nx9bqj, ._30jeq3, ._1_WHN1, [class*="price"], div[class*="GURu5w"]').first().text().trim();
      const originalPrice = $('.yRaY8j, ._3I9_wc, ._2pFdJl, [class*="original-price"], div[class*="kN5MkJ"]:contains("Maximum Retail Price") + div[class*="GURu5w"]').first().text().trim();
      const discount = $('.UkUFwK, ._3Ay6Sb, ._2Tpdn3, [class*="discount"], div[class*="OLIrfw"]').first().text().trim();
      
      // Extract rating and reviews
      const rating = $('.Y1HWO0, ._3LWZlK, [class*="rating"]').first().text().trim();
      const ratingCount = $('.Wphh3N span, [class*="rating-count"]').first().text().trim();
      const reviewCount = $('.Wphh3N span:last-child, [class*="review-count"], div[class*="_3UAT2v"]').first().text().trim();
      
      // Extract product images with high quality
      const images = this.extractProductImages($);
      
      // Extract product description
      const description = $('.yN+eNk, .product-description, [class*="description"]').first().text().trim();
      
      // Extract product highlights
      const highlights = this.extractHighlights($);
      
      // Extract product specifications
      const specifications = this.extractSpecifications($);
      
      // Extract seller information
      const seller = this.extractSellerInfo($);
      
      // Extract offers
      const offers = this.extractOffers($);
      
      // Extract view more offers information
      const viewMoreOffers = this.extractViewMoreOffers($);
      
      // Extract breadcrumbs
      const breadcrumbs = this.extractBreadcrumbs($);
      
      // Extract availability
      const availability = $('.IMpDNt, [class*="availability"], div[class*="_16FRp0"]').first().text().trim();
      
      // Extract delivery information
      const delivery = this.extractDeliveryInfo($);

      return {
        id: productId,
        title: title,
        url: url,
        currentPrice: currentPrice,
        originalPrice: originalPrice,
        discount: discount,
        rating: rating,
        ratingCount: ratingCount,
        reviewCount: reviewCount,
        images: images,
        description: description,
        highlights: highlights,
        specifications: specifications,
        seller: seller,
        offers: offers,
        viewMoreOffers: viewMoreOffers,
        breadcrumbs: breadcrumbs,
        availability: availability,
        delivery: delivery,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error extracting product info:', error);
      return null;
    }
  }

  extractProductId(url) {
    try {
      const match = url.match(/\/p\/([^?]+)/);
      return match ? match[1] : null;
    } catch (error) {
      console.error('Error extracting product ID:', error);
      return null;
    }
  }

  extractProductImages($) {
    const images = {
      main: [],
      thumbnails: [],
      highQuality: [],
      all: []
    };
    
    // Extract main product images with high quality
    $('img[src*="rukminim"], img[src*="flixcart"], img[class*="_396cs4"], img[class*="_2r_T1I"]').each((index, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt');
      const srcset = $(element).attr('srcset');
      
      if (src && (src.includes('rukminim') || src.includes('flixcart'))) {
        // Convert to high quality URL
        const highQualityUrl = this.convertToHighQuality(src);
        
        const imageData = {
          url: src,
          highQualityUrl: highQualityUrl,
          alt: alt || 'Product Image',
          type: 'product',
          srcset: srcset
        };
        
        images.main.push(imageData);
        images.highQuality.push(highQualityUrl);
        images.all.push(imageData);
      }
    });

    // Extract thumbnail images from the thumbnail gallery
    $('.ZqtVYK img, .thumbnail img, .YGoYIP img, img[class*="_2AcwBi"]').each((index, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt');
      
      if (src) {
        // Convert to high quality URL
        const highQualityUrl = this.convertToHighQuality(src);
        
        const imageData = {
          url: src,
          highQualityUrl: highQualityUrl,
          alt: alt || 'Thumbnail Image',
          type: 'thumbnail'
        };
        
        images.thumbnails.push(imageData);
        images.highQuality.push(highQualityUrl);
        images.all.push(imageData);
      }
    });

    // Extract 360-degree view images
    $('img[src*="360-view"], img[alt*="360"], img[alt*="view"]').each((index, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt');
      
      if (src) {
        const highQualityUrl = this.convertToHighQuality(src);
        
        const imageData = {
          url: src,
          highQualityUrl: highQualityUrl,
          alt: alt || '360 View Image',
          type: '360-view'
        };
        
        images.all.push(imageData);
        images.highQuality.push(highQualityUrl);
      }
    });

    // Extract images from srcset attributes for highest quality
    $('img[srcset]').each((index, element) => {
      const srcset = $(element).attr('srcset');
      const src = $(element).attr('src');
      const alt = $(element).attr('alt');
      
      if (srcset) {
        // Parse srcset to get highest resolution
        const highestRes = this.parseSrcset(srcset);
        
        if (highestRes) {
          const imageData = {
            url: src,
            highQualityUrl: highestRes,
            alt: alt || 'High Quality Image',
            type: 'high-quality',
            srcset: srcset
          };
          
          images.highQuality.push(highestRes);
          images.all.push(imageData);
        }
      }
    });

    // Remove duplicates from highQuality array
    images.highQuality = [...new Set(images.highQuality)];

    return images;
  }

  convertToHighQuality(url) {
    if (!url) return null;
    
    try {
      // Convert low quality to high quality by modifying URL parameters
      let highQualityUrl = url;
      
      // Replace size parameters for higher quality
      highQualityUrl = highQualityUrl.replace(/\/\d+\/\d+\//, '/832/832/');
      highQualityUrl = highQualityUrl.replace(/\/128\/128\//, '/832/832/');
      highQualityUrl = highQualityUrl.replace(/\/416\/416\//, '/832/832/');
      
      // Remove quality compression
      highQualityUrl = highQualityUrl.replace(/q=70/, 'q=100');
      highQualityUrl = highQualityUrl.replace(/q=80/, 'q=100');
      
      // Remove crop parameters for full image
      highQualityUrl = highQualityUrl.replace(/&crop=false/, '');
      highQualityUrl = highQualityUrl.replace(/crop=false/, '');
      
      return highQualityUrl;
    } catch (error) {
      console.error('Error converting to high quality URL:', error);
      return url;
    }
  }

  parseSrcset(srcset) {
    if (!srcset) return null;
    
    try {
      // Parse srcset to find highest resolution
      const sources = srcset.split(',').map(src => {
        const parts = src.trim().split(' ');
        return {
          url: parts[0],
          width: parseInt(parts[1]) || 0
        };
      });
      
      // Sort by width and return highest
      sources.sort((a, b) => b.width - a.width);
      return sources[0]?.url || null;
    } catch (error) {
      console.error('Error parsing srcset:', error);
      return null;
    }
  }

  async downloadImage(imageUrl, filename, outputDir = 'images') {
    try {
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': this.userAgents[Math.floor(Math.random() * this.userAgents.length)],
          'Referer': 'https://www.flipkart.com/',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      // Ensure output directory exists
      const fullOutputDir = path.join(__dirname, outputDir);
      await fs.ensureDir(fullOutputDir);
      
      const filepath = path.join(fullOutputDir, filename);
      const writer = fs.createWriteStream(filepath);
      
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`📸 Image downloaded: ${filename}`);
          resolve(filepath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`❌ Error downloading image ${imageUrl}:`, error.message);
      return null;
    }
  }

  async downloadAllImages(images, productId) {
    const downloadedImages = [];
    const outputDir = `images/${productId}`;
    
    console.log(`📸 Starting download of ${images.highQuality.length} high-quality images...`);
    
    for (let i = 0; i < images.highQuality.length; i++) {
      const imageUrl = images.highQuality[i];
      const extension = this.getImageExtension(imageUrl);
      const filename = `image_${i + 1}_hq.${extension}`;
      
      try {
        const filepath = await this.downloadImage(imageUrl, filename, outputDir);
        if (filepath) {
          downloadedImages.push({
            originalUrl: imageUrl,
            localPath: filepath,
            filename: filename,
            index: i + 1
          });
        }
        
        // Add delay between downloads to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Failed to download image ${i + 1}:`, error.message);
      }
    }
    
    console.log(`✅ Downloaded ${downloadedImages.length}/${images.highQuality.length} images`);
    return downloadedImages;
  }

  getImageExtension(url) {
    try {
      const match = url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
      return match ? match[1].toLowerCase() : 'jpg';
    } catch (error) {
      return 'jpg';
    }
  }

  extractHighlights($) {
    const highlights = [];
    
    $('._7eSDEz, .highlight li, [class*="highlight"] li, div[class*="_3npa3F"] li, div[class*="_2Tpdn3"] li').each((index, element) => {
      const highlight = $(element).text().trim();
      if (highlight) {
        highlights.push(highlight);
      }
    });

    return highlights;
  }

  extractSpecifications($) {
    const specifications = {};
    
    $('._0ZhAN9 tr, .specification tr, div[class*="_3npa3F"] tr, table[class*="spec"] tr').each((index, element) => {
      const key = $(element).find('td:first-child, th:first-child').text().trim();
      const value = $(element).find('td:last-child, th:last-child').text().trim();
      
      if (key && value) {
        specifications[key] = value;
      }
    });

    // Also extract from specification lists
    $('ul[class*="spec"], li[class*="spec"], div[class*="spec-list"] li, ul[class*="_3npa3F"] li').each((index, element) => {
      const text = $(element).text().trim();
      if (text && text.includes(':')) {
        const [key, value] = text.split(':').map(s => s.trim());
        if (key && value && key.length > 2 && value.length > 1) {
          const cleanKey = key.replace(/[^\w\s]/g, '').trim();
          if (cleanKey && !specifications[cleanKey]) {
            specifications[cleanKey] = value;
          }
        }
      }
    });

    return specifications;
  }

  extractSellerInfo($) {
    const seller = {};
    
    // Extract seller name
    seller.name = $('#sellerName span, .seller-name').first().text().trim();
    
    // Extract seller rating
    seller.rating = $('#sellerName .XQDdHH, .seller-rating').first().text().trim();
    
    // Extract seller policies
    seller.policies = [];
    $('.fke1mx li, .seller-policies li').each((index, element) => {
      const policy = $(element).text().trim();
      if (policy) {
        seller.policies.push(policy);
      }
    });

    return seller;
  }

  async scrapeAllOffers() {
    try {
      let offersExpanded = false;
      let totalOffersFound = 0;
      let expansionAttempts = 0;
      const maxExpansionAttempts = 10;
      
      console.log('🚀 Starting automatic "View more offers" expansion...');
      
      // Keep clicking "View more offers" buttons until no more are found
      while (expansionAttempts < maxExpansionAttempts) {
        expansionAttempts++;
        
        // Look for any "View more offers" button
        const viewMoreOffersButton = await this.page.$('button._0+FGxP, button[class*="view-more"], div[class*="view-more"], span[class*="view-more"], a[class*="view-more"], div[class*="view-more"]');
        
        if (!viewMoreOffersButton) {
          console.log('🔍 No more "View more offers" buttons found');
          break;
        }
        
        // Get the text before clicking to extract the count
        const viewMoreText = await viewMoreOffersButton.evaluate(el => el.textContent.trim());
        const countMatch = viewMoreText.match(/See\s+(\d+)\s+More\s+Offers?/i);
        const expectedCount = countMatch ? parseInt(countMatch[1]) : 0;
        
        console.log(`🔍 Found "View more offers" button: "${viewMoreText}" - Expected ${expectedCount} more offers`);
        
        // Check if button is visible and clickable
        const isVisible = await viewMoreOffersButton.isVisible();
        if (!isVisible) {
          console.log('⚠️ View more button is not visible, scrolling to it');
          await viewMoreOffersButton.scrollIntoView();
          await this.page.waitForTimeout(1000);
        }
        
        // Check if button is enabled
        const isEnabled = await viewMoreOffersButton.evaluate(el => !el.disabled && el.style.pointerEvents !== 'none');
        if (!isEnabled) {
          console.log('⚠️ View more button is disabled, skipping');
          break;
        }
        
        // Click the button to expand offers
        try {
          await viewMoreOffersButton.click();
          offersExpanded = true;
          totalOffersFound += expectedCount;
          
          console.log(`✅ Clicked to expand ${expectedCount} more offers. Total expanded so far: ${totalOffersFound}`);
          
          // Wait for offers to expand and load
          await this.page.waitForTimeout(4000);
          
          // Wait for any loading indicators to disappear
          try {
            await this.page.waitForFunction(() => {
              const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="skeleton"], [class*="shimmer"]');
              return loadingElements.length === 0;
            }, { timeout: 10000 });
          } catch (timeoutError) {
            console.log('⏰ Loading timeout reached, proceeding with current content');
          }
          
          // Wait a bit more for dynamic content to load
          await this.page.waitForTimeout(3000);
          
          // Verify that new offers were actually loaded
          const currentOffersCount = await this.page.$$eval('[class*="offer"], [class*="discount"], [class*="deal"]', elements => elements.length);
          console.log(`📊 Current offers count on page: ${currentOffersCount}`);
          
        } catch (clickError) {
          console.error(`❌ Error clicking view more button: ${clickError.message}`);
          break;
        }
        
        // Check if there are still more "View more" buttons
        const remainingButtons = await this.page.$$('button._0+FGxP, button[class*="view-more"], div[class*="view-more"], span[class*="view-more"], a[class*="view-more"]');
        
        if (remainingButtons.length === 0) {
          console.log('✅ All "View more offers" buttons have been clicked');
          break;
        }
        
        // If we've expanded too many times, break to prevent infinite loops
        if (totalOffersFound > 50) {
          console.log('⚠️ Reached maximum offer expansion limit (50), stopping to prevent infinite loop');
          break;
        }
      }
      
      if (offersExpanded) {
        console.log(`🎉 Successfully expanded offers. Total offers expanded: ${totalOffersFound}`);
        console.log('📋 Now extracting all offers including the newly expanded ones...');
      } else {
        console.log('ℹ️ No "View more offers" buttons found to expand');
      }
      
      // Now expand other "View more" sections (specifications, highlights, etc.)
      await this.expandAllViewMoreSections();
      
      // Get updated page content after expanding all offers
      const content = await this.page.content();
      return cheerio.load(content);
    } catch (error) {
      console.error('Error expanding offers:', error);
      // Return current page content if error occurs
      const content = await this.page.content();
      return cheerio.load(content);
    }
  }

  async expandAllViewMoreSections() {
    try {
      console.log('🔍 Expanding all other "View more" sections...');
      
      // Look for various "View more" buttons for different sections
      const viewMoreSelectors = [
        'button[class*="view-more"]:not([class*="offer"])',
        'span[class*="view-more"]:not([class*="offer"])',
        'div[class*="view-more"]:not([class*="offer"])',
        'a[class*="view-more"]:not([class*="offer"])',
        'button:contains("View more")',
        'span:contains("View more")',
        'div:contains("View more")',
        'a:contains("View more")'
      ];
      
      for (const selector of viewMoreSelectors) {
        try {
          const viewMoreButtons = await this.page.$$(selector);
          
          for (const button of viewMoreButtons) {
            try {
              const buttonText = await button.evaluate(el => el.textContent.trim());
              
              // Skip if it's an offer-related button (already handled)
              if (buttonText.toLowerCase().includes('offer')) {
                continue;
              }
              
              console.log(`🔍 Found "View more" button: "${buttonText}"`);
              
              // Check if button is visible
              const isVisible = await button.isVisible();
              if (!isVisible) {
                await button.scrollIntoView();
                await this.page.waitForTimeout(500);
              }
              
              // Click the button
              await button.click();
              console.log(`✅ Clicked "${buttonText}" button`);
              
              // Wait for content to expand
              await this.page.waitForTimeout(2000);
              
              // Wait for loading to complete
              try {
                await this.page.waitForFunction(() => {
                  const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="skeleton"]');
                  return loadingElements.length === 0;
                }, { timeout: 5000 });
              } catch (timeoutError) {
                console.log('⏰ Loading timeout for section expansion');
              }
              
            } catch (buttonError) {
              console.log(`⚠️ Error clicking button: ${buttonError.message}`);
            }
          }
        } catch (selectorError) {
          console.log(`⚠️ Error with selector ${selector}: ${selectorError.message}`);
        }
      }
      
      console.log('✅ Finished expanding all "View more" sections');
      
    } catch (error) {
      console.error('Error expanding view more sections:', error);
    }
  }

  extractOffers($) {
    const offers = [];
    
    console.log('🔍 Starting comprehensive offer extraction...');
    
    // Comprehensive offer extraction with multiple selector strategies
    const offerSelectors = [
      // Primary selectors
      '.+-2B3d.row, .NYb6Oz .I\\+EQVr span, .offer-container',
      // Alternative selectors
      'div[class*="_3npa3F"], div[class*="_2Tpdn3"]',
      // Generic offer selectors
      '.kF1Ml8.col, [class*="offer-row"]',
      // Additional selectors for expanded offers
      'div[class*="offer"], div[class*="discount"], div[class*="deal"]',
      // List item selectors
      'li[class*="offer"], li[class*="discount"], li[class*="deal"]',
      // Span selectors
      'span[class*="offer"], span[class*="discount"], span[class*="deal"]',
      // More specific selectors for Flipkart
      'div[class*="_2Tpdn3"], div[class*="_3npa3F"], div[class*="kF1Ml8"]',
      // Generic text-based extraction for any remaining offers
      'div:contains("Offer"), div:contains("Discount"), div:contains("Deal")'
    ];
    
    let offersFound = 0;
    
    // Try each selector strategy
    for (const selector of offerSelectors) {
      const selectorOffers = [];
      
      $(selector).each((index, element) => {
        try {
          // Extract offer type (Bank Offer, Special Price, etc.)
          const offerType = $(element).find('.ynXjOy, [class*="offer-type"], [class*="type"], [class*="label"]').first().text().trim();
          
          // Extract offer description
          let offerDesc = '';
          const descElement = $(element).find('.ynXjOy, [class*="description"], [class*="desc"], [class*="text"]').first();
          if (descElement.length) {
            offerDesc = descElement.text().trim();
          } else {
            // If structure is different, try to get all text excluding the offer type
            const fullText = $(element).text().trim();
            if (offerType && fullText.includes(offerType)) {
              offerDesc = fullText.substring(fullText.indexOf(offerType) + offerType.length).trim();
            } else {
              // If no offer type found, use the full text as description
              offerDesc = fullText;
            }
          }
          
          // Extract T&C if available
          const hasTnC = $(element).find('._4EqiSd, [class*="tnc"], [class*="terms"], [class*="conditions"]').length > 0;
          
          // Extract additional offer details
          const offerDetails = {};
          
          // Look for percentage or amount
          const percentageMatch = $(element).text().match(/(\d+(?:\.\d+)?%?)/);
          if (percentageMatch) {
            offerDetails.percentage = percentageMatch[1];
          }
          
          // Look for bank names
          const bankMatch = $(element).text().match(/(HDFC|ICICI|SBI|Axis|Kotak|Yes Bank|RBL|Federal|PNB|Canara)/i);
          if (bankMatch) {
            offerDetails.bank = bankMatch[1];
          }
          
          // Look for card types
          const cardMatch = $(element).text().match(/(Credit Card|Debit Card|Net Banking|UPI|Wallet)/i);
          if (cardMatch) {
            offerDetails.paymentMethod = cardMatch[1];
          }
          
          // Only add if we have meaningful content and it's not just whitespace
          if ((offerType || offerDesc) && (offerType + offerDesc).trim().length > 5) {
            const offer = {
              type: offerType || 'Special Offer',
              description: offerDesc,
              hasTnC: hasTnC,
              index: offers.length + 1,
              selector: selector
            };
            
            // Add additional details if found
            if (Object.keys(offerDetails).length > 0) {
              offer.details = offerDetails;
            }
            
            selectorOffers.push(offer);
          }
        } catch (err) {
          console.error('Error parsing offer element:', err);
        }
      });
      
      if (selectorOffers.length > 0) {
        console.log(`✅ Selector "${selector}" found ${selectorOffers.length} offers`);
        offers.push(...selectorOffers);
        offersFound += selectorOffers.length;
        
        // If we found a good number of offers with this selector, don't try others to avoid duplicates
        if (selectorOffers.length >= 3) {
          break;
        }
      }
    }
    
    // Remove duplicates based on description
    const uniqueOffers = [];
    const seenDescriptions = new Set();
    
    offers.forEach(offer => {
      const key = `${offer.type}-${offer.description}`.toLowerCase();
      if (!seenDescriptions.has(key)) {
        seenDescriptions.add(key);
        uniqueOffers.push(offer);
      }
    });
    
    // Check for "View more offers" button and extract count (for reference)
    const viewMoreButton = $('button._0+FGxP, button[class*="view-more"], div[class*="view-more"], span[class*="view-more"]');
    if (viewMoreButton.length > 0) {
      const viewMoreText = viewMoreButton.first().text().trim();
      const countMatch = viewMoreText.match(/See\s+(\d+)\s+More\s+Offers?/i);
      
      if (countMatch) {
        const count = parseInt(countMatch[1]);
        uniqueOffers.push({
          type: "viewMore",
          count: count,
          message: viewMoreText,
          status: "expanded",
          note: `This button was automatically clicked to reveal ${count} additional offers above`
        });
      }
    }
    
    console.log(`📊 Extracted ${uniqueOffers.length} unique offers from the page (${offersFound} total found, ${offersFound - uniqueOffers.length} duplicates removed)`);
    
    // Log each offer for debugging
    uniqueOffers.forEach((offer, index) => {
      if (offer.type !== "viewMore") {
        console.log(`  ${index + 1}. ${offer.type}: ${offer.description.substring(0, 100)}${offer.description.length > 100 ? '...' : ''}`);
      }
    });
    
    return uniqueOffers;
  }

  extractBreadcrumbs($) {
    const breadcrumbs = [];
    
    $('.r2CdBx a, .breadcrumb a').each((index, element) => {
      const text = $(element).text().trim();
      const href = $(element).attr('href');
      
      if (text) {
        breadcrumbs.push({
          text: text,
          url: href ? `https://www.flipkart.com${href}` : null
        });
      }
    });

    return breadcrumbs;
  }

  extractDeliveryInfo($) {
    const delivery = {};
    
    // Extract delivery date
    delivery.date = $('.Y8v7Fl, .delivery-date').first().text().trim();
    
    // Extract delivery time
    delivery.time = $('.m-cM89, .delivery-time').first().text().trim();
    
    // Extract delivery cost
    delivery.cost = $('.delivery-cost, [class*="delivery"]').first().text().trim();

    return delivery;
  }

  extractViewMoreOffers($) {
    const viewMoreInfo = {};
    
    // Look for view more offers button/text
    const viewMoreButton = $('button._0+FGxP, button[class*="view-more"], div[class*="view-more"], span[class*="view-more"], a[class*="view-more"]');
    
    if (viewMoreButton.length > 0) {
      const viewMoreText = viewMoreButton.first().text().trim();
      const countMatch = viewMoreText.match(/See\s+(\d+)\s+More\s+Offers?/i);
      
      viewMoreInfo.exists = true;
      viewMoreInfo.text = viewMoreText;
      viewMoreInfo.count = countMatch ? parseInt(countMatch[1]) : 0;
      viewMoreInfo.element = viewMoreButton.first().prop('tagName').toLowerCase();
      viewMoreInfo.classes = viewMoreButton.first().attr('class') || '';
    } else {
      viewMoreInfo.exists = false;
      viewMoreInfo.text = '';
      viewMoreInfo.count = 0;
    }
    
    return viewMoreInfo;
  }

  async scrapeWithRetry(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Product scraping attempt ${attempt}/${maxRetries}`);
        return await this.scrapeProduct(url);
      } catch (error) {
        console.error(`❌ Product scraping attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  async saveToFile(data, filename = 'product.json') {
    try {
      const outputDir = path.join(__dirname, 'output');
      await fs.ensureDir(outputDir);
      
      const filepath = path.join(outputDir, filename);
      await fs.writeJson(filepath, data, { spaces: 2 });
      
      console.log(`💾 Product data saved to: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error('❌ Error saving product file:', error);
      throw error;
    }
  }
}

// Create singleton instance
const productScraper = new FlipkartProductScraper();

// Export functions
module.exports = {
  scrapeProduct: async (url) => {
    return await productScraper.scrapeWithRetry(url);
  },
  
  scrapeAndSave: async (url, filename = null) => {
    const product = await productScraper.scrapeWithRetry(url);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `flipkart-product-${timestamp}.json`;
    return await productScraper.saveToFile(product, filename || defaultFilename);
  },
  
  scrapeWithImages: async (url, downloadImages = true) => {
    const product = await productScraper.scrapeWithRetry(url);
    
    if (downloadImages && product && product.images && product.images.highQuality.length > 0) {
      console.log('📸 Downloading high-quality images...');
      const downloadedImages = await productScraper.downloadAllImages(product.images, product.id);
      product.downloadedImages = downloadedImages;
    }
    
    return product;
  },
  
  scrapeAndSaveWithImages: async (url, filename = null, downloadImages = true) => {
    const product = await productScraper.scrapeWithRetry(url);
    
    if (downloadImages && product && product.images && product.images.highQuality.length > 0) {
      console.log('📸 Downloading high-quality images...');
      const downloadedImages = await productScraper.downloadAllImages(product.images, product.id);
      product.downloadedImages = downloadedImages;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `flipkart-product-${timestamp}.json`;
    const filepath = await productScraper.saveToFile(product, filename || defaultFilename);
    
    return {
      product: product,
      filepath: filepath,
      imagesDownloaded: downloadImages && product && product.downloadedImages ? product.downloadedImages.length : 0
    };
  },
  
  downloadProductImages: async (productId, imageUrls) => {
    const images = { highQuality: imageUrls };
    return await productScraper.downloadAllImages(images, productId);
  },
  
  closeBrowser: async () => {
    await productScraper.close();
  }
};
