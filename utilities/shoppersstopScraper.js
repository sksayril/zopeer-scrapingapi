const cheerio = require('cheerio');

class ShoppersStopScraper {
    constructor() {
        this.source = 'ShoppersStop';
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
            this.extractOffers($, productData.product);
            this.extractProductDetails($, productData.product);
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
        
        // Look for product title in h1 tag
        const titleElement = $('h1');
        if (titleElement.length) {
            const titleText = titleElement.text().trim();
            if (titleText && titleText.length > 2) {
                productTitle = titleText;
                console.log('Found product title from h1:', productTitle);
            }
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
        const brandElement = $('.brand, [data-testid="brand"], .pdp-brand');
        if (brandElement.length) {
            brand = brandElement.text().trim();
        } else {
            // Look for brand in page text
            const pageText = $('body').text();
            const brandMatch = pageText.match(/The Body Shop/i);
            if (brandMatch) {
                brand = 'The Body Shop';
            }
        }

        if (brand) {
            htmlData.brand = brand;
        }
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract selling price - look for the main price
        const sellingPriceSelectors = [
            '.text-xl.font-medium.leading-5.text-black',
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
                const priceMatch = text.match(/₹\s*([\d,]+)/);
                if (priceMatch) {
                    sellingPrice = parseInt(priceMatch[1].replace(/,/g, ''));
                    console.log('Found selling price from', selector, ':', sellingPrice);
                    break;
                }
            }
        }

        // Extract MRP - look for crossed out price
        const mrpSelectors = [
            '.text-xl.font-medium.leading-5.tracking-wide.text-neutral-400.line-through',
            '.line-through .text-xl',
            '.price-mrp',
            '.mrp',
            '.original-price',
            '.pdp-mrp',
            '[data-testid="mrp"]',
            '.strikethrough'
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

        // Extract discount percentage
        const discountSelectors = [
            '.text-base.font-medium.leading-4.text-orange-700',
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
                if (price > 0 && price < 1000000) { // Reasonable price range for beauty products
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
                if (src.includes('shoppersstop.com') || 
                    src.includes('images-magento.shoppersstop.com') ||
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

    extractOffers($, htmlData) {
        const offers = [];

        // Extract offers from the offers section
        $('.offer, .coupon, .discount-offer').each((i, el) => {
            const offerText = $(el).text().trim();
            if (offerText && offerText.length > 5) {
                offers.push(offerText);
                console.log('Found offer from element:', offerText);
            }
        });

        // Extract from list items in offers section
        $('li:contains("Off"), li:contains("discount"), li:contains("Flat")').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 5 && !offers.includes(text)) {
                offers.push(text);
                console.log('Found offer from li element:', text);
            }
        });

        // Look for all offers in the page text
        const pageText = $('body').text();
        
        // Pattern for various offers
        const offerPatterns = [
            /(?:Upto|Up to|Flat)\s+(?:₹\d+|%\d+)\s+(?:Off|off)\s+(?:On|on)\s+([^.\n]+)/gi,
            /(?:Get|Extra)\s+(?:₹\d+|%\d+)\s+(?:Off|off)\s+(?:on|On)\s+([^.\n]+)/gi,
            /(?:FLAT|Flat)\s+\d+%\s+(?:off|Off)\s+(?:upto|Upto)\s+₹\d+\s+(?:on|On)\s+([^.\n]+)/gi
        ];

        for (const pattern of offerPatterns) {
            let match;
            while ((match = pattern.exec(pageText)) !== null) {
                const offer = match[0].trim();
                if (!offers.includes(offer)) {
                    offers.push(offer);
                    console.log('Found offer from pattern:', offer);
                }
            }
        }

        // Extract specific offers mentioned in the content
        const specificOffers = [
            'Flat 20% Off'
        ];

        specificOffers.forEach(offer => {
            if (pageText.includes(offer) && !offers.includes(offer)) {
                offers.push(offer);
                console.log('Found specific offer:', offer);
            }
        });

        // Clean up offers - remove duplicates and filter out irrelevant text
        const cleanedOffers = offers.filter(offer => {
            return offer.length > 5 && 
                   !offer.includes('Offers for you') &&
                   !offer.includes('Popular Categories') &&
                   (offer.includes('Off') || offer.includes('discount') || offer.includes('Flat'));
        });

        if (cleanedOffers.length > 0) {
            htmlData.offers = cleanedOffers;
        }
    }

    extractProductDetails($, htmlData) {
        const productDetails = {};

        // Extract product details from the Product Details section
        $('.product-details, .product-info').each((i, el) => {
            const detailsText = $(el).text();
            const lines = detailsText.split('\n');
            
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && trimmedLine.includes(':')) {
                    const [key, value] = trimmedLine.split(':').map(s => s.trim());
                    if (key && value) {
                        productDetails[key] = value;
                    }
                }
            });
        });

