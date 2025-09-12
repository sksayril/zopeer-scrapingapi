const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

/**
 * Vijay Sales Product Scraper
 * Comprehensive scraper for extracting product information from Vijay Sales product pages
 */
class VijaySalesScraper {
    constructor() {
        this.baseUrl = 'https://www.vijaysales.com';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }

    /**
     * Scrape product information from HTML content
     * @param {string} htmlContent - HTML content of the product page
     * @param {string} productUrl - URL of the product page
     * @returns {Object} Extracted product information
     */
    async scrapeProduct(htmlContent, productUrl = '') {
        try {
            const $ = cheerio.load(htmlContent);
            
            const productData = {
                // Basic Information
                name: this.extractProductName($),
                brand: this.extractBrand($),
                model: this.extractModel($),
                sku: this.extractSKU($),
                category: this.extractCategory($),
                subcategory: this.extractSubcategory($),
                
                // Pricing Information
                currentPrice: this.extractCurrentPrice($),
                originalPrice: this.extractOriginalPrice($),
                discount: this.extractDiscount($),
                discountPercentage: this.extractDiscountPercentage($),
                emiOptions: this.extractEMIOptions($),
                
                // Ratings and Reviews
                rating: this.extractRating($),
                reviewCount: this.extractReviewCount($),
                ratingCount: this.extractRatingCount($),
                
                // Product Images
                images: this.extractImages($),
                mainImage: this.extractMainImage($),
                
                // Product Features and Specifications
                features: this.extractFeatures($),
                specifications: this.extractSpecifications($),
                description: this.extractDescription($),
                
                // Offers and Deals
                offers: this.extractOffers($),
                coupons: this.extractCoupons($),
                deals: this.extractDeals($),
                
                // Availability and Shipping
                availability: this.extractAvailability($),
                shippingInfo: this.extractShippingInfo($),
                
                // Additional Information
                loyaltyPoints: this.extractLoyaltyPoints($),
                warranty: this.extractWarranty($),
                seller: this.extractSeller($),
                
                // Technical Details
                breadcrumbs: this.extractBreadcrumbs($),
                productUrl: productUrl,
                scrapedAt: new Date().toISOString()
            };

            return productData;
        } catch (error) {
            console.error('Error scraping Vijay Sales product:', error);
            throw new Error(`Failed to scrape product: ${error.message}`);
        }
    }

    /**
     * Extract product name
     */
    extractProductName($) {
        try {
            // Try multiple selectors for product name
            let name = $('h1.productFullDetail__productName span[role="name"]').text().trim();
            
            if (!name) {
                name = $('h1.productFullDetail__productName').text().trim();
            }
            
            if (!name) {
                name = $('.product__title h1').text().trim();
            }
            
            if (!name) {
                name = $('span[itemprop="name"]').text().trim();
            }
            
            return name || 'Product name not found';
        } catch (error) {
            console.error('Error extracting product name:', error);
            return 'Product name not found';
        }
    }

    /**
     * Extract brand information
     */
    extractBrand($) {
        try {
            const name = this.extractProductName($);
            const brandMatch = name.match(/^([A-Za-z\s]+)/);
            return brandMatch ? brandMatch[1].trim() : 'Brand not specified';
        } catch (error) {
            console.error('Error extracting brand:', error);
            return 'Brand not specified';
        }
    }

