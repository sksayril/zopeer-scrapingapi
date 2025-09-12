const cheerio = require('cheerio');

class TruemedsScraper {
    constructor() {
        this.source = 'Truemeds';
    }

    calculateDiscount(mrp, sellingPrice) {
        if (mrp && sellingPrice && mrp > sellingPrice) {
            return ((mrp - sellingPrice) / mrp) * 100;
        }
        return 0;
    }

    async scrapeProduct(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            const productData = {
                url: null, // To be filled if scraping from live URL
                scrapedAt: new Date().toISOString(),
                source: this.source,
                product: {}
            };

            this.extractFromHTML($, productData.product);
            this.extractPricing($, productData.product);
            this.extractImages($, productData.product);
            this.extractProductDetails($, productData.product);
            this.extractHighlights($, productData.product);
            this.extractDescription($, productData.product);
            this.extractIngredients($, productData.product);
            this.extractFeatures($, productData.product);

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    extractFromHTML($, htmlData) {
        // Extract product title
        let productTitle = '';
        
        // Look for product title in h1 tag
        const titleElement = $('h1');
        if (titleElement.length) {
            productTitle = titleElement.text().trim();
            console.log('Found product title from h1:', productTitle);
        }

        // Fallback: Look for product title in other selectors
        if (!productTitle) {
            const fallbackSelectors = [
                '.product-title',
                '.product-name',
                '[data-testid="product-title"]',
                'h2',
                '.pdp-product-name'
            ];

            for (const selector of fallbackSelectors) {
                const element = $(selector);
                if (element.length) {
                    const text = element.text().trim();
                    if (text && text.length > 2) {
                        productTitle = text;
                        console.log('Found product title from fallback selector:', selector, productTitle);
                        break;
                    }
                }
            }
        }

        if (productTitle) {
            htmlData.title = productTitle;
        }

        // Extract brand information
        let brand = '';
        if (productTitle) {
            // Extract brand from product title or look for brand element
            const brandElement = $('.brand, [data-testid="brand"]');
            if (brandElement.length) {
                brand = brandElement.text().trim();
            } else {
                // Try to extract brand from title
                const brandMatch = productTitle.match(/^([A-Z\s]+)/);
                if (brandMatch) {
                    brand = brandMatch[1].trim();
                }
            }
        }
        
        if (brand) {
            htmlData.brand = brand;
        }
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract selling price - look for the main price with specific Truemeds selectors
        const sellingPriceSelectors = [
            '.medPriceWrapper .medSelling',
            '.medSelling',
            '.price-current',
            '.selling-price',
            '.offer-price',
            '.pdp-price',
            '[data-testid="selling-price"]',
            '.price'
        ];

        for (const selector of sellingPriceSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/₹\s*([\d,]+\.?\d*)/);
                if (priceMatch) {
                    sellingPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
                    console.log('Found selling price from', selector, ':', sellingPrice);
                    break;
                }
            }
        }

        // Extract MRP - look for strike-through price
        const mrpSelectors = [
            '.price-mrp',
            '.mrp',
            '.original-price',
            '[data-testid="mrp"]',
            'strike',
            'del'
        ];

