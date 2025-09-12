const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class TataCliqScraper {
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
      
      // Don't block resources as they might be needed for proper page rendering
      // await this.page.setRequestInterception(true);
      // this.page.on('request', (req) => {
      //   if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
      //     req.abort();
      //   } else {
      //     req.continue();
      //   }
      // });

    } catch (error) {
      throw new Error(`Failed to initialize browser: ${error.message}`);
    }
  }

  async scrapeProduct(url) {
    try {
      if (!this.browser || !this.page) {
        await this.initialize();
      }

      // Navigate to the product page with better loading strategy
      await this.page.goto(url, { 
        waitUntil: 'networkidle0', 
        timeout: 30000 
      });
      
      // Wait for dynamic content to load
      await this.page.waitForTimeout(5000);
      
      // Try to wait for specific elements that indicate the page has loaded
      try {
        await this.page.waitForSelector('body', { timeout: 10000 });
        // Wait a bit more for JavaScript to execute
        await this.page.waitForTimeout(3000);
      } catch (error) {
        console.log('Basic page elements not found, continuing anyway...');
      }
      
      // Check if page has loaded by looking for any content
      const pageContent = await this.page.content();
      if (!pageContent || pageContent.length < 1000) {
        throw new Error('Page content not loaded properly');
      }
      
      // Check for common blocking scenarios
      if (pageContent.includes('Access Denied') || pageContent.includes('Blocked') || pageContent.includes('Robot') || pageContent.includes('Captcha')) {
        throw new Error('Page access blocked or requires verification');
      }

      // Get page content
      const content = await this.page.content();
      const $ = cheerio.load(content);

      // Debug: Log available selectors for troubleshooting
      this.debugPageStructure($);

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
      productDescription: '',
      featuresAndFunctions: {},
      mainImage: '',
      additionalImages: [],
      availableOffers: [],
      brand: '',
      model: '',
      url: url,
      scrapedAt: new Date().toISOString()
    };

    // Product Name/Title - More comprehensive selector strategy
    productData.productName = this.extractText($, [
      '.ProductDetailsMainCard__productName',
      'h1.ProductDetailsMainCard__productName',
      'h1[itemprop="name"]',
      '.ProductDescription__headerText1',
      'h1',
      '.ProductDetailsMainCard__linkName h1',
      'h1.ProductDetailsMainCard__productName',
      '.ProductDescriptionPage__cardHeaderHolder h1',
      'h1:first',
      '.ProductDetailsMainCard__linkName h1',
      '.ProductDescriptionPage__cardHeaderHolder h1',
      'h1:contains("Watch")',
      'h1:contains("Analog")',
      'h1:contains("Digital")',
      'h1:contains("Smart")'
    ]);
    
    // Fallback: If no product name found, try to extract from page title or any visible text
    if (!productData.productName) {
      productData.productName = this.extractFallbackProductName($);
    }

    // Brand extraction - More comprehensive selector strategy
    productData.brand = this.extractText($, [
      '#pd-brand-name span[itemprop="name"]',
      '.ProductDetailsMainCard__brandName span[itemprop="name"]',
      '.ProductDetailsMainCard__brandName',
      '#pd-brand-name',
      '.ProductDetailsMainCard__brandName span',
      'h2[role="button"] span[itemprop="name"]',
      'h2[role="button"]'
    ]);

    // Model extraction from product name
    if (productData.productName) {
      const modelMatch = productData.productName.match(/[A-Z]{2,3}\d{4}[A-Z]{2,3}\d{2}/);
      if (modelMatch) {
        productData.model = modelMatch[0];
      }
    }

    // Selling Price - More comprehensive selector strategy
    productData.sellingPrice = this.extractPrice($, [
      '.ProductDetailsMainCard__price h3',
      '.ProductDetailsMainCard__price meta[itemprop="lowPrice"]',
      '.ProductDescription__boldText',
      '.ProductDetailsMainCard__price h3',
      'h3:contains("₹")',
      '.ProductDetailsMainCard__price',
      'meta[itemprop="lowPrice"]',
      '.ProductDetailsMainCard__priceSection h3'
    ]);

    // Actual Price (MRP)
    productData.actualPrice = this.extractActualPrice($);

    // Main Product Image
    productData.mainImage = this.extractMainImage($);

    // Additional Images
    productData.additionalImages = this.extractAdditionalImages($, productData.mainImage);

    // Product Description
    productData.productDescription = this.extractProductDescription($);

    // Features and Functions
    productData.featuresAndFunctions = this.extractFeaturesAndFunctions($);

    // Available Offers
    productData.availableOffers = this.extractAvailableOffers($);

    // General Offers
    productData.offers = this.extractGeneralOffers($);

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
        let text = '';
        if (selector.includes('meta')) {
          text = element.attr('content') || '';
        } else {
          text = element.text().trim();
        }
        
        if (text) {
          // Extract numeric price - handle both ₹ symbol and plain numbers
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
    // Look for MRP or cancelled price elements
    const actualPriceSelectors = [
      '.ProductDetailsMainCard__cancelPrice',
      '.ProductDetailsMainCard__priceCancelled .ProductDetailsMainCard__cancelPrice',
      '.ProductDescription__priceCancelled span'
    ];

    for (const selector of actualPriceSelectors) {
      const element = $(selector);
      if (element.length) {
        const text = element.text().trim();
        if (text) {
          const priceMatch = text.match(/₹?([\d,]+(?:\.\d{2})?)/);
          if (priceMatch) {
            return priceMatch[1].replace(/,/g, '');
          }
        }
      }
    }

    return '';
  }

  extractMainImage($) {
    const mainImageSelectors = [
      '.ProductGalleryDesktop__image img.Image__actual',
      '#APIM img.Image__actual',
      '.ProductGalleryDesktop__content img.Image__actual'
    ];

    for (const selector of mainImageSelectors) {
      const element = $(selector);
      if (element.length) {
        const src = element.attr('src');
        if (src && src.startsWith('//')) {
          return 'https:' + src;
        } else if (src && src.startsWith('http')) {
          return src;
        }
      }
    }

    return '';
  }

  extractAdditionalImages($, mainImage) {
    const images = [];
    
    // Extract thumbnail images
    $('.ProductGalleryDesktop__navImage img.Image__actual').each((index, element) => {
      const imgSrc = $(element).attr('src');
      if (imgSrc) {
        let fullSrc = imgSrc;
        if (imgSrc.startsWith('//')) {
          fullSrc = 'https:' + imgSrc;
        }
        
        if (fullSrc !== mainImage && !images.includes(fullSrc)) {
          images.push(fullSrc);
        }
      }
    });

    // Extract zoom images if available
    $('.ProductGalleryDesktop__zoom img.Image__actual').each((index, element) => {
      const imgSrc = $(element).attr('src');
      if (imgSrc) {
        let fullSrc = imgSrc;
        if (imgSrc.startsWith('//')) {
          fullSrc = 'https:' + imgSrc;
        }
        
        if (fullSrc !== mainImage && !images.includes(fullSrc)) {
          images.push(fullSrc);
        }
      }
    });

    return images.slice(0, 15); // Limit to 15 additional images
  }

  extractProductDescription($) {
    const descriptions = [];
    
    // Extract from product description section
    $('.ProductDescriptionPage__accordionContent[itemprop="description"]').each((index, element) => {
      const text = $(element).text().trim();
      if (text && text.length > 10) {
        descriptions.push(text);
      }
    });

    // Extract from product details
    $('.ProductDescriptionPage__contentDetailsPDP').each((index, element) => {
      const header = $(element).find('.ProductDescriptionPage__headerDetailsPDP').text().trim();
      const value = $(element).find('.ProductDescriptionPage__headerDetailsValuePDP').text().trim();
      
      if (header && value) {
        descriptions.push(`${header}: ${value}`);
      }
    });

    return descriptions.join(' ').substring(0, 2000); // Limit description length
  }

  extractFeaturesAndFunctions($) {
    const features = {};
    
    // Extract from Features & Functions section
    $('.ProductDescriptionPage__featureHolder').each((index, element) => {
      const header = $(element).find('.ProductDescriptionPage__sideHeader').text().trim();
      const value = $(element).find('.ProductDescriptionPage__sideContent').last().text().trim();
      
      if (header && value && header !== value) {
        const cleanHeader = header.replace(/[^\w\s]/g, '').trim();
        if (cleanHeader && !features[cleanHeader]) {
          features[cleanHeader] = value;
        }
      }
    });

    // Extract from product details section as well
    $('.ProductDescriptionPage__contentDetailsPDP').each((index, element) => {
      const header = $(element).find('.ProductDescriptionPage__headerDetailsPDP').text().trim();
      const value = $(element).find('.ProductDescriptionPage__headerDetailsValuePDP').text().trim();
      
      if (header && value) {
        const cleanHeader = header.replace(/[^\w\s]/g, '').trim();
        if (cleanHeader && !features[cleanHeader]) {
          features[cleanHeader] = value;
        }
      }
    });

    return features;
  }

  extractAvailableOffers($) {
    const offers = [];
    
    // Extract from Available Offers section
    $('.OffersSection__offer_list li').each((index, element) => {
      const offerData = {};
      
      // Offer title/highlight
      const highlight = $(element).find('.OffersSection__offerHighlightText').text().trim();
      if (highlight) {
        offerData.title = highlight;
      }
      
      // Offer price
      const offerPrice = $(element).find('.OffersSection__offerPriceValue').text().trim();
      if (offerPrice) {
        offerData.offerPrice = offerPrice;
      }
      
      // Offer code and conditions
      const codeElement = $(element).find('.OffersSection__maxMin span');
      if (codeElement.length >= 2) {
        const codeText = codeElement.first().text().trim();
        const minPurchaseText = codeElement.last().text().trim();
        
        if (codeText.includes('Use Code:')) {
          const codeMatch = codeText.match(/Use Code:\s*([A-Z0-9]+)/);
          if (codeMatch) {
            offerData.code = codeMatch[1];
          }
        }
        
        if (minPurchaseText.includes('Min Purchase:')) {
          const minMatch = minPurchaseText.match(/Min Purchase:\s*₹([\d,]+)/);
          if (minMatch) {
            offerData.minPurchase = minMatch[1];
          }
        }
      }
      
      if (offerData.title) {
        offers.push(offerData);
      }
    });

    // Check if there are more offers (view more functionality)
    const viewMoreElement = $('#os-show-more');
    if (viewMoreElement.length) {
      const viewMoreText = viewMoreElement.text().trim();
      if (viewMoreText.includes('More Offers')) {
        const match = viewMoreText.match(/See\s+(\d+)\s+More\s+Offers/);
        if (match) {
          offers.push({
            type: 'viewMore',
            count: parseInt(match[1]),
            message: viewMoreText
          });
        }
      }
    }

    return offers;
  }

  extractGeneralOffers($) {
    const offers = [];
    
    // Extract general offers and deals
    $('.PdpFlags__offer').each((index, element) => {
      const offerText = $(element).text().trim();
      if (offerText && !offers.includes(offerText)) {
        offers.push(offerText);
      }
    });

    // Extract from best offer wrapper
    $('.ProductDescriptionPage__bestOfferWrapper').each((index, element) => {
      const offerText = $(element).find('.ProductDescriptionPage__offerText').text().trim();
      if (offerText && !offers.includes(offerText)) {
        offers.push(offerText);
      }
    });

    // Extract from EMI options
    $('.PdpPaymentInfo__base').each((index, element) => {
      const emiText = $(element).text().trim();
      if (emiText && emiText.includes('EMI')) {
        offers.push(emiText);
      }
    });

    return offers;
  }

  extractFallbackProductName($) {
    // Try to extract from page title
    const pageTitle = $('title').text().trim();
    if (pageTitle && pageTitle.length > 10) {
      // Clean up the title
      const cleanTitle = pageTitle
        .replace(/Tata CLiQ|Online Shopping|Buy|India/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanTitle.length > 5) {
        return cleanTitle;
      }
    }
    
    // Try to find any text that looks like a product name
    const possibleNames = [];
    $('h1, h2, h3, .product-name, .title, [class*="name"], [class*="title"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10 && text.length < 200) {
        // Check if it looks like a product name (contains common product words)
        if (text.match(/(Watch|Phone|Laptop|Shoe|Bag|Dress|Shirt|Jeans|Camera|Headphone|Speaker|Book|Toy|Game|Tool|Kitchen|Home|Garden|Sports|Fitness|Beauty|Health|Baby|Kids|Men|Women|Unisex|Analog|Digital|Smart|Wireless|Bluetooth|USB|HD|4K|LED|OLED|LCD|Touch|Screen|Battery|Charger|Cable|Adapter|Case|Cover|Stand|Mount|Tripod|Microphone|Keyboard|Mouse|Monitor|Printer|Scanner|Projector|Router|Modem|Switch|Hub|Cable|Wire|Antenna|Sensor|Detector|Alarm|Lock|Safe|Tool|Kit|Set|Pack|Bundle|Combo|Collection|Series|Model|Brand|Edition|Limited|Premium|Pro|Max|Plus|Mini|Nano|Micro|Ultra|Super|Hyper|Mega|Giga|Tera|Peta|Exa|Zetta|Yotta)/i)) {
          possibleNames.push(text);
        }
      }
    });
    
    if (possibleNames.length > 0) {
      return possibleNames[0];
    }
    
    return '';
  }

  debugPageStructure($) {
    console.log('=== Debug: Available Page Elements ===');
    
    // Check for product name elements
    const productNameElements = $('h1, .ProductDetailsMainCard__productName, [itemprop="name"]');
    console.log(`Product name elements found: ${productNameElements.length}`);
    productNameElements.each((i, el) => {
      console.log(`  ${i + 1}. ${$(el).prop('tagName')} - ${$(el).attr('class')} - ${$(el).text().substring(0, 50)}`);
    });

    // Check for price elements
    const priceElements = $('h3, .ProductDetailsMainCard__price, [itemprop="lowPrice"]');
    console.log(`Price elements found: ${priceElements.length}`);
    priceElements.each((i, el) => {
      console.log(`  ${i + 1}. ${$(el).prop('tagName')} - ${$(el).attr('class')} - ${$(el).text().substring(0, 50)}`);
    });

    // Check for brand elements
    const brandElements = $('.ProductDetailsMainCard__brandName, #pd-brand-name, h2[role="button"]');
    console.log(`Brand elements found: ${brandElements.length}`);
    brandElements.each((i, el) => {
      console.log(`  ${i + 1}. ${$(el).prop('tagName')} - ${$(el).attr('class')} - ${$(el).text().substring(0, 50)}`);
    });

    console.log('=== End Debug ===');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = TataCliqScraper;