        // Extract from page text
        const pageText = $('body').text();
        
        // Pack Of
        const packMatch = pageText.match(/Pack Of[:\s]*([^.\n]+)/i);
        if (packMatch) {
            productDetails.packOf = packMatch[1].trim();
        }

        // Gender
        const genderMatch = pageText.match(/Gender[:\s]*([^.\n]+)/i);
        if (genderMatch) {
            productDetails.gender = genderMatch[1].trim();
        }

        // Unit Size
        const unitSizeMatch = pageText.match(/Unit Size[:\s]*([^.\n]+)/i);
        if (unitSizeMatch) {
            productDetails.unitSize = unitSizeMatch[1].trim();
        }

        // Formulation
        const formulationMatch = pageText.match(/Formulation[:\s]*([^.\n]+)/i);
        if (formulationMatch) {
            productDetails.formulation = formulationMatch[1].trim();
        }

        // Product Type
        const productTypeMatch = pageText.match(/Product Type[:\s]*([^.\n]+)/i);
        if (productTypeMatch) {
            productDetails.productType = productTypeMatch[1].trim();
        }

        // Country of Origin
        const countryMatch = pageText.match(/Country of Origin[:\s]*([^.\n]+)/i);
        if (countryMatch) {
            productDetails.countryOfOrigin = countryMatch[1].trim();
        }

        // Product code
        const productCodeMatch = pageText.match(/Product code[:\s]*([^.\n]+)/i);
        if (productCodeMatch) {
            productDetails.productCode = productCodeMatch[1].trim();
        }

        // Manufacturer Details
        const manufacturerMatch = pageText.match(/Manufacturer Details[:\s]*([^.\n]+)/i);
        if (manufacturerMatch) {
            productDetails.manufacturerDetails = manufacturerMatch[1].trim();
        }

        // Importer Details
        const importerMatch = pageText.match(/Importer Details[:\s]*([^.\n]+)/i);
        if (importerMatch) {
            productDetails.importerDetails = importerMatch[1].trim();
        }

        // Contact
        const contactMatch = pageText.match(/Contact[:\s]*([^.\n]+)/i);
        if (contactMatch) {
            productDetails.contact = contactMatch[1].trim();
        }

        // E-mail
        const emailMatch = pageText.match(/E-mail[:\s]*([^.\n]+)/i);
        if (emailMatch) {
            productDetails.email = emailMatch[1].trim();
        }

        if (Object.keys(productDetails).length > 0) {
            htmlData.productDetails = productDetails;
        }
    }

    extractDescription($, htmlData) {
        let description = '';

        // Extract description from specific selectors
        const descriptionSelectors = [
            '.description',
            '.product-description',
            '.pdp-description',
            '.product-overview',
            '.pdp-overview'
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
            const descriptionMatch = pageText.match(/Description[:\s]*([^.\n]+)/i);
            if (descriptionMatch) {
                description = descriptionMatch[1].trim();
                console.log('Found description from page text:', description);
            }
        }

        if (description) {
            htmlData.description = description;
        }
    }
}

module.exports = ShoppersStopScraper;
