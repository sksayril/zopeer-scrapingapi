const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class OneMgScraper {
    constructor() {
        this.baseUrl = 'https://www.1mg.com';
        this.browser = null;
        this.page = null;
    }

    async init() {
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
                    '--disable-gpu'
                ]
            });
            this.page = await this.browser.newPage();
            
            // Set user agent to avoid detection
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // Set viewport
            await this.page.setViewport({ width: 1366, height: 768 });
            
            // Set extra headers
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            });
        } catch (error) {
            console.error('Error initializing 1mg scraper:', error);
            throw error;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async scrapeProduct(url) {
        try {
            if (!this.page) {
                await this.init();
            }

            console.log(`Scraping 1mg product: ${url}`);
            
            // Navigate to the product page
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Wait for the page to load completely
            await this.page.waitForTimeout(3000);

            // Get page content
            const content = await this.page.content();
            const $ = cheerio.load(content);

            // Extract product data
            const productData = await this.extractProductData($, url);
            
            return productData;
        } catch (error) {
            console.error('Error scraping 1mg product:', error);
            throw error;
        }
    }

    async extractProductData($, url) {
        try {
            const productData = {
                url: url,
                scrapedAt: new Date().toISOString(),
                source: '1mg',
                product: {}
            };

            // Extract data from PRELOADED_STATE script
            const preloadedState = this.extractPreloadedState($);
            
            // Debug logging
            console.log('Extracted preloaded state:', preloadedState ? 'Found' : 'Not found');
            this.logExtractedData(preloadedState);
            
            if (preloadedState && preloadedState.otcPage && preloadedState.otcPage.otcInfo) {
                const otcInfo = preloadedState.otcPage.otcInfo;
                const skus = otcInfo.skus;
                
                if (skus) {
                    // Extract basic product information
                    productData.product.title = skus.name || 'Unknown Product';
                    productData.product.productId = skus.id || 'Unknown';
                    productData.product.brand = this.extractBrand(skus.name);
                    
                    // Extract pricing information
                    productData.product.mrp = skus.price || null;
                    productData.product.sellingPrice = skus.discountedPrice || null;
                    productData.product.discount = this.calculateDiscount(skus.price, skus.discountedPrice);
                    productData.product.discountPercent = skus.discountPercent || null;
                    
                    // Debug pricing
                    console.log('JSON Pricing - MRP:', skus.price, 'Selling Price:', skus.discountedPrice, 'Discount:', skus.discountPercent);
                    
                    // Extract images - prioritize high quality images
                    productData.product.images = this.extractImages(skus.images || []);
                    
                    // Extract sizes/variants
                    productData.product.sizes = this.extractSizes(skus.variants || []);
                    
                    // Extract rating and reviews
                    if (skus.rating) {
                        productData.product.rating = {
                            overallRating: parseFloat(skus.rating.overallRating?.value || 0),
                            totalRatings: parseInt(skus.rating.overallRating?.ratingDisplayText?.replace(/\D/g, '') || 0),
                            totalReviews: parseInt(skus.rating.overallRating?.reviewDisplayText?.replace(/\D/g, '') || 0),
                            ratingBreakdown: skus.rating.values || []
                        };
                    }
                    
                    // Extract product description
                    productData.product.description = this.cleanDescription(skus.description?.displayText || '');
                    
                    // Extract product highlights
                    productData.product.highlights = this.extractHighlights(skus.highlights?.displayText || '');
                    
                    // Extract manufacturer information
                    if (skus.manufacturer) {
                        productData.product.manufacturer = {
                            name: skus.manufacturer.name,
                            address: skus.manufacturer.address
                        };
                    }
                    
                    // Extract marketer information
                    if (skus.marketer) {
                        productData.product.marketer = {
                            name: skus.marketer.name,
                            address: skus.marketer.address
                        };
                    }
                    
                    // Extract specifications
                    productData.product.specifications = skus.specifications || [];
                    
                    // Extract quantities available
                    productData.product.quantities = skus.quantities || [];
                    
                    // Extract availability
                    productData.product.availability = {
                        inStock: skus.inStock ? true : false,
                        status: skus.inStock ? 'In Stock' : 'Out of Stock'
                    };
                    
                    // Extract additional offers/coupons
                    if (skus.coupon) {
                        productData.product.offers = skus.coupon.values || [];
                    }
                    
                    // Extract breadcrumbs for category
                    if (preloadedState.otcPage.breadcrumbs) {
                        productData.product.category = preloadedState.otcPage.breadcrumbs.map(b => b.name);
                    }
                    
                    // Extract standard pack information
                    productData.product.standardPack = skus.standardPack || null;
                    productData.product.standardPackLabel = skus.standardPackLabel || null;
                    
                    // Extract vendor information
                    productData.product.vendorInfo = skus.vendors || null;
                    
                    // Extract tags
                    productData.product.tags = skus.tags || [];
                }
            } else {
                // If no JSON data found, try to extract from HTML
                console.log('No PRELOADED_STATE found, extracting from HTML...');
                const htmlData = this.extractFromHTML($);
                productData.product = { ...productData.product, ...htmlData };
            }

            // Fallback extraction from HTML if JSON data is not available
            if (!productData.product.title || productData.product.title === 'Unknown Product') {
                const fallbackData = this.extractFallbackData($);
                productData.product = { ...productData.product, ...fallbackData };
            }

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    extractPreloadedState($) {
        try {
            const scriptContent = $('script').filter(function() {
                return $(this).html().includes('window.PRELOADED_STATE');
            }).html();

            if (scriptContent) {
                // Extract the JSON data from the script
                const match = scriptContent.match(/window\.PRELOADED_STATE\s*=\s*(\[.*?\]);/s);
                if (match) {
                    const jsonString = match[1];
                    const data = JSON.parse(jsonString);
                    // The data is an array with a single JSON string, so we need to parse it again
                    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
                        return JSON.parse(data[0]);
                    }
                    return data[0]; // Return the first object from the array
                }
            }
            return null;
        } catch (error) {
            console.error('Error extracting PRELOADED_STATE:', error);
            return null;
        }
    }

    // Debug method to log the extracted data
    logExtractedData(preloadedState) {
        if (preloadedState && preloadedState.otcPage && preloadedState.otcPage.otcInfo) {
            console.log('Found OTC page data');
            const skus = preloadedState.otcPage.otcInfo.skus;
            if (skus) {
                console.log('Product name:', skus.name);
                console.log('Price:', skus.price);
                console.log('Discounted price:', skus.discountedPrice);
                console.log('Rating:', skus.rating);
                console.log('Images count:', skus.images ? skus.images.length : 0);
            }
        } else {
            console.log('No OTC page data found');
        }
    }

    extractBrand(productName) {
        if (!productName) return null;
        
        // Common pharmaceutical and healthcare brands
        const brands = [
            'Tynor', 'Dr. Reddy\'s', 'Cipla', 'Sun Pharma', 'Lupin', 'Glenmark',
            'Torrent', 'Cadila', 'Mankind', 'Alkem', 'Intas', 'Zydus', 'Biocon',
            'Wockhardt', 'Aurobindo', 'Divis', 'Natco', 'Hetero', 'Emcure',
            'Abbott', 'Pfizer', 'Novartis', 'GSK', 'Sanofi', 'Bayer', 'Merck',
            'Johnson & Johnson', 'Roche', 'Boehringer', 'AstraZeneca', 'Eli Lilly',
            'Bristol Myers', 'Takeda', 'Daiichi Sankyo', 'Otsuka', 'Teva',
            'Mylan', 'Sandoz', 'Actavis', 'Ranbaxy', 'Reddy\'s', 'Dr. Reddy'
        ];

        for (const brand of brands) {
            if (productName.toLowerCase().includes(brand.toLowerCase())) {
                return brand;
            }
        }
        return null;
    }

    calculateDiscount(mrp, sellingPrice) {
        if (!mrp || !sellingPrice || mrp <= sellingPrice) return 0;
        return Math.round(((mrp - sellingPrice) / mrp) * 100);
    }

    extractImages(imagesArray) {
        if (!Array.isArray(imagesArray)) return [];
        
        const images = [];
        imagesArray.forEach(img => {
            if (img.high) images.push(img.high);
            else if (img.medium) images.push(img.medium);
            else if (img.low) images.push(img.low);
            else if (img.thumbnail) images.push(img.thumbnail);
        });
        
        // Filter out non-product images and return only product images
        return images.filter(img => 
            img && 
            img.includes('onemg.gumlet.io') && 
            !img.includes('logo') && 
            !img.includes('icon') && 
            !img.includes('banner') &&
            !img.includes('marketing') &&
            !img.includes('payment')
        );
    }

    extractFromHTML($) {
        const htmlData = {};
        
        // Extract title from meta tags or headings
        const title = $('meta[property="og:title"]').attr('content') || 
                     $('h1').first().text().trim() ||
                     $('title').text().trim();
        if (title) htmlData.title = title;
        
        // Extract price information with specific selectors for 1mg
        let mrp = null, sellingPrice = null;
        
        // Look for MRP/Original price
        const mrpSelectors = [
            '.PriceDetails__mrp-div___2y8YJ',
            '.PriceDetails__mrp___2y8YJ',
            '[class*="mrp"]',
            'span:contains("MRP")',
            'div:contains("MRP")'
        ];
        
        mrpSelectors.forEach(selector => {
            if (!mrp) {
                const mrpElement = $(selector);
                if (mrpElement.length) {
                    const mrpText = mrpElement.text();
                    const mrpMatch = mrpText.match(/₹?[\d,]+/);
                    if (mrpMatch) {
                        mrp = parseInt(mrpMatch[0].replace(/[₹,]/g, ''));
                    }
                }
            }
        });
        
        // Look for selling/discounted price
        const sellingPriceSelectors = [
            '.PriceDetails__discount-div___nb724',
            '.PriceDetails__discounted-price___nb724',
            '[class*="discount-div"]',
            '[class*="discounted-price"]',
            'span:contains("Discounted Price")',
            'div:contains("Discounted Price")'
        ];
        
        sellingPriceSelectors.forEach(selector => {
            if (!sellingPrice) {
                const priceElement = $(selector);
                if (priceElement.length) {
                    const priceText = priceElement.text();
                    const priceMatch = priceText.match(/₹?[\d,]+/);
                    if (priceMatch) {
                        sellingPrice = parseInt(priceMatch[0].replace(/[₹,]/g, ''));
                    }
                }
            }
        });
        
        // Fallback: look for any price elements
        if (!sellingPrice) {
            $('[class*="price"], [class*="Price"]').each((i, el) => {
                const priceText = $(el).text();
                const prices = priceText.match(/₹?[\d,]+/g);
                if (prices && prices.length > 0) {
                    const price = parseInt(prices[0].replace(/[₹,]/g, ''));
                    if (price > 0 && price < 10000) { // Reasonable price range
                        if (!sellingPrice) {
                            sellingPrice = price;
                        } else if (!mrp && price > sellingPrice) {
                            mrp = price;
                        }
                    }
                }
            });
        }
        
        // If we have both prices, ensure MRP is higher than selling price
        if (mrp && sellingPrice && mrp < sellingPrice) {
            const temp = mrp;
            mrp = sellingPrice;
            sellingPrice = temp;
        }
        
        if (mrp) htmlData.mrp = mrp;
        if (sellingPrice) htmlData.sellingPrice = sellingPrice;
        if (mrp && sellingPrice) {
            htmlData.discount = this.calculateDiscount(mrp, sellingPrice);
        }
        
        // Extract product images - filter out non-product images
        const images = [];
        $('img').each((i, el) => {
            const src = $(el).attr('src');
            if (src && 
                !src.includes('logo') && 
                !src.includes('icon') && 
                !src.includes('banner') &&
                !src.includes('adroll') &&
                !src.includes('bing.com') &&
                !src.includes('marketing') &&
                !src.includes('payment') &&
                (src.includes('onemg.gumlet.io') || src.includes('1mg')) &&
                !images.includes(src)) {
                images.push(src);
            }
        });
        if (images.length > 0) htmlData.images = images;
        
        // Extract description
        const description = $('meta[name="description"]').attr('content') ||
                           $('.description, .product-description, [class*="description"]').text().trim();
        if (description) htmlData.description = description;
        
        // Extract rating
        const ratingText = $('[class*="rating"], [class*="star"]').text();
        if (ratingText) {
            const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
            if (ratingMatch) {
                htmlData.rating = {
                    overallRating: parseFloat(ratingMatch[1])
                };
            }
        }
        
        // Extract brand from title
        if (title) {
            htmlData.brand = this.extractBrand(title);
        }
        
        return htmlData;
    }

    extractSizes(variantsArray) {
        if (!Array.isArray(variantsArray)) return [];
        
        return variantsArray.map(variant => ({
            id: variant.id,
            name: variant.displayText,
            url: variant.url,
            available: variant.available,
            selected: variant.selected
        }));
    }

    cleanDescription(description) {
        if (!description) return null;
        
        // Remove HTML tags and clean up the text
        return description
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }

    extractHighlights(highlightsText) {
        if (!highlightsText) return [];
        
        const cleaned = this.cleanDescription(highlightsText);
        if (!cleaned) return [];
        
        // Split by bullet points or line breaks
        const highlights = cleaned
            .split(/[•\n]/)
            .map(h => h.trim())
            .filter(h => h.length > 0);
        
        return highlights;
    }

    extractFallbackData($) {
        const fallbackData = {};
        
        // Try to extract title from meta tags or headings
        const title = $('meta[property="og:title"]').attr('content') || 
                     $('h1').first().text().trim() ||
                     $('title').text().trim();
        if (title) fallbackData.title = title;
        
        // Try to extract price information
        const priceText = $('.price, .mrp, .selling-price').text();
        if (priceText) {
            const prices = priceText.match(/₹?[\d,]+/g);
            if (prices) {
                fallbackData.sellingPrice = parseInt(prices[0].replace(/[₹,]/g, ''));
                if (prices.length > 1) {
                    fallbackData.mrp = parseInt(prices[1].replace(/[₹,]/g, ''));
                }
            }
        }
        
        // Try to extract images
        const images = [];
        $('img[src*="1mg"], img[src*="onemg"]').each((i, el) => {
            const src = $(el).attr('src');
            if (src && !images.includes(src)) {
                images.push(src);
            }
        });
        if (images.length > 0) fallbackData.images = images;
        
        // Try to extract description
        const description = $('meta[name="description"]').attr('content') ||
                           $('.description, .product-description').text().trim();
        if (description) fallbackData.description = description;
        
        return fallbackData;
    }

    // Method to scrape multiple products
    async scrapeMultipleProducts(urls) {
        const results = [];
        
        for (const url of urls) {
            try {
                const productData = await this.scrapeProduct(url);
                results.push(productData);
                
                // Add delay between requests
                await this.page.waitForTimeout(2000);
            } catch (error) {
                console.error(`Error scraping ${url}:`, error);
                results.push({
                    url: url,
                    error: error.message,
                    scrapedAt: new Date().toISOString()
                });
            }
        }
        
        return results;
    }

    // Method to search products
    async searchProducts(searchQuery, limit = 10) {
        try {
            if (!this.page) {
                await this.init();
            }

            const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(searchQuery)}`;
            console.log(`Searching 1mg for: ${searchQuery}`);
            
            await this.page.goto(searchUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            await this.page.waitForTimeout(3000);

            const content = await this.page.content();
            const $ = cheerio.load(content);

            const products = [];
            
            // Extract product links from search results
            $('.product-item, .product-card, .search-product, .drug-item').slice(0, limit).each((i, el) => {
                const productLink = $(el).find('a').first().attr('href');
                if (productLink) {
                    const fullUrl = productLink.startsWith('http') ? productLink : `${this.baseUrl}${productLink}`;
                    products.push(fullUrl);
                }
            });

            return products;
        } catch (error) {
            console.error('Error searching products:', error);
            throw error;
        }
    }

    // Method to get product by category
    async getProductsByCategory(categorySlug, limit = 20) {
        try {
            if (!this.page) {
                await this.init();
            }

            const categoryUrl = `${this.baseUrl}/categories/${categorySlug}`;
            console.log(`Getting products from category: ${categorySlug}`);
            
            await this.page.goto(categoryUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            await this.page.waitForTimeout(3000);

            const content = await this.page.content();
            const $ = cheerio.load(content);

            const products = [];
            
            // Extract product links from category page
            $('.product-item, .product-card, .drug-item').slice(0, limit).each((i, el) => {
                const productLink = $(el).find('a').first().attr('href');
                if (productLink) {
                    const fullUrl = productLink.startsWith('http') ? productLink : `${this.baseUrl}${productLink}`;
                    products.push(fullUrl);
                }
            });

            return products;
        } catch (error) {
            console.error('Error getting products by category:', error);
            throw error;
        }
    }
}

module.exports = OneMgScraper;
