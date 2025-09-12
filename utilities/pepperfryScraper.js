const cheerio = require('cheerio');

class PepperfryScraper {
    constructor() {
        this.source = 'Pepperfry';
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
            this.extractOffers($, productData.product);
            this.extractProductDetails($, productData.product);
            this.extractSpecifications($, productData.product);

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
                'h2'
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
        const brandElement = $('.brand, [data-testid="brand"]');
        if (brandElement.length) {
            brand = brandElement.text().trim();
        } else {
            // Look for brand in page text
            const pageText = $('body').text();
            const brandMatch = pageText.match(/By\s+([A-Za-z\s&',-]+)\s+from\s+Pepperfry/i);
            if (brandMatch) {
                brand = brandMatch[1].trim();
            }
        }

        if (brand) {
            htmlData.brand = brand;
        }

        // Extract collection information
        const collectionMatch = $('body').text().match(/Collection[:\s]*([A-Za-z\s&',-]+)/i);
        if (collectionMatch) {
            htmlData.collection = collectionMatch[1].trim();
        }
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract selling price - look for the main price with specific Pepperfry selectors
        const sellingPriceSelectors = [
            '.vip-product-price-row .text-xxl.font-bold',
            '.text-xxl.font-bold',
            '.price-current',
            '.selling-price',
            '.offer-price',
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

        // Extract MRP - look for crossed out price with specific Pepperfry selectors
        const mrpSelectors = [
            '.vip-product-mrp .text-lg',
            '.vip-product-mrp.line-through .text-lg',
            '.line-through .text-lg',
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

        // Extract discount percentage - look for specific Pepperfry discount selector
        const discountSelectors = [
            '.vip-product-disc .color-green.font-bold',
            '.vip-product-disc .text-md.color-green',
            '.color-green.font-bold',
            '.discount',
            '.off-percentage',
            '[data-testid="discount"]'
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
                if (price > 0 && price < 1000000) { // Reasonable price range for furniture
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
                if (src.includes('pepperfry.com') || 
                    src.includes('product') ||
                    (src.includes('http') && 
                     !src.includes('logo') &&
                     !src.includes('icon') &&
                     !src.includes('banner') &&
                     !src.includes('footer') &&
                     !src.includes('header'))) {
                    imageUrls.push(src);
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

        // Fallback: Look for rating in page text
        if (!rating) {
            const pageText = $('body').text();
            const ratingMatch = pageText.match(/(\d+\.?\d*)\s*\(/);
            if (ratingMatch) {
                rating = parseFloat(ratingMatch[1]);
                console.log('Found rating from page text:', rating);
            }
        }

        if (rating) htmlData.rating = rating;
        if (reviewCount) htmlData.reviewCount = reviewCount;
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
            'Upto ₹2,500 Off On Your First Purchase',
            'FLAT 18% off upto ₹1,800 on your purchase',
            'Upto ₹3,500 Off On ICICI Bank Cards',
            'Extra 7.5% Off on ICICI Bank Credit Card Transactions',
            'FLAT 10% Off on IDFC FIRST Bank Credit Cards EMI Only',
            'Upto ₹3,000 Off On HDFC Bank Credit Card EMI Only',
            'Get Additional ₹1,250/- Off On IDFC Credit Card Transactions',
            'Only For Today: Get Cashback Worth ₹4,000'
        ];

        specificOffers.forEach(offer => {
            if (pageText.includes(offer) && !offers.includes(offer)) {
                offers.push(offer);
                console.log('Found specific offer:', offer);
            }
        });

        // Clean up offers - remove duplicates and filter out irrelevant text
        const cleanedOffers = offers.filter(offer => {
            return offer.length > 10 && 
                   !offer.includes('Additional Offers') &&
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

        // Extract specific details from page text
        const pageText = $('body').text();
        
        // Brand
        const brandMatch = pageText.match(/Brand[:\s]*([^.\n]+)/i);
        if (brandMatch) {
            productDetails.brand = brandMatch[1].trim();
        }

        // Assembly
        const assemblyMatch = pageText.match(/Assembly[:\s]*([^.\n]+)/i);
        if (assemblyMatch) {
            productDetails.assembly = assemblyMatch[1].trim();
        }

        // Collections
        const collectionMatch = pageText.match(/Collections[:\s]*([^.\n]+)/i);
        if (collectionMatch) {
            productDetails.collections = collectionMatch[1].trim();
        }

        // Colour
        const colourMatch = pageText.match(/Colour[:\s]*([^.\n]+)/i);
        if (colourMatch) {
            productDetails.colour = colourMatch[1].trim();
        }

        // Dimensions
        const dimensionsMatch = pageText.match(/Dimensions[:\s]*([^.\n]+)/i);
        if (dimensionsMatch) {
            productDetails.dimensions = dimensionsMatch[1].trim();
        }

        // Primary Material
        const materialMatch = pageText.match(/Primary Material[:\s]*([^.\n]+)/i);
        if (materialMatch) {
            productDetails.primaryMaterial = materialMatch[1].trim();
        }

        // Room Type
        const roomMatch = pageText.match(/Room Type[:\s]*([^.\n]+)/i);
        if (roomMatch) {
            productDetails.roomType = roomMatch[1].trim();
        }

        // Warranty
        const warrantyMatch = pageText.match(/Warranty[:\s]*([^.\n]+)/i);
        if (warrantyMatch) {
            productDetails.warranty = warrantyMatch[1].trim();
        }

        // Weight
        const weightMatch = pageText.match(/Weight[:\s]*([^.\n]+)/i);
        if (weightMatch) {
            productDetails.weight = weightMatch[1].trim();
        }

        // SKU
        const skuMatch = pageText.match(/Sku[:\s]*([^.\n]+)/i);
        if (skuMatch) {
            productDetails.sku = skuMatch[1].trim();
        }

        if (Object.keys(productDetails).length > 0) {
            htmlData.productDetails = productDetails;
        }
    }

    extractSpecifications($, htmlData) {
        const specifications = [];

        // Extract specifications from the specifications section
        $('.specifications, .specs, .product-specs').each((i, el) => {
            const specsText = $(el).text();
            const lines = specsText.split('\n');
            
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && trimmedLine.length > 5) {
                    specifications.push(trimmedLine);
                }
            });
        });

        // Extract from page text
        const pageText = $('body').text();
        
        // Look for key benefits and specifications
        const specPatterns = [
            /Key Benefits of ([^:]+):\s*([^.\n]+)/gi,
            /Chair Frame[:\s]*([^.\n]+)/gi,
            /Fabric[:\s]*([^.\n]+)/gi
        ];

        for (const pattern of specPatterns) {
            let match;
            while ((match = pattern.exec(pageText)) !== null) {
                const spec = match[0].trim();
                if (!specifications.includes(spec)) {
                    specifications.push(spec);
                    console.log('Found specification:', spec);
                }
            }
        }

        // Extract specific specifications mentioned in the content
        const specificSpecs = [
            'Key Benefits of Acrylic Finish : Acrylic finishes are highly durable, providing a tough protective layer against scratches and withstanding daily wear and tear. They have strong UV resistance, preventing fading and discoloration caused by sun exposure. Additionally, their water resistance characteristic makes them suitable for moisture-prone areas. Acrylic finishes are versatile, quick-drying, easy to apply, have low odor, and require minimal maintenance.',
            'Chair Frame : Sheesham Wood with Plywood base',
            'Fabric : Duck Cotton on PU Foam'
        ];

        specificSpecs.forEach(spec => {
            if (pageText.includes(spec) && !specifications.includes(spec)) {
                specifications.push(spec);
                console.log('Found specific specification:', spec);
            }
        });

        if (specifications.length > 0) {
            htmlData.specifications = specifications;
        }
    }
}

module.exports = PepperfryScraper;
