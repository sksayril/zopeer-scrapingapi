const cheerio = require('cheerio');

class MedPlusMartScraper {
    constructor() {
        this.source = 'MedPlusMart';
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
            this.extractVariants($, productData.product);
            this.extractDescription($, productData.product);

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    extractFromHTML($, htmlData) {
        // Extract product title
        let productTitle = '';
        
        // Look for product title in h4 tag with specific MedPlusMart selectors
        const titleElement = $('h4.composition-country');
        if (titleElement.length) {
            productTitle = titleElement.text().trim();
            console.log('Found product title from h4:', productTitle);
        }

        // Fallback: Look for product title in other selectors
        if (!productTitle) {
            const fallbackSelectors = [
                'h4',
                'h1',
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
            // Extract brand from product title (usually the first word)
            const brandMatch = productTitle.match(/^([A-Z\s]+)/);
            if (brandMatch) {
                brand = brandMatch[1].trim();
            }
        }
        
        if (brand) {
            htmlData.brand = brand;
        }
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract selling price - look for the main price with specific MedPlusMart selectors
        const sellingPriceSelectors = [
            'h4 .rupee',
            '.price-current',
            '.selling-price',
            '.offer-price',
            '.pdp-price',
            '[data-testid="selling-price"]'
        ];

        for (const selector of sellingPriceSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/₹?\s*([\d,]+\.?\d*)/);
                if (priceMatch) {
                    sellingPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
                    console.log('Found selling price from', selector, ':', sellingPrice);
                    break;
                }
            }
        }

        // Alternative approach: Look for the price in h4 tag
        if (!sellingPrice) {
            const priceElement = $('h4');
            if (priceElement.length) {
                const priceText = priceElement.text();
                const priceMatch = priceText.match(/₹?\s*([\d,]+\.?\d*)/);
                if (priceMatch) {
                    sellingPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
                    console.log('Found selling price from h4:', sellingPrice);
                }
            }
        }

        // Extract MRP - look for strike-through price with specific MedPlusMart selectors
        const mrpSelectors = [
            'p .rupee strike',
            'strike.text-secondary',
            '.price-mrp',
            '.mrp',
            '.original-price',
            '[data-testid="mrp"]'
        ];

        for (const selector of mrpSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/₹?\s*([\d,]+\.?\d*)/);
                if (priceMatch) {
                    mrp = parseFloat(priceMatch[1].replace(/,/g, ''));
                    console.log('Found MRP from', selector, ':', mrp);
                    break;
                }
            }
        }

        // Alternative approach: Look for MRP in paragraph with strike
        if (!mrp) {
            const mrpElement = $('p:contains("MRP")');
            if (mrpElement.length) {
                const mrpText = mrpElement.text();
                const priceMatch = mrpText.match(/₹?\s*([\d,]+\.?\d*)/);
                if (priceMatch) {
                    mrp = parseFloat(priceMatch[1].replace(/,/g, ''));
                    console.log('Found MRP from MRP paragraph:', mrp);
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
                const discountMatch = discountText.match(/(\d+)%\s*Off/i);
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
            const pricePattern = /₹?\s*([\d,]+\.?\d*)/g;
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
                if (src.includes('medplusmart.com') || 
                    src.includes('static2.medplusmart.com') ||
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
        const urlCodeMatch = pageText.match(/_([a-zA-Z0-9]+)$/);
        if (urlCodeMatch && !productDetails.productCode) {
            productDetails.productCode = urlCodeMatch[1];
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

        // Composition
        const compositionMatch = pageText.match(/Composition[:\s]*([^.\n]+)/i);
        if (compositionMatch) {
            productDetails.composition = compositionMatch[1].trim();
        }

        // Pack size
        const packSizeMatch = pageText.match(/Pack Size[:\s]*([^.\n]+)/i);
        if (packSizeMatch) {
            productDetails.packSize = packSizeMatch[1].trim();
        }

        if (Object.keys(productDetails).length > 0) {
            htmlData.productDetails = productDetails;
        }
    }

    extractVariants($, htmlData) {
        const variants = [];

        // Extract variants from specific MedPlusMart variant structure
        $('.prod-variant .btn').each((i, el) => {
            const variantText = $(el).text().trim();
            const variantTitle = $(el).attr('title');
            
            if (variantText && !variants.includes(variantText)) {
                variants.push(variantText);
            } else if (variantTitle && !variants.includes(variantTitle)) {
                variants.push(variantTitle);
            }
        });

        // Fallback: Look for variants in page text
        const pageText = $('body').text();
        const variantMatch = pageText.match(/Other Variants[:\s]*([^.\n]+)/i);
        if (variantMatch) {
            const variantText = variantMatch[1].trim();
            const variantList = variantText.split(/\s+/).filter(variant => variant.length > 1);
            variantList.forEach(variant => {
                if (!variants.includes(variant)) {
                    variants.push(variant);
                }
            });
        }

        if (variants.length > 0) {
            htmlData.variants = variants;
        }
    }

    extractDescription($, htmlData) {
        let description = '';

        // Extract description from specific selectors
        const descriptionSelectors = [
            '.product-description',
            '.description',
            '.product-details',
            '.composition-details',
            '.product-info'
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
}

module.exports = MedPlusMartScraper;