    /**
     * Extract model information
     */
    extractModel($) {
        try {
            const name = this.extractProductName($);
            const modelMatch = name.match(/\(([^)]+)\)/);
            return modelMatch ? modelMatch[1].trim() : 'Model not specified';
        } catch (error) {
            console.error('Error extracting model:', error);
            return 'Model not specified';
        }
    }

    /**
     * Extract SKU
     */
    extractSKU($) {
        try {
            let sku = $('input[name="parentSku"]').val();
            
            if (!sku) {
                sku = $('strong[role="sku"]').text().trim();
            }
            
            if (!sku) {
                sku = $('[data-product-sku]').attr('data-product-sku');
            }
            
            return sku || 'SKU not found';
        } catch (error) {
            console.error('Error extracting SKU:', error);
            return 'SKU not found';
        }
    }

    /**
     * Extract category from breadcrumbs
     */
    extractCategory($) {
        try {
            const breadcrumbs = this.extractBreadcrumbs($);
            return breadcrumbs.length > 1 ? breadcrumbs[1] : 'Category not found';
        } catch (error) {
            console.error('Error extracting category:', error);
            return 'Category not found';
        }
    }

    /**
     * Extract subcategory from breadcrumbs
     */
    extractSubcategory($) {
        try {
            const breadcrumbs = this.extractBreadcrumbs($);
            return breadcrumbs.length > 2 ? breadcrumbs[2] : 'Subcategory not found';
        } catch (error) {
            console.error('Error extracting subcategory:', error);
            return 'Subcategory not found';
        }
    }

    /**
     * Extract current/selling price
     */
    extractCurrentPrice($) {
        try {
            let price = $('.product__price--price[data-final-price]').attr('data-final-price');
            
            if (!price) {
                price = $('.product__price--price').text().replace(/[₹,]/g, '').trim();
            }
            
            if (!price) {
                price = $('[data-final-price]').attr('data-final-price');
            }
            
            // Try alternative selectors for live site
            if (!price) {
                price = $('.price').text().replace(/[₹,]/g, '').trim();
            }
            
            if (!price) {
                price = $('[class*="price"]').text().replace(/[₹,]/g, '').trim();
            }
            
            // Extract from JSON data if available
            if (!price) {
                const priceData = $('script[type="application/ld+json"]').text();
                if (priceData) {
                    try {
                        const jsonData = JSON.parse(priceData);
                        if (jsonData.offers && jsonData.offers.price) {
                            price = jsonData.offers.price;
                        }
                    } catch (e) {
                        // Ignore JSON parsing errors
                    }
                }
            }
            
            return price ? parseInt(price) : null;
        } catch (error) {
            console.error('Error extracting current price:', error);
            return null;
        }
    }

    /**
     * Extract original/MRP price
     */
    extractOriginalPrice($) {
        try {
            let price = $('.product__price--mrp span[data-mrp]').attr('data-mrp');
            
            if (!price) {
                price = $('.product__price--mrp span').text().replace(/[₹,]/g, '').trim();
            }
            
            return price ? parseInt(price) : null;
        } catch (error) {
            console.error('Error extracting original price:', error);
            return null;
        }
    }

    /**
     * Extract discount amount
     */
    extractDiscount($) {
        try {
            const currentPrice = this.extractCurrentPrice($);
            const originalPrice = this.extractOriginalPrice($);
            
            if (currentPrice && originalPrice) {
                return originalPrice - currentPrice;
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting discount:', error);
            return null;
        }
    }

    /**
     * Extract discount percentage
     */
    extractDiscountPercentage($) {
        try {
            let discount = $('.product__price--discount-label').text().trim();
            
            if (discount) {
                const match = discount.match(/(\d+)%/);
                return match ? parseInt(match[1]) : null;
            }
            
            // Calculate from prices
            const currentPrice = this.extractCurrentPrice($);
            const originalPrice = this.extractOriginalPrice($);
            
            if (currentPrice && originalPrice) {
                return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting discount percentage:', error);
            return null;
        }
    }

    /**
     * Extract EMI options
     */
    extractEMIOptions($) {
        try {
            const emiText = $('.product__price--emi-text span').text().trim();
            const emiOptions = [];
            
            if (emiText) {
                emiOptions.push({
                    amount: emiText,
                    description: 'EMI starting from'
                });
            }
            
            // Extract EMI table data if available
            $('.accordion-panel-emi-options table tbody tr').each((index, element) => {
                const $row = $(element);
                const bank = $row.find('td:first h3').text().trim();
                const emiType = $row.find('td:nth-child(2) h3').text().trim();
                const emiPlan = $row.find('td:nth-child(3) h3 span').text().trim();
                const interest = $row.find('td:nth-child(4) h5').text().trim();
                const emiAmount = $row.find('td:nth-child(5) h5').text().trim();
                
                if (bank && emiAmount) {
                    emiOptions.push({
                        bank,
                        emiType,
                        emiPlan,
                        interest,
                        emiAmount
                    });
                }
            });
            
            return emiOptions;
        } catch (error) {
            console.error('Error extracting EMI options:', error);
            return [];
        }
    }

    /**
     * Extract product rating
     */
    extractRating($) {
        try {
            let rating = $('.product__title--reviews-star').attr('data-rating-summary');
            
            if (!rating) {
                rating = $('.product__title--reviews-star').attr('style');
                const match = rating ? rating.match(/--rating:\s*([0-9.]+)/) : null;
                rating = match ? parseFloat(match[1]) : null;
            } else {
                rating = parseFloat(rating);
            }
            
            // Try alternative selectors
            if (!rating) {
                rating = $('.rating').text().trim();
                const match = rating.match(/([0-9.]+)/);
                rating = match ? parseFloat(match[1]) : null;
            }
            
            if (!rating) {
                rating = $('[class*="rating"]').text().trim();
                const match = rating.match(/([0-9.]+)/);
                rating = match ? parseFloat(match[1]) : null;
            }
            
            // Extract from JSON data
            if (!rating) {
                const jsonScripts = $('script[type="application/ld+json"]');
                jsonScripts.each((index, script) => {
                    try {
                        const jsonData = JSON.parse($(script).text());
                        if (jsonData.aggregateRating && jsonData.aggregateRating.ratingValue) {
                            rating = parseFloat(jsonData.aggregateRating.ratingValue);
                            return false; // Break the loop
                        }
                    } catch (e) {
                        // Ignore JSON parsing errors
                    }
                });
            }
            
            return rating || null;
        } catch (error) {
            console.error('Error extracting rating:', error);
            return null;
        }
    }

    /**
     * Extract review count
     */
    extractReviewCount($) {
        try {
            const reviewText = $('.product__title--stats span').text().trim();
            const match = reviewText.match(/(\d+)\s*Reviews/);
            return match ? parseInt(match[1]) : null;
        } catch (error) {
            console.error('Error extracting review count:', error);
            return null;
        }
    }

    /**
     * Extract rating count
     */
    extractRatingCount($) {
        try {
            const ratingText = $('.product__title--stats span').text().trim();
            const match = ratingText.match(/(\d+)\s*Ratings/);
            return match ? parseInt(match[1]) : null;
        } catch (error) {
            console.error('Error extracting rating count:', error);
            return null;
        }
    }

    /**
     * Extract product images
     */
    extractImages($) {
        try {
            const images = [];
            
            // Extract from gallery data
            const galleryData = $('.carousel__root').attr('data-gallery-items');
            if (galleryData) {
                try {
                    const galleryItems = JSON.parse(galleryData);
                    galleryItems.forEach(item => {
                        if (item.url) {
                            images.push({
                                url: item.url,
                                alt: item.label || '',
                                position: item.position || 0
                            });
                        }
                    });
                } catch (e) {
                    console.error('Error parsing gallery data:', e);
                }
            }
            
            // Extract from thumbnail images
            $('.thumbnail__image').each((index, element) => {
                const $img = $(element);
                const src = $img.attr('src');
                const alt = $img.attr('alt');
                
                if (src && !images.find(img => img.url === src)) {
                    images.push({
                        url: src,
                        alt: alt || '',
                        position: index
                    });
                }
            });
            
            return images;
        } catch (error) {
            console.error('Error extracting images:', error);
            return [];
        }
    }

    /**
     * Extract main product image
     */
    extractMainImage($) {
        try {
            const images = this.extractImages($);
            return images.length > 0 ? images[0].url : null;
        } catch (error) {
            console.error('Error extracting main image:', error);
            return null;
        }
    }

    /**
     * Extract product features
     */
    extractFeatures($) {
        try {
            const features = [];
            
            // Extract from key features section - handle both separate li elements and inline HTML
            const keyFeaturesList = $('.product__keyfeatures--list');
            if (keyFeaturesList.length > 0) {
                // First try to get individual li elements
                keyFeaturesList.find('li').each((index, element) => {
                    const featureText = $(element).text().trim();
                    if (featureText) {
                        features.push(featureText);
                    }
                });
                
                // If no individual li elements found, try to parse the HTML content directly
                if (features.length === 0) {
                    const htmlContent = keyFeaturesList.html();
                    if (htmlContent) {
                        // Split by </li><li> pattern to extract individual features
                        const featureMatches = htmlContent.match(/<li[^>]*>(.*?)<\/li>/g);
                        if (featureMatches) {
                            featureMatches.forEach(match => {
                                const cleanText = match.replace(/<[^>]*>/g, '').trim();
                                if (cleanText) {
                                    features.push(cleanText);
                                }
                            });
                        }
                    }
                }
            }
            
            // Extract from features section
            $('.productfeatures .title h2').each((index, element) => {
                if ($(element).text().trim() === 'Features') {
                    const $featureSection = $(element).closest('.productfeatures');
                    $featureSection.find('ul li, .feature-item, .product-feature').each((i, feature) => {
                        const featureText = $(feature).text().trim();
                        if (featureText) {
                            features.push(featureText);
                        }
                    });
                }
            });
            
            // Try alternative selectors for live site
            if (features.length === 0) {
                $('[class*="feature"] li, [class*="feature"] p, [class*="feature"] div').each((index, element) => {
                    const featureText = $(element).text().trim();
                    if (featureText && featureText.length > 10 && !featureText.includes('Show all')) {
                        features.push(featureText);
                    }
                });
            }
            
            // Extract from product description
            const description = this.extractDescription($);
            if (description) {
                const featureMatches = description.match(/<b>([^<]+):<\/b>\s*([^<]+)/g);
                if (featureMatches) {
                    featureMatches.forEach(match => {
                        const cleanMatch = match.replace(/<[^>]*>/g, '').trim();
                        if (cleanMatch) {
                            features.push(cleanMatch);
                        }
                    });
                }
            }
            
            // Extract from bullet points or lists
            if (features.length === 0) {
                $('ul li, ol li').each((index, element) => {
                    const featureText = $(element).text().trim();
                    if (featureText && featureText.length > 10 && featureText.includes(':')) {
                        features.push(featureText);
                    }
                });
            }
            
            return features;
        } catch (error) {
            console.error('Error extracting features:', error);
            return [];
        }
    }

    /**
     * Extract product specifications
     */
    extractSpecifications($) {
        try {
            const specifications = {};
            
            // Extract from accordion panels
            $('.accordion-panel ul li').each((index, element) => {
                const $li = $(element);
                const key = $li.find('.panel-list-key').text().trim();
                const value = $li.find('.panel-list-value').text().trim();
                
                if (key && value) {
                    specifications[key] = value;
                }
            });
            
            // Look for specification tables
            $('table.specifications, .specifications table, .product-specs table').each((index, table) => {
                $(table).find('tr').each((i, row) => {
                    const $row = $(row);
                    const key = $row.find('td:first, th:first').text().trim();
                    const value = $row.find('td:last, th:last').text().trim();
                    
                    if (key && value) {
                        specifications[key] = value;
                    }
                });
            });
            
            // Try alternative selectors for live site
            if (Object.keys(specifications).length === 0) {
                $('table tr').each((index, row) => {
                    const $row = $(row);
                    const cells = $row.find('td, th');
                    if (cells.length >= 2) {
                        const key = $(cells[0]).text().trim();
                        const value = $(cells[1]).text().trim();
                        if (key && value && key !== value) {
                            specifications[key] = value;
                        }
                    }
                });
            }
            
            // Extract from any key-value pairs
            if (Object.keys(specifications).length === 0) {
                $('[class*="spec"], [class*="detail"]').each((index, element) => {
                    const text = $(element).text().trim();
                    if (text.includes(':')) {
                        const parts = text.split(':');
                        if (parts.length === 2) {
                            const key = parts[0].trim();
                            const value = parts[1].trim();
                            if (key && value) {
                                specifications[key] = value;
                            }
                        }
                    }
                });
            }
            
            return specifications;
        } catch (error) {
            console.error('Error extracting specifications:', error);
            return {};
        }
    }

    /**
     * Extract product description
     */
    extractDescription($) {
        try {
            let description = $('.productFullDetail__description .richText__root').html();
            
            if (!description) {
                description = $('.product-description, .description').html();
            }
            
            if (!description) {
                // Try to extract from variant data
                const variantData = $('[data-variants]').attr('data-variants');
                if (variantData) {
                    try {
                        const variants = JSON.parse(variantData);
                        if (variants[0] && variants[0].description) {
                            description = variants[0].description;
                        }
                    } catch (e) {
                        console.error('Error parsing variant data:', e);
                    }
                }
            }
            
            // Extract from product specification title
            if (!description) {
                const specTitle = $('#product-specification-title p').text().trim();
                if (specTitle) {
                    description = specTitle;
                }
            }
            
            return description || null;
        } catch (error) {
            console.error('Error extracting description:', error);
            return null;
        }
    }

    /**
     * Extract offers and deals
     */
    extractOffers($) {
        try {
            const offers = [];
            
            // Extract coupon offers
            $('.product__tags--label').each((index, element) => {
                const offerText = $(element).text().trim();
                if (offerText && offerText !== 'Coupons') {
                    if (offerText.includes('Coupon')) {
                        offers.push({
                            type: 'coupon',
                            description: offerText
                        });
                    } else if (offerText.includes('off') || offerText.includes('%')) {
                        offers.push({
                            type: 'discount',
                            description: offerText
                        });
                    } else if (offerText.includes('Rs') || offerText.includes('₹')) {
                        offers.push({
                            type: 'cashback',
                            description: offerText
                        });
                    } else {
                        offers.push({
                            type: 'offer',
                            description: offerText
                        });
                    }
                }
            });
            
            // Extract deal tags
            $('.product__tags--dealsoftheday').each((index, element) => {
                const dealText = $(element).text().trim();
                if (dealText) {
                    offers.push({
                        type: 'deal',
                        description: dealText
                    });
                }
            });
            
            // Extract from tabs (Offer 1, Offer 2, etc.) - but only if they have actual content
            $('.cmp-tabs__tab').each((index, element) => {
                const tabText = $(element).text().trim();
                if (tabText && tabText.includes('Offer')) {
                    // Check if the tab panel has actual content
                    const tabId = $(element).attr('aria-controls');
                    if (tabId) {
                        const tabPanel = $('#' + tabId);
                        const panelContent = tabPanel.text().trim();
                        if (panelContent && panelContent.length > 10) {
                            offers.push({
                                type: 'tab_offer',
                                description: tabText,
                                content: panelContent
                            });
                        }
                    }
                }
            });
            
            return offers;
        } catch (error) {
            console.error('Error extracting offers:', error);
            return [];
        }
    }

    /**
     * Extract coupons
     */
    extractCoupons($) {
        try {
            const coupons = [];
            
            $('.product__tags--label').each((index, element) => {
                const couponText = $(element).text().trim();
                if (couponText && couponText.includes('Coupon') && couponText !== 'Coupons') {
                    coupons.push(couponText);
                }
            });
            
            // Also extract from any other coupon-related elements
            $('[class*="coupon"], [id*="coupon"]').each((index, element) => {
                const couponText = $(element).text().trim();
                if (couponText && couponText.includes('Coupon') && couponText !== 'Coupons') {
                    coupons.push(couponText);
                }
            });
            
            // Extract from offer tabs that might contain coupon information
            $('.cmp-tabs__tabpanel').each((index, element) => {
                const panelText = $(element).text().trim();
                if (panelText && panelText.includes('Coupon')) {
                    // Extract coupon information from panel content
                    const couponMatches = panelText.match(/[₹Rs]\s*[\d,]+[^.]*Coupon/g);
                    if (couponMatches) {
                        couponMatches.forEach(match => {
                            coupons.push(match.trim());
                        });
                    }
                }
            });
            
            return coupons;
        } catch (error) {
            console.error('Error extracting coupons:', error);
            return [];
        }
    }

    /**
     * Extract deals
     */
    extractDeals($) {
        try {
            const deals = [];
            
            $('.product__tags--dealsoftheday').each((index, element) => {
                const dealText = $(element).text().trim();
                if (dealText) {
                    deals.push(dealText);
                }
            });
            
            // Extract from tabs
            $('.cmp-tabs__tab').each((index, element) => {
                const tabText = $(element).text().trim();
                if (tabText && tabText.includes('Offer')) {
                    deals.push(tabText);
                }
            });
            
            // Extract from any other deal-related elements
            $('[class*="deal"], [id*="deal"]').each((index, element) => {
                const dealText = $(element).text().trim();
                if (dealText && (dealText.includes('deal') || dealText.includes('offer'))) {
                    deals.push(dealText);
                }
            });
            
            return deals;
        } catch (error) {
            console.error('Error extracting deals:', error);
            return [];
        }
    }

    /**
     * Extract availability information
     */
    extractAvailability($) {
        try {
            const inStock = $('[data-variants]').attr('data-variants');
            if (inStock) {
                try {
                    const variants = JSON.parse(inStock);
                    return variants[0] && variants[0].inStock ? 'In Stock' : 'Out of Stock';
                } catch (e) {
                    console.error('Error parsing availability:', e);
                }
            }
            
            return 'Availability not specified';
        } catch (error) {
            console.error('Error extracting availability:', error);
            return 'Availability not specified';
        }
    }

    /**
     * Extract shipping information
     */
    extractShippingInfo($) {
        try {
            const shippingInfo = [];
            
            $('.shipping-info, .delivery-info').each((index, element) => {
                const info = $(element).text().trim();
                if (info) {
                    shippingInfo.push(info);
                }
            });
            
            return shippingInfo;
        } catch (error) {
            console.error('Error extracting shipping info:', error);
            return [];
        }
    }

    /**
     * Extract loyalty points
     */
    extractLoyaltyPoints($) {
        try {
            const pointsText = $('.product__price--loyalty b').text().trim();
            return pointsText ? parseInt(pointsText) : null;
        } catch (error) {
            console.error('Error extracting loyalty points:', error);
            return null;
        }
    }

    /**
     * Extract warranty information
     */
    extractWarranty($) {
        try {
            let warrantyText = $('.warranty-info, .product-warranty').text().trim();
            
            if (!warrantyText) {
                // Extract from product extra details
                const warrantyTitle = $('#warranty_title').text().trim();
                const warrantySubtitle = $('.product__warranty_info-text span').text().trim();
                const warrantyTooltip = $('#services__tooltip').text().trim();
                
                if (warrantyTitle || warrantySubtitle || warrantyTooltip) {
                    warrantyText = `${warrantyTitle} ${warrantySubtitle} ${warrantyTooltip}`.trim();
                }
            }
            
            return warrantyText || null;
        } catch (error) {
            console.error('Error extracting warranty:', error);
            return null;
        }
    }

    /**
     * Extract seller information
     */
    extractSeller($) {
        try {
            const sellerLink = $('.product__title--store-link').attr('href');
            const sellerText = $('.product__title--store-link').text().trim();
            
            return {
                name: sellerText || 'Vijay Sales',
                link: sellerLink || null
            };
        } catch (error) {
            console.error('Error extracting seller:', error);
            return {
                name: 'Vijay Sales',
                link: null
            };
        }
    }

    /**
     * Extract breadcrumbs
     */
    extractBreadcrumbs($) {
        try {
            const breadcrumbs = [];
            
            $('.cmp-breadcrumb__item span[itemprop="name"]').each((index, element) => {
                const breadcrumb = $(element).text().trim();
                if (breadcrumb) {
                    breadcrumbs.push(breadcrumb);
                }
            });
            
            return breadcrumbs;
        } catch (error) {
            console.error('Error extracting breadcrumbs:', error);
            return [];
        }
    }

    /**
     * Scrape product from file
     * @param {string} filePath - Path to HTML file
     * @param {string} productUrl - URL of the product
     * @returns {Object} Extracted product information
     */
    async scrapeFromFile(filePath, productUrl = '') {
        try {
            const htmlContent = fs.readFileSync(filePath, 'utf8');
            return await this.scrapeProduct(htmlContent, productUrl);
        } catch (error) {
            console.error('Error reading file:', error);
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    /**
     * Save scraped data to JSON file
     * @param {Object} productData - Scraped product data
     * @param {string} outputPath - Output file path
     */
    async saveToFile(productData, outputPath) {
        try {
            const jsonData = JSON.stringify(productData, null, 2);
            fs.writeFileSync(outputPath, jsonData, 'utf8');
            console.log(`Product data saved to: ${outputPath}`);
        } catch (error) {
            console.error('Error saving file:', error);
            throw new Error(`Failed to save file: ${error.message}`);
        }
    }
}

module.exports = VijaySalesScraper;
