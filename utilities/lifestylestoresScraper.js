const cheerio = require('cheerio');

class LifestyleStoresScraper {
    constructor() {
        this.source = 'Lifestyle Stores';
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
            this.extractOverview($, productData.product);

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    extractFromHTML($, htmlData) {
        // Extract product title
        let productTitle = '';
        
        // Look for product title in h1 tag with specific Lifestyle Stores selectors
        const titleElement = $('h1.MuiTypography-root');
        if (titleElement.length) {
            productTitle = titleElement.text().trim();
            console.log('Found product title from h1:', productTitle);
        }

        // Fallback: Look for product title in other selectors
        if (!productTitle) {
            const fallbackSelectors = [
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
        let brand = 'FAME FOREVER';
        htmlData.brand = brand;
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract selling price - look for the main price with specific Lifestyle Stores selectors
        const sellingPriceSelectors = [
            '#details-price .MuiBox-root:last-child',
            '.MuiBox-root.jss694',
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
                const priceMatch = text.match(/₹\s*([\d,]+)/);
                if (priceMatch) {
                    sellingPrice = parseInt(priceMatch[1].replace(/,/g, ''));
                    console.log('Found selling price from', selector, ':', sellingPrice);
                    break;
                }
            }
        }

        // Alternative approach: Look for the price container and extract the number
        if (!sellingPrice) {
            const priceContainer = $('#details-price');
            if (priceContainer.length) {
                const priceText = priceContainer.text();
                const priceMatch = priceText.match(/₹\s*([\d,]+)/);
                if (priceMatch) {
                    sellingPrice = parseInt(priceMatch[1].replace(/,/g, ''));
                    console.log('Found selling price from price container:', sellingPrice);
                }
            }
        }

        // Extract MRP - look for crossed out price
        const mrpSelectors = [
            '.price-mrp',
            '.mrp',
            '.original-price',
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
                if (src.includes('lifestylestores.com') || 
                    src.includes('landmarkshops.in') ||
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
        const productCodeElement = $('[data-code]').first();
        if (productCodeElement.length) {
            const code = productCodeElement.attr('data-code');
            if (code) {
                productDetails.productCode = code;
                console.log('Found product code:', productDetails.productCode);
            }
        }

        // Extract sold by information
        const soldByElement = $('#dsv-info');
        if (soldByElement.length) {
            const soldByText = soldByElement.text().trim();
            const soldByMatch = soldByText.match(/Sold By[:\s]*([^.\n]+)/i);
            if (soldByMatch) {
                productDetails.soldBy = soldByMatch[1].trim();
            }
        }

        // Extract from page text
        const pageText = $('body').text();
        
        // Country of origin
        const originMatch = pageText.match(/Country of Origin[:\s]*([^.\n]+)/i);
        if (originMatch) {
            productDetails.countryOfOrigin = originMatch[1].trim();
        }

        // Manufacturer
        const manufacturerMatch = pageText.match(/Manufactured[:\s]*([^.\n]+)/i);
        if (manufacturerMatch) {
            productDetails.manufacturer = manufacturerMatch[1].trim();
        }

        // Customer care
        const customerCareMatch = pageText.match(/Customer Care[:\s]*([^.\n]+)/i);
        if (customerCareMatch) {
            productDetails.customerCare = customerCareMatch[1].trim();
        }

        if (Object.keys(productDetails).length > 0) {
            htmlData.productDetails = productDetails;
        }
    }

    extractColorsAndSizes($, htmlData) {
        const colors = [];
        const sizes = [];

        // Extract colors from specific Lifestyle Stores color selector structure
        $('#details-color .color-position-0').each((i, el) => {
            const colorText = $(el).text().trim();
            if (colorText && !colors.includes(colorText)) {
                colors.push(colorText);
            }
        });

        // Extract color from the color display section
        const colorDisplay = $('.MuiBox-root.jss890');
        if (colorDisplay.length) {
            const colorText = colorDisplay.text().trim();
            if (colorText && !colors.includes(colorText)) {
                colors.push(colorText);
            }
        }

        // Extract sizes from specific Lifestyle Stores size selector structure - be more specific
        $('#details-size .root-pdp-sizes .MuiButton-label').each((i, el) => {
            const sizeText = $(el).text().trim();
            // Only include valid clothing sizes
            if (sizeText && this.isValidSize(sizeText) && !sizes.includes(sizeText)) {
                sizes.push(sizeText);
            }
        });

        // Fallback: Extract sizes from data attributes within the size section only
        $('#details-size .root-pdp-sizes button[data-code]').each((i, el) => {
            const sizeText = $(el).find('.MuiButton-label').text().trim();
            if (sizeText && this.isValidSize(sizeText) && !sizes.includes(sizeText)) {
                sizes.push(sizeText);
            }
        });

        // Fallback: Look for colors and sizes in page text
        const pageText = $('body').text();
        
        // Colors
        const colorMatch = pageText.match(/Color[:\s]*([^.\n]+)/i);
        if (colorMatch && !colors.includes(colorMatch[1].trim())) {
            colors.push(colorMatch[1].trim());
        }

        // Sizes - be more specific and only look in the size section
        const sizeSection = $('#details-size').text();
        if (sizeSection) {
            const sizeMatch = sizeSection.match(/Size[:\s]*([^.\n]+)/i);
            if (sizeMatch) {
                const sizeText = sizeMatch[1].trim();
                const sizeList = sizeText.split(/\s+/).filter(size => this.isValidSize(size));
                sizeList.forEach(size => {
                    if (!sizes.includes(size)) {
                        sizes.push(size);
                    }
                });
            }
        }

        if (colors.length > 0) {
            htmlData.colors = colors;
        }
        if (sizes.length > 0) {
            htmlData.sizes = sizes;
        }
    }

    // Helper method to validate if a text is a valid clothing size
    isValidSize(sizeText) {
        const validSizes = [
            'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
            '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50',
            '6', '8', '10', '12', '14', '16', '18', '20', '22', '24', '26',
            'Small', 'Medium', 'Large', 'Extra Large', 'Extra Small',
            'One Size', 'Free Size', 'OS'
        ];
        
        // Check if it's a valid size
        if (validSizes.includes(sizeText.toUpperCase())) {
            return true;
        }
        
        // Check if it's a number (for numeric sizes)
        if (/^\d+$/.test(sizeText)) {
            const numSize = parseInt(sizeText);
            return numSize >= 6 && numSize <= 50; // Reasonable size range
        }
        
        // Check if it contains size-related keywords but exclude navigation items
        const sizeKeywords = ['size', 'small', 'medium', 'large', 'extra'];
        const excludeKeywords = ['beauty', 'footwear', 'watches', 'jewellery', 'fragrances', 'sunglasses', 'brands', 'colors', 'kids', 'boys', 'girls'];
        
        const lowerText = sizeText.toLowerCase();
        const hasSizeKeyword = sizeKeywords.some(keyword => lowerText.includes(keyword));
        const hasExcludeKeyword = excludeKeywords.some(keyword => lowerText.includes(keyword));
        
        return hasSizeKeyword && !hasExcludeKeyword && sizeText.length <= 10; // Reasonable length for size
    }

    extractOffers($, htmlData) {
        const offers = [];

        // Extract offers from specific Lifestyle Stores offer structure
        $('.slick-slide .MuiTypography-body1').each((i, el) => {
            const offerText = $(el).text().trim();
            if (offerText && offerText.length > 10 && !offers.includes(offerText)) {
                offers.push(offerText);
            }
        });

        // Extract specific offers from the offers section
        $('.jss5719, .jss5728').each((i, el) => {
            const offerText = $(el).text().trim();
            if (offerText && offerText.length > 10 && !offers.includes(offerText)) {
                offers.push(offerText);
            }
        });

        // Extract from page text
        const pageText = $('body').text();
        
        // Look for specific offer patterns
        const offerPatterns = [
            /Shop For Rs\.?\s*\d+ And Get Rs\.?\s*\d+ Off/gi,
            /EXTRA \d+ percent Off on Rs\.?\s*[\d,]+/gi,
            /Get Extra \d+% Off on Rs \d+\.?\s*Use Code - \w+/gi,
            /Coupon Discount/gi
        ];

        offerPatterns.forEach(pattern => {
            const matches = pageText.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    if (!offers.includes(match.trim())) {
                        offers.push(match.trim());
                    }
                });
            }
        });

        // Remove duplicates and filter out empty offers
        const uniqueOffers = [...new Set(offers)].filter(offer => offer.length > 5);
        
        if (uniqueOffers.length > 0) {
            htmlData.offers = uniqueOffers;
        }
    }

    extractOverview($, htmlData) {
        let overview = '';

        // Extract overview from specific Lifestyle Stores structure
        const overviewElement = $('#details-overview .MuiBox-root.jss1010');
        if (overviewElement.length) {
            overview = overviewElement.text().trim();
            console.log('Found overview:', overview);
        }

        // Extract product details list
        const detailsList = [];
        $('#details-overview ul.jss993 li').each((i, el) => {
            const detailText = $(el).text().trim();
            if (detailText) {
                detailsList.push(detailText);
            }
        });

        if (overview) {
            htmlData.overview = overview;
        }
        if (detailsList.length > 0) {
            htmlData.productDetails = htmlData.productDetails || {};
            htmlData.productDetails.details = detailsList;
        }
    }
}

module.exports = LifestyleStoresScraper;
