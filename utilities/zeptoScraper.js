const cheerio = require('cheerio');

class ZeptoScraper {
    constructor() {
        this.source = 'Zepto';
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
            this.extractRatings($, productData.product);
            this.extractOffersAndCoupons($, productData.product);
            this.extractHighlights($, productData.product);
            this.extractInformation($, productData.product);

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    extractFromHTML($, htmlData) {
        // Extract product name/title
        let productName = '';
        
        // Look for product name in h1 tag
        const nameElement = $('h1');
        if (nameElement.length) {
            productName = nameElement.text().trim();
            console.log('Found product name from h1:', productName);
        }

        // Fallback: Look for product name in other selectors
        if (!productName) {
            const fallbackSelectors = [
                '.product-title',
                '.product-name',
                '[data-testid="product-title"]',
                'h2'
            ];

            for (const selector of fallbackSelectors) {
                const element = $(selector);
                if (element.length) {
                    const text = element.text().trim();
                    if (text && text.length > 2) {
                        productName = text;
                        console.log('Found product name from fallback selector:', selector, productName);
                        break;
                    }
                }
            }
        }

        if (productName) {
            htmlData.title = productName;
        }

        // Extract brand from product name or brand section
        let brand = '';
        const brandElement = $('.brand, [data-testid="brand"]');
        if (brandElement.length) {
            brand = brandElement.text().trim();
        } else if (productName) {
            // Extract brand from product name
            const brandMatch = productName.match(/^([A-Za-z\s&',-]+?)\s+/);
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

        // Extract selling price from the specific Zepto selector
        const sellingPriceElement = $('span.text-\\[32px\\].font-medium.leading-\\[30px\\].text-\\[\\#262A33\\]');
        if (sellingPriceElement.length) {
            const text = sellingPriceElement.text().trim();
            const priceMatch = text.match(/₹\s*(\d+)/);
            if (priceMatch) {
                sellingPrice = parseInt(priceMatch[1]);
                console.log('Found selling price from Zepto specific selector:', sellingPrice);
            }
        }

        // Fallback selectors for selling price
        if (!sellingPrice) {
            const sellingPriceSelectors = [
                '.price-current',
                '.selling-price',
                '.offer-price',
                '[data-testid="selling-price"]',
                'span[class*="text-"]:contains("₹")'
            ];

            for (const selector of sellingPriceSelectors) {
                const element = $(selector);
                if (element.length) {
                    const text = element.text().trim();
                    const priceMatch = text.match(/₹\s*(\d+)/);
                    if (priceMatch) {
                        sellingPrice = parseInt(priceMatch[1]);
                        console.log('Found selling price from fallback selector:', selector, ':', sellingPrice);
                        break;
                    }
                }
            }
        }

        // Extract MRP - look for the second price (usually higher)
        const mrpElement = $('span:contains("₹")').not('span.text-\\[32px\\].font-medium.leading-\\[30px\\].text-\\[\\#262A33\\]');
        if (mrpElement.length) {
            mrpElement.each((i, el) => {
                const text = $(el).text().trim();
                const priceMatch = text.match(/₹\s*(\d+)/);
                if (priceMatch) {
                    const price = parseInt(priceMatch[1]);
                    if (price > sellingPrice && price < 100000) {
                        mrp = price;
                        console.log('Found MRP from span element:', mrp);
                        return false; // Break the loop
                    }
                }
            });
        }

        // Fallback selectors for MRP
        if (!mrp) {
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
                    const priceMatch = text.match(/₹\s*(\d+)/);
                    if (priceMatch) {
                        mrp = parseInt(priceMatch[1]);
                        console.log('Found MRP from fallback selector:', selector, ':', mrp);
                        break;
                    }
                }
            }
        }

        // Extract discount percentage
        const discountElement = $('.discount, .off-percentage, [data-testid="discount"]');
        if (discountElement.length) {
            const discountText = discountElement.text().trim();
            const discountMatch = discountText.match(/(\d+)%\s*Off/i);
            if (discountMatch) {
                discountPercent = parseInt(discountMatch[1]);
                console.log('Found discount percentage:', discountPercent);
            }
        }

        // Fallback: Look for prices in page text
        if (!sellingPrice || !mrp) {
            const pageText = $('body').text();
            const pricePattern = /₹\s*(\d+)/g;
            const prices = [];
            let match;
            
            while ((match = pricePattern.exec(pageText)) !== null) {
                const price = parseInt(match[1]);
                if (price > 0 && price < 100000) { // Reasonable price range
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
                // Filter out non-product images
                if (src.includes('zeptonow.com') || 
                    src.includes('product') ||
                    (src.includes('http') && 
                     !src.includes('logo') &&
                     !src.includes('icon') &&
                     !src.includes('banner') &&
                     !src.includes('footer') &&
                     !src.includes('header'))) {
                    imageUrls.push(src);
                    console.log('Found product image:', src);
                }
            }
        });

        htmlData.images = imageUrls;
    }

    extractRatings($, htmlData) {
        let rating = null, reviewCount = null;

        // Extract rating
        const ratingElement = $('.rating, .stars, [data-testid="rating"]');
        if (ratingElement.length) {
            const ratingText = ratingElement.text().trim();
            const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
            if (ratingMatch) {
                rating = parseFloat(ratingMatch[1]);
                console.log('Found rating:', rating);
            }
        }

        // Extract review count
        const reviewElement = $('.reviews, .review-count, [data-testid="review-count"]');
        if (reviewElement.length) {
            const reviewText = reviewElement.text().trim();
            const reviewMatch = reviewText.match(/\((\d+)\)/);
            if (reviewMatch) {
                reviewCount = parseInt(reviewMatch[1]);
                console.log('Found review count:', reviewCount);
            }
        }

        if (rating) htmlData.rating = rating;
        if (reviewCount) htmlData.reviewCount = reviewCount;
    }

    extractOffersAndCoupons($, htmlData) {
        const offers = [];
        const coupons = [];

        // Extract offers from the "Coupons & Offers" section
        $('.coupon, .offer, .discount-offer, [class*="offer"], [class*="coupon"]').each((i, el) => {
            const offerText = $(el).text().trim();
            if (offerText && offerText.length > 5 && !offers.includes(offerText)) {
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

        // Look for all bank offers and discount patterns in the page text
        const pageText = $('body').text();
        
        // Pattern for bank offers
        const bankOfferPattern = /(?:Get|Flat)\s+(?:₹\d+|%\d+)\s+(?:off|discount)\s+with\s+([A-Za-z\s&]+)\s+(?:Bank|Card|Cards)/gi;
        let match;
        
        while ((match = bankOfferPattern.exec(pageText)) !== null) {
            const offer = match[0].trim();
            if (!offers.includes(offer)) {
                offers.push(offer);
                console.log('Found bank offer:', offer);
            }
        }

        // Pattern for percentage discounts
        const percentOfferPattern = /(?:Get|Flat)\s+(\d+%)\s+(?:upto\s+₹\d+\s+)?(?:off|discount)\s+with\s+([A-Za-z\s&]+)/gi;
        while ((match = percentOfferPattern.exec(pageText)) !== null) {
            const offer = match[0].trim();
            if (!offers.includes(offer)) {
                offers.push(offer);
                console.log('Found percentage offer:', offer);
            }
        }

        // Pattern for UPI offers
        const upiOfferPattern = /(?:Get|Flat)\s+(?:₹\d+|%\d+)\s+(?:off|discount)\s+with\s+([A-Za-z\s]+UPI)/gi;
        while ((match = upiOfferPattern.exec(pageText)) !== null) {
            const offer = match[0].trim();
            if (!offers.includes(offer)) {
                offers.push(offer);
                console.log('Found UPI offer:', offer);
            }
        }

        // Pattern for coupon codes
        const couponPattern = /(?:Get|Use)\s+(?:code|coupon)\s+([A-Z0-9]+)/gi;
        while ((match = couponPattern.exec(pageText)) !== null) {
            const coupon = match[1];
            if (!coupons.includes(coupon)) {
                coupons.push(coupon);
                console.log('Found coupon code:', coupon);
            }
        }

        // Extract offers from specific sections that might contain "View all offers"
        $('section:contains("Coupons"), section:contains("Offers"), div:contains("View all offers")').each((i, el) => {
            const sectionText = $(el).text();
            const lines = sectionText.split('\n');
            
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && 
                    (trimmedLine.includes('Off') || 
                     trimmedLine.includes('discount') || 
                     trimmedLine.includes('Flat') ||
                     trimmedLine.includes('Get')) &&
                    trimmedLine.length > 10 &&
                    !offers.includes(trimmedLine)) {
                    offers.push(trimmedLine);
                    console.log('Found offer from section:', trimmedLine);
                }
            });
        });

        // Clean up offers - remove duplicates and filter out irrelevant text
        const cleanedOffers = offers.filter(offer => {
            return offer.length > 10 && 
                   !offer.includes('View all') &&
                   !offer.includes('Coupons & Offers') &&
                   !offer.includes('Popular Searches') &&
                   (offer.includes('Off') || offer.includes('discount') || offer.includes('Flat'));
        });

        if (cleanedOffers.length > 0) htmlData.offers = cleanedOffers;
        if (coupons.length > 0) htmlData.coupons = coupons;
    }

    extractHighlights($, htmlData) {
        const highlights = [];
        
        // Extract highlights from the highlights section
        $('.highlight, .feature, .specification').each((i, el) => {
            const highlightText = $(el).text().trim();
            if (highlightText && highlightText.length > 2) {
                highlights.push(highlightText);
                console.log('Found highlight:', highlightText);
            }
        });

        // Extract from structured highlight elements
        $('.highlights li, .features li, .specifications li').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 2 && !highlights.includes(text)) {
                highlights.push(text);
            }
        });

        // Extract key features and specifications
        const pageText = $('body').text();
        const featurePatterns = [
            /(\d+\s+(?:modes|intensity levels|hours|channels))/gi,
            /(rechargeable|battery powered|dual channel)/gi,
            /(\d+\s*[a-z]+\s*(?:pads|wires|device|manual|cable|pouch))/gi
        ];

        for (const pattern of featurePatterns) {
            let match;
            while ((match = pattern.exec(pageText)) !== null) {
                const feature = match[0].trim();
                if (!highlights.includes(feature)) {
                    highlights.push(feature);
                    console.log('Found feature:', feature);
                }
            }
        }

        if (highlights.length > 0) {
            htmlData.highlights = highlights;
        }
    }

