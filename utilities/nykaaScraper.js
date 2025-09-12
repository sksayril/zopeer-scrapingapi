const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class NykaaScraper {
    constructor() {
        this.baseUrl = 'https://www.nykaa.com';
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
            console.error('Error initializing Nykaa scraper:', error);
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

            console.log(`Scraping Nykaa product: ${url}`);
            
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
            console.error('Error scraping Nykaa product:', error);
            throw error;
        }
    }

    async extractProductData($, url) {
        try {
            const productData = {
                url: url,
                scrapedAt: new Date().toISOString(),
                source: 'Nykaa',
                product: {}
            };

            // Extract product title
            const title = $('h1.css-1gc4x7i').first().text().trim() || 
                         $('title').text().replace('Buy ', '').replace(' Online', '').trim();
            productData.product.title = title;

            // Extract brand from title or meta tags
            const brand = this.extractBrand(title) || 
                         $('meta[property="og:site_name"]').attr('content') || 
                         'Unknown';
            productData.product.brand = brand;

            // Extract product ID from URL or meta tags
            const productId = this.extractProductId(url) || 
                             $('meta[property="al:android:url"]').attr('content')?.match(/product_id=(\d+)/)?.[1] ||
                             'Unknown';
            productData.product.productId = productId;

            // Extract prices
            const mrp = this.extractPrice($('.css-u05rr span').text()) || 
                       this.extractPrice($('meta[property="product:price:amount"]').attr('content'));
            const sellingPrice = this.extractPrice($('.css-1jczs19').text()) || 
                               this.extractPrice($('meta[property="product:price:amount"]').attr('content'));
            
            productData.product.mrp = mrp;
            productData.product.sellingPrice = sellingPrice;
            productData.product.discount = this.calculateDiscount(mrp, sellingPrice);

            // Extract images
            const images = this.extractImages($);
            productData.product.images = images;

            // Extract sizes/variants
            const sizes = this.extractSizes($);
            productData.product.sizes = sizes;

            // Extract rating and reviews
            const rating = this.extractRating($);
            const reviews = this.extractReviews($);
            productData.product.rating = rating;
            productData.product.reviews = reviews;

            // Extract product description
            const description = this.extractDescription($);
            productData.product.description = description;

            // Extract features
            const features = this.extractFeatures($);
            productData.product.features = features;

            // Extract ingredients
            const ingredients = this.extractIngredients($);
            productData.product.ingredients = ingredients;

            // Extract category
            const category = this.extractCategory($);
            productData.product.category = category;

            // Extract availability
            const availability = this.extractAvailability($);
            productData.product.availability = availability;

            // Extract additional product details
            const additionalDetails = this.extractAdditionalDetails($);
            productData.product.additionalDetails = additionalDetails;

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    extractBrand(title) {
        if (!title) return null;
        
        // Common beauty brands on Nykaa
        const brands = [
            'L\'Oreal Paris', 'Maybelline', 'Lakme', 'Revlon', 'MAC', 'NARS', 
            'Fenty Beauty', 'Huda Beauty', 'Too Faced', 'Urban Decay', 'NYX',
            'Wet n Wild', 'Colorbar', 'Sugar', 'Faces Canada', 'Swiss Beauty',
            'Plum', 'Mamaearth', 'Wow Skin Science', 'Biotique', 'VLCC',
            'Patanjali', 'Himalaya', 'Dove', 'Pantene', 'Head & Shoulders',
            'TRESemme', 'L\'Oreal', 'Garnier', 'Schwarzkopf', 'Matrix'
        ];

        for (const brand of brands) {
            if (title.toLowerCase().includes(brand.toLowerCase())) {
                return brand;
            }
        }
        return null;
    }

    extractProductId(url) {
        const match = url.match(/\/p\/(\d+)/);
        return match ? match[1] : null;
    }

    extractPrice(priceText) {
        if (!priceText) return null;
        const match = priceText.match(/₹?[\d,]+/);
        return match ? parseInt(match[0].replace(/[₹,]/g, '')) : null;
    }

    calculateDiscount(mrp, sellingPrice) {
        if (!mrp || !sellingPrice || mrp <= sellingPrice) return 0;
        return Math.round(((mrp - sellingPrice) / mrp) * 100);
    }

    extractImages($) {
        const images = [];
        
        // Extract main product images
        $('img[alt="product-thumbnail"], img[alt="product"]').each((i, el) => {
            const src = $(el).attr('src');
            if (src && !images.includes(src)) {
                images.push(src);
            }
        });

        // Extract images from meta tags
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage && !images.includes(ogImage)) {
            images.unshift(ogImage); // Add as first image
        }

        return images;
    }

    extractSizes($) {
        const sizes = [];
        
        // Extract size options from buttons
        $('.css-1r0ze8m button').each((i, el) => {
            const sizeText = $(el).find('span').text().trim();
            if (sizeText && !sizes.includes(sizeText)) {
                sizes.push(sizeText);
            }
        });

        // Extract from select options
        $('select option').each((i, el) => {
            const sizeText = $(el).text().trim();
            if (sizeText && sizeText !== 'Select SIZE' && !sizes.includes(sizeText)) {
                sizes.push(sizeText);
            }
        });

        return sizes;
    }

    extractRating($) {
        const ratingText = $('.css-m6n3ou').text().trim();
        const match = ratingText.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
    }

    extractReviews($) {
        const reviewsText = $('.css-1hvvm95').text();
        const ratingMatch = reviewsText.match(/(\d+)\s*ratings/);
        const reviewMatch = reviewsText.match(/(\d+)\s*reviews/);
        
        return {
            totalRatings: ratingMatch ? parseInt(ratingMatch[1]) : 0,
            totalReviews: reviewMatch ? parseInt(reviewMatch[1]) : 0
        };
    }

    extractDescription($) {
        // Try to extract from meta description
        let description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content');
        
        if (description) {
            return description.replace(/Buy\s+/i, '').replace(/\s+online.*$/i, '').trim();
        }

        // Try to extract from page content
        const descElement = $('.css-1rp2t75, .product-description, .description');
        if (descElement.length) {
            return descElement.first().text().trim();
        }

        return null;
    }

    extractFeatures($) {
        const features = [];
        
        // Extract features from various sections
        $('.features, .benefits, .key-features').each((i, el) => {
            $(el).find('li, .feature-item').each((j, featureEl) => {
                const feature = $(featureEl).text().trim();
                if (feature && !features.includes(feature)) {
                    features.push(feature);
                }
            });
        });

        // Extract from product title for key features
        const title = $('h1').text();
        if (title) {
            const titleFeatures = this.extractFeaturesFromTitle(title);
            features.push(...titleFeatures);
        }

        return features;
    }

    extractFeaturesFromTitle(title) {
        const features = [];
        const featureKeywords = [
            'anti-frizz', 'moisture', 'hydrating', 'repair', 'strengthening',
            'volumizing', 'smoothing', 'color-safe', 'sulfate-free', 'paraben-free',
            'organic', 'natural', 'vitamin', 'keratin', 'argan oil', 'coconut oil',
            'hyaluronic acid', 'collagen', 'biotin', 'niacinamide', 'salicylic acid'
        ];

        featureKeywords.forEach(keyword => {
            if (title.toLowerCase().includes(keyword)) {
                features.push(keyword);
            }
        });

        return features;
    }

    extractIngredients($) {
        const ingredients = [];
        
        // Look for ingredients section
        $('.ingredients, .ingredient-list, .composition').each((i, el) => {
            const ingredientText = $(el).text().trim();
            if (ingredientText) {
                // Split by common separators
                const ingredientList = ingredientText.split(/[,;•\n]/)
                    .map(ing => ing.trim())
                    .filter(ing => ing.length > 0);
                ingredients.push(...ingredientList);
            }
        });

        return ingredients;
    }

    extractCategory($) {
        // Extract from breadcrumb
        const breadcrumbs = [];
        $('.css-1uxnb1o a').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text !== 'Home') {
                breadcrumbs.push(text);
            }
        });

        return breadcrumbs;
    }

    extractAvailability($) {
        // Check if product is in stock
        const addToBagButton = $('.css-13zjqg6, .add-to-bag, .add-to-cart');
        const isInStock = addToBagButton.length > 0 && !addToBagButton.hasClass('disabled');
        
        return {
            inStock: isInStock,
            status: isInStock ? 'In Stock' : 'Out of Stock'
        };
    }

    extractAdditionalDetails($) {
        const details = {};

        // Extract genuine product badge
        const genuineBadge = $('.css-1yzjeg6').text().trim();
        if (genuineBadge) {
            details.authenticity = genuineBadge;
        }

        // Extract delivery information
        const deliveryInfo = $('.css-1jfmtih').text().trim();
        if (deliveryInfo) {
            details.delivery = deliveryInfo;
        }

        // Extract tax information
        const taxInfo = $('.css-1rp2t75').text().trim();
        if (taxInfo) {
            details.taxInfo = taxInfo;
        }

        return details;
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
            console.log(`Searching Nykaa for: ${searchQuery}`);
            
            await this.page.goto(searchUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            await this.page.waitForTimeout(3000);

            const content = await this.page.content();
            const $ = cheerio.load(content);

            const products = [];
            
            // Extract product links from search results
            $('.product-item, .product-card, .search-product').slice(0, limit).each((i, el) => {
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
}

module.exports = NykaaScraper;
