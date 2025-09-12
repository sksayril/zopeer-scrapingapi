const cheerio = require('cheerio');

class BibaScraper {
    constructor() {
        this.source = 'BIBA';
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
            this.extractColorsAndSizes($, productData.product);
            this.extractOffers($, productData.product);

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
        let brand = 'BIBA';
        htmlData.brand = brand;
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract selling price - look for the sales price with specific BIBA selectors
        const sellingPriceSelectors = [
            '.price .sales',
            '.sales',
            '.selling-price',
            '.offer-price',
            '.pdp-price',
            '.price-current',
            '[data-testid="selling-price"]'
        ];

        for (const selector of sellingPriceSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/₹\s*([\d,]+)/);
                if (priceMatch) {
                    sellingPrice = parseInt(priceMatch[1].replace(/,/g, ''));
                    console.log('Found selling price from', selector, ':', sellingPrice);
                    break;
                }
            }
        }

        // Extract MRP - look for the strike-through price with specific BIBA selectors
        const mrpSelectors = [
            '.price del .value',
            '.strike-through .value',
            '.mrp-text',
            '.price-mrp',
            '.original-price',
            '.pdp-mrp',
            '[data-testid="mrp"]'
        ];

        for (const selector of mrpSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/₹\s*([\d,]+)/);
                if (priceMatch) {
                    mrp = parseInt(priceMatch[1].replace(/,/g, ''));
                    console.log('Found MRP from', selector, ':', mrp);
                    break;
                }
            }
        }

        // Extract discount percentage - look for specific BIBA discount selector
        const discountSelectors = [
            '.product-discount',
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
                const discountMatch = discountText.match(/(\d+)%\s*OFF/i);
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
            const pricePattern = /₹\s*([\d,]+)/g;
            const prices = [];
            let match;
            
            while ((match = pricePattern.exec(pageText)) !== null) {
                const price = parseInt(match[1].replace(/,/g, ''));
                if (price > 0 && price < 1000000) { // Reasonable price range for fashion items
                    prices.push(price);
                }
            }
            
            if (prices.length > 0) {
                prices.sort((a, b) => a - b);
                if (!mrp) mrp = prices[prices.length - 1];
                if (!sellingPrice && prices.length > 1) sellingPrice = prices[0];
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
                if (src.includes('biba.in') || 
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

        // Extract product code
        const productCodeElement = $('.product-code, [data-testid="product-code"]');
        if (productCodeElement.length) {
            const codeText = productCodeElement.text().trim();
            const codeMatch = codeText.match(/SKDVIN\d+ESS\d+ORG/);
            if (codeMatch) {
                productDetails.productCode = codeMatch[0];
                console.log('Found product code:', productDetails.productCode);
            }
        }

        // Extract from page text
        const pageText = $('body').text();
        
        // Product code
        const codeMatch = pageText.match(/Product code[:\s]*([^.\n]+)/i);
        if (codeMatch && !productDetails.productCode) {
            productDetails.productCode = codeMatch[1].trim();
        }

        // Manufactured by
        const manufacturedMatch = pageText.match(/Manufactured By[:\s]*([^.\n]+)/i);
        if (manufacturedMatch) {
            productDetails.manufacturedBy = manufacturedMatch[1].trim();
        }

        // Country of origin
        const originMatch = pageText.match(/Country Of Origin[:\s]*([^.\n]+)/i);
        if (originMatch) {
            productDetails.countryOfOrigin = originMatch[1].trim();
        }

        // Pack contains
        const packMatch = pageText.match(/Pack Contains[:\s]*([^.\n]+)/i);
        if (packMatch) {
            productDetails.packContains = packMatch[1].trim();
        }

        // Units in a pack
        const unitsMatch = pageText.match(/Units in a Pack[:\s]*([^.\n]+)/i);
        if (unitsMatch) {
            productDetails.unitsInPack = unitsMatch[1].trim();
        }

        // Extract product features
        const features = [];
        $('.product-features li, .features li').each((i, el) => {
            const feature = $(el).text().trim();
            if (feature) {
                features.push(feature);
            }
        });
        if (features.length > 0) {
            productDetails.features = features;
        }

        // Extract wash care instructions
        const washCareMatch = pageText.match(/Wash Care[:\s]*([^.\n]+)/i);
        if (washCareMatch) {
            productDetails.washCare = washCareMatch[1].trim();
        }

        if (Object.keys(productDetails).length > 0) {
            htmlData.productDetails = productDetails;
        }
    }

    extractColorsAndSizes($, htmlData) {
        const colors = [];
        const sizes = [];

        // Extract colors
        $('.color-option, .color-selector, [data-testid="color"]').each((i, el) => {
            const colorText = $(el).text().trim();
            if (colorText && !colors.includes(colorText)) {
                colors.push(colorText);
            }
        });

        // Extract sizes from specific BIBA size selector structure
        $('.size-button .size-selector-box').each((i, el) => {
            const sizeText = $(el).text().trim();
            if (sizeText && !sizes.includes(sizeText)) {
                sizes.push(sizeText);
            }
        });

        // Fallback: Extract sizes from data attributes
        $('.size-selector-box[data-attr-value]').each((i, el) => {
            const sizeValue = $(el).attr('data-attr-value');
            if (sizeValue && !sizes.includes(sizeValue)) {
                sizes.push(sizeValue);
            }
        });

        // Fallback: Look for colors and sizes in page text
        const pageText = $('body').text();
        
        // Colors
        const colorMatch = pageText.match(/Select Color[:\s]*([^.\n]+)/i);
        if (colorMatch) {
            const colorText = colorMatch[1].trim();
            const colorList = colorText.split(/\s+/).filter(color => color.length > 1);
            colorList.forEach(color => {
                if (!colors.includes(color)) {
                    colors.push(color);
                }
            });
        }

        // Sizes
        const sizeMatch = pageText.match(/Select Size[:\s]*([^.\n]+)/i);
        if (sizeMatch) {
            const sizeText = sizeMatch[1].trim();
            const sizeList = sizeText.split(/\s+/).filter(size => size.length > 1);
            sizeList.forEach(size => {
                if (!sizes.includes(size)) {
                    sizes.push(size);
                }
            });
        }

        if (colors.length > 0) {
            htmlData.colors = colors;
        }
        if (sizes.length > 0) {
            htmlData.sizes = sizes;
        }
    }

    extractOffers($, htmlData) {
        const offers = [];

        // Extract offers from specific selectors
        $('.offer, .promotion, .discount-offer').each((i, el) => {
            const offerText = $(el).text().trim();
            if (offerText && offerText.length > 10) {
                offers.push(offerText);
            }
        });

        // Extract specific BIBA offers from page text
        const pageText = $('body').text();
        
        // FESTIVE100 offer
        const festive100Match = pageText.match(/Shop for Rs\.?\s*1999 and Get Extra 100 Off\.?\s*Code - FESTIVE100[^.]*/i);
        if (festive100Match) {
            offers.push(festive100Match[0].trim());
        }

        // FESTIVE500 offer
        const festive500Match = pageText.match(/Shop for Rs\.?\s*3499 and Get Extra 500 Off\.?\s*Code - FESTIVE500[^.]*/i);
        if (festive500Match) {
            offers.push(festive500Match[0].trim());
        }

        // FESTIVE1000 offer
        const festive1000Match = pageText.match(/Shop for Rs\.?\s*6999 and Get Extra 1000 Off\.?\s*Code - FESTIVE1000[^.]*/i);
        if (festive1000Match) {
            offers.push(festive1000Match[0].trim());
        }

        // FESTIVE1500 offer
        const festive1500Match = pageText.match(/Shop for Rs\.?\s*9999 and Get Extra 1500 Off\.?\s*Code - FESTIVE1500[^.]*/i);
        if (festive1500Match) {
            offers.push(festive1500Match[0].trim());
        }

        // Remove duplicates
        const uniqueOffers = [...new Set(offers)];
        
        if (uniqueOffers.length > 0) {
            htmlData.offers = uniqueOffers;
        }
    }
}

module.exports = BibaScraper;