    extractInformation($, htmlData) {
        const information = {};

        // Extract warranty information
        const warrantyElement = $('.warranty, [data-testid="warranty"]');
        if (warrantyElement.length) {
            information.warranty = warrantyElement.text().trim();
        }

        // Extract seller information
        const sellerElement = $('.seller, [data-testid="seller"]');
        if (sellerElement.length) {
            information.seller = sellerElement.text().trim();
        }

        // Extract country of origin
        const originElement = $('.origin, .country, [data-testid="origin"]');
        if (originElement.length) {
            information.countryOfOrigin = originElement.text().trim();
        }

        // Extract weight, dimensions, and other specifications
        const pageText = $('body').text();
        
        // Weight
        const weightMatch = pageText.match(/weight[:\s]*(\d+\s*[a-z]+)/i);
        if (weightMatch) {
            information.weight = weightMatch[1];
        }

        // Dimensions
        const dimensionMatch = pageText.match(/dimensions[:\s]*([\d\.\sx]+[a-z]+)/i);
        if (dimensionMatch) {
            information.dimensions = dimensionMatch[1];
        }

        // Battery information
        const batteryMatch = pageText.match(/battery[:\s]*(\d+\s*[a-z]+)/i);
        if (batteryMatch) {
            information.battery = batteryMatch[1];
        }

        // Power consumption
        const powerMatch = pageText.match(/power[:\s]*(\d+\s*[a-z]+)/i);
        if (powerMatch) {
            information.powerConsumption = powerMatch[1];
        }

        // Voltage
        const voltageMatch = pageText.match(/voltage[:\s]*(\d+\s*[a-z]+)/i);
        if (voltageMatch) {
            information.voltage = voltageMatch[1];
        }

        // Material
        const materialMatch = pageText.match(/material[:\s]*([a-z]+)/i);
        if (materialMatch) {
            information.material = materialMatch[1];
        }

        // Color
        const colorMatch = pageText.match(/colour[:\s]*([a-z]+)/i);
        if (colorMatch) {
            information.color = colorMatch[1];
        }

        // Extract customer care details
        const careMatch = pageText.match(/customer care[:\s]*([^.\n]+)/i);
        if (careMatch) {
            information.customerCare = careMatch[1].trim();
        }

        // Extract disclaimer
        const disclaimerMatch = pageText.match(/disclaimer[:\s]*([^.\n]+)/i);
        if (disclaimerMatch) {
            information.disclaimer = disclaimerMatch[1].trim();
        }

        if (Object.keys(information).length > 0) {
            htmlData.information = information;
        }
    }
}

module.exports = ZeptoScraper;