        for (const selector of mrpSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/₹\s*([\d,]+\.?\d*)/);
                if (priceMatch) {
                    mrp = parseFloat(priceMatch[1].replace(/,/g, ''));
                    console.log('Found MRP from', selector, ':', mrp);
                    break;
                }
            }
        }

        // Extract discount percentage
        const discountSelectors = [
            '.discount',
            '.off-percentage',
            '.pdp-discount',
            '[data-testid="discount"]',
            '.savings'
        ];

        for (const selector of discountSelectors) {
            const element = $(selector);
            if (element.length) {
                const discountText = element.text().trim();
                const discountMatch = discountText.match(/(\d+)%\s*off/i);
                if (discountMatch) {
                    discountPercent = parseInt(discountMatch[1]);
                    console.log('Found discount percentage from', selector, ':', discountPercent);
                    break;
                }
            }
        }

        // Fallback: Look for prices in page text
        if (!sellingPrice || !mrp) {
            const pageText = $('body').text();
            const pricePattern = /₹\s*([\d,]+\.?\d*)/g;
            const prices = [];
            let match;
            
            while ((match = pricePattern.exec(pageText)) !== null) {
                const price = parseFloat(match[1].replace(/,/g, ''));
                if (price > 0 && price < 1000000) { // Reasonable price range for pharmacy items
                    prices.push(price);
                }
            }
            
            if (prices.length > 0) {
                prices.sort((a, b) => a - b);
                if (!sellingPrice) sellingPrice = prices[0];
                if (!mrp && prices.length > 1) mrp = prices[prices.length - 1];
                console.log('Found prices from page text - selling:', sellingPrice, 'mrp:', mrp);
            }
        }

        // Set the extracted values
        if (mrp) htmlData.mrp = mrp;
        if (sellingPrice) htmlData.sellingPrice = sellingPrice;
        if (discountPercent) htmlData.discountPercent = discountPercent;

        // Calculate discount amount if both prices are available
        if (mrp && sellingPrice) {
            htmlData.discount = this.calculateDiscount(mrp, sellingPrice);
        }

        console.log('Final pricing - MRP:', mrp, 'Selling Price:', sellingPrice, 'Discount:', htmlData.discount);
    }

    extractImages($, htmlData) {
        const imageUrls = [];
        
        // Extract main product images
        $('img').each((i, el) => {
            const src = $(el).attr('src');
            const alt = $(el).attr('alt') || '';
            
            if (src && !imageUrls.includes(src)) {
                // Filter for product images
                if (src.includes('truemeds.in') || 
                    src.includes('product') ||
                    (src.includes('http') && 
                     !src.includes('logo') &&
                     !src.includes('icon') &&
                     !src.includes('banner') &&
                     !src.includes('footer') &&
                     !src.includes('header') &&
                     !src.includes('placeholder'))) {
                    imageUrls.push(src);
                }
            }
        });

        htmlData.images = imageUrls;
    }

    extractProductDetails($, htmlData) {
        const productDetails = {};

        // Extract product code from URL or data attributes
        const productCodeElement = $('[data-code], [data-product-id]').first();
        if (productCodeElement.length) {
            const code = productCodeElement.attr('data-code') || productCodeElement.attr('data-product-id');
            if (code) {
                productDetails.productCode = code;
                console.log('Found product code:', productDetails.productCode);
            }
        }

        // Extract from page text
        const pageText = $('body').text();
        
        // Product code from URL pattern
        const urlCodeMatch = pageText.match(/tm-([a-zA-Z0-9]+)-(\d+)/);
        if (urlCodeMatch && !productDetails.productCode) {
            productDetails.productCode = urlCodeMatch[0];
        }

        // Manufacturer
        const manufacturerMatch = pageText.match(/Manufactured by[:\s]*([^.\n]+)/i);
        if (manufacturerMatch) {
            productDetails.manufacturer = manufacturerMatch[1].trim();
        }

        // Country of origin
        const originMatch = pageText.match(/Country of Origin[:\s]*([^.\n]+)/i);
        if (originMatch) {
            productDetails.countryOfOrigin = originMatch[1].trim();
        }

        // Pack size
        const packSizeMatch = pageText.match(/Tube of (\d+ GM)/i);
        if (packSizeMatch) {
            productDetails.packSize = packSizeMatch[1] + ' GM';
        }

        // Composition
        const compositionMatch = pageText.match(/Composition[:\s]*([^.\n]+)/i);
        if (compositionMatch) {
            productDetails.composition = compositionMatch[1].trim();
        }

        if (Object.keys(productDetails).length > 0) {
            htmlData.productDetails = productDetails;
        }
    }

    extractHighlights($, htmlData) {
        const highlights = [];

        // Extract highlights from specific Truemeds selectors
        $('.sc-d35a0e71-0 .content ul li span, .product-highlights li, .highlights li, .benefits li').each((i, el) => {
            const highlight = $(el).text().trim();
            if (highlight && highlight.length > 5) {
                highlights.push(highlight);
            }
        });

        // Alternative: Extract from the specific structure you provided
        $('#introduction + .content ul li span').each((i, el) => {
            const highlight = $(el).text().trim();
            if (highlight && highlight.length > 5 && !highlights.includes(highlight)) {
                highlights.push(highlight);
            }
        });

        // Fallback: Look for highlights in page text
        const pageText = $('body').text();
        const highlightsMatch = pageText.match(/Product Highlights[:\s]*([^.\n]+)/i);
        if (highlightsMatch) {
            const highlightsText = highlightsMatch[1].trim();
            const highlightsList = highlightsText.split(/\s+/).filter(highlight => highlight.length > 5);
            highlightsList.forEach(highlight => {
                if (!highlights.includes(highlight)) {
                    highlights.push(highlight);
                }
            });
        }

        if (highlights.length > 0) {
            htmlData.highlights = highlights;
        }
    }

    extractDescription($, htmlData) {
        let description = '';

        // Extract description from specific selectors
        const descriptionSelectors = [
            '.product-description',
            '.description',
            '.product-details',
            '.product-info',
            '.about-product'
        ];

        for (const selector of descriptionSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                if (text && text.length > 10) {
                    description = text;
                    console.log('Found description from', selector, ':', description);
                    break;
                }
            }
        }

        // Fallback: Look for description in page text
        if (!description) {
            const pageText = $('body').text();
            
            // Look for common description patterns
            const descPatterns = [
                /Description[:\s]*([^.\n]+)/i,
                /About[:\s]*([^.\n]+)/i,
                /Details[:\s]*([^.\n]+)/i,
                /Information[:\s]*([^.\n]+)/i
            ];

            for (const pattern of descPatterns) {
                const match = pageText.match(pattern);
                if (match && match[1].trim().length > 10) {
                    description = match[1].trim();
                    console.log('Found description from page text:', description);
                    break;
                }
            }
        }

        if (description) {
            htmlData.description = description;
        }
    }

    extractIngredients($, htmlData) {
        let ingredients = '';

        // Extract ingredients from specific selectors
        const ingredientsSelectors = [
            '.ingredients',
            '.composition',
            '.active-ingredients',
            '.product-composition'
        ];

        for (const selector of ingredientsSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                if (text && text.length > 5) {
                    ingredients = text;
                    console.log('Found ingredients from', selector, ':', ingredients);
                    break;
                }
            }
        }

        // Fallback: Look for ingredients in page text
        if (!ingredients) {
            const pageText = $('body').text();
            
            // Look for ingredients patterns
            const ingredientsPatterns = [
                /Ingredients[:\s]*([^.\n]+)/i,
                /Composition[:\s]*([^.\n]+)/i,
                /Active Ingredients[:\s]*([^.\n]+)/i
            ];

            for (const pattern of ingredientsPatterns) {
                const match = pageText.match(pattern);
                if (match && match[1].trim().length > 5) {
                    ingredients = match[1].trim();
                    console.log('Found ingredients from page text:', ingredients);
                    break;
                }
            }
        }

        if (ingredients) {
            htmlData.ingredients = ingredients;
        }
    }

    extractFeatures($, htmlData) {
        const features = [];

        // Extract features from specific selectors
        $('.features li, .product-features li, .specifications li').each((i, el) => {
            const feature = $(el).text().trim();
            if (feature && feature.length > 5) {
                features.push(feature);
            }
        });

        // Fallback: Look for features in page text
        const pageText = $('body').text();
        const featuresMatch = pageText.match(/Features[:\s]*([^.\n]+)/i);
        if (featuresMatch) {
            const featuresText = featuresMatch[1].trim();
            const featuresList = featuresText.split(/\s+/).filter(feature => feature.length > 5);
            featuresList.forEach(feature => {
                if (!features.includes(feature)) {
                    features.push(feature);
                }
            });
        }

        if (features.length > 0) {
            htmlData.features = features;
        }
    }
}

module.exports = TruemedsScraper;
