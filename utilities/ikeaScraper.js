const cheerio = require('cheerio');

class IkeaScraper {
    constructor() {
        this.source = 'IKEA';
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
            this.extractMeasurements($, productData.product);
            this.extractRatings($, productData.product);

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    extractFromHTML($, htmlData) {
        // Extract product title
        let productTitle = '';
        
        // Look for product title in the specific IKEA structure
        const titleElement = $('.pip-price-module__name');
        if (titleElement.length) {
            const nameDecorator = titleElement.find('.pip-price-module__name-decorator').text().trim();
            const description = titleElement.find('.pip-price-module__description').text().trim();
            productTitle = `${nameDecorator} ${description}`.trim();
            console.log('Found product title from IKEA structure:', productTitle);
        }

        // Fallback: Look for product title in h1 tag
        if (!productTitle) {
            const h1Element = $('h1');
            if (h1Element.length) {
                productTitle = h1Element.text().trim();
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
        let brand = 'IKEA';
        htmlData.brand = brand;
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract selling price - look for the main price with specific IKEA selectors
        const sellingPriceSelectors = [
            '.pip-price-module__current-price .pip-price__integer',
            '.pip-price__integer',
            '.pip-price-module__primary-currency-price .pip-price__integer',
            '.price-current',
            '.selling-price',
            '.offer-price',
            '[data-testid="selling-price"]'
        ];

        for (const selector of sellingPriceSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/(\d+)/);
                if (priceMatch) {
                    sellingPrice = parseInt(priceMatch[1]);
                    console.log('Found selling price from', selector, ':', sellingPrice);
                    break;
                }
            }
        }

        // Extract MRP - look for crossed out price or MRP
        const mrpSelectors = [
            '.price-mrp',
            '.mrp',
            '.original-price',
            '[data-testid="mrp"]',
            '.pip-price-module__previous-price'
        ];

        for (const selector of mrpSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/Rs\.?\s*(\d+)/);
                if (priceMatch) {
                    mrp = parseInt(priceMatch[1]);
                    console.log('Found MRP from', selector, ':', mrp);
                    break;
                }
            }
        }

        // Look for MRP in page text
        if (!mrp) {
            const pageText = $('body').text();
            const mrpMatch = pageText.match(/MRP\s*Rs\.?\s*(\d+)/i);
            if (mrpMatch) {
                mrp = parseInt(mrpMatch[1]);
                console.log('Found MRP from page text:', mrp);
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
            const pricePattern = /Rs\.?\s*(\d+)/g;
            const prices = [];
            let match;
            
            while ((match = pricePattern.exec(pageText)) !== null) {
                const price = parseInt(match[1]);
                if (price > 0 && price < 1000000) { // Reasonable price range for IKEA products
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
                if (src.includes('ikea.com') || 
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

        // Extract article number
        const articleElement = $('.pip-product-identifier__product-number, .product-number');
        if (articleElement.length) {
            const articleText = articleElement.text().trim();
            const articleMatch = articleText.match(/(\d+\.\d+\.\d+)/);
            if (articleMatch) {
                productDetails.articleNumber = articleMatch[1];
                console.log('Found article number:', productDetails.articleNumber);
            }
        }

        // Extract product features
        const features = [];
        $('.pip-product-features__list li, .product-features li').each((i, el) => {
            const feature = $(el).text().trim();
            if (feature) {
                features.push(feature);
            }
        });
        if (features.length > 0) {
            productDetails.features = features;
        }

        // Extract designer
        const designerMatch = $('body').text().match(/Designer[:\s]*([^.\n]+)/i);
        if (designerMatch) {
            productDetails.designer = designerMatch[1].trim();
        }

        // Extract country of origin
        const originMatch = $('body').text().match(/Country of Origin[:\s]*([^.\n]+)/i);
        if (originMatch) {
            productDetails.countryOfOrigin = originMatch[1].trim();
        }

        // Extract materials
        const materialsMatch = $('body').text().match(/Material[:\s]*([^.\n]+)/i);
        if (materialsMatch) {
            productDetails.materials = materialsMatch[1].trim();
        }

        // Extract care instructions
        const careMatch = $('body').text().match(/Care[:\s]*([^.\n]+)/i);
        if (careMatch) {
            productDetails.care = careMatch[1].trim();
        }

        if (Object.keys(productDetails).length > 0) {
            htmlData.productDetails = productDetails;
        }
    }

    extractMeasurements($, htmlData) {
        const measurements = {};

        // Extract measurements from the measurements section
        $('.pip-measurements__list li, .measurements li').each((i, el) => {
            const text = $(el).text().trim();
            const match = text.match(/([^:]+):\s*([^.\n]+)/);
            if (match) {
                const key = match[1].trim().toLowerCase();
                const value = match[2].trim();
                measurements[key] = value;
            }
        });

        // Extract specific measurements from page text
        const pageText = $('body').text();
        
        // Height
        const heightMatch = pageText.match(/Height[:\s]*([^.\n]+)/i);
        if (heightMatch) {
            measurements.height = heightMatch[1].trim();
        }

        // Diameter
        const diameterMatch = pageText.match(/Diameter[:\s]*([^.\n]+)/i);
        if (diameterMatch) {
            measurements.diameter = diameterMatch[1].trim();
        }

        // Volume
        const volumeMatch = pageText.match(/Volume[:\s]*([^.\n]+)/i);
        if (volumeMatch) {
            measurements.volume = volumeMatch[1].trim();
        }

        // Weight
        const weightMatch = pageText.match(/Weight[:\s]*([^.\n]+)/i);
        if (weightMatch) {
            measurements.weight = weightMatch[1].trim();
        }

        if (Object.keys(measurements).length > 0) {
            htmlData.measurements = measurements;
        }
    }

    extractRatings($, htmlData) {
        // Extract average rating
        const ratingElement = $('.pip-rating__average, .rating-average, .average-rating');
        if (ratingElement.length) {
            const ratingText = ratingElement.text().trim();
            const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
            if (ratingMatch) {
                htmlData.averageRating = parseFloat(ratingMatch[1]);
                console.log('Found average rating:', htmlData.averageRating);
            }
        }

        // Extract total reviews count
        const reviewsElement = $('.pip-rating__count, .reviews-count, .total-reviews');
        if (reviewsElement.length) {
            const reviewsText = reviewsElement.text().trim();
            const reviewsMatch = reviewsText.match(/(\d+)/);
            if (reviewsMatch) {
                htmlData.totalReviews = parseInt(reviewsMatch[1]);
                console.log('Found total reviews:', htmlData.totalReviews);
            }
        }

        // Fallback: Look for ratings in page text
        if (!htmlData.averageRating || !htmlData.totalReviews) {
            const pageText = $('body').text();
            
            // Average rating
            const avgRatingMatch = pageText.match(/(\d+\.?\d*)\s*Average rating/i);
            if (avgRatingMatch && !htmlData.averageRating) {
                htmlData.averageRating = parseFloat(avgRatingMatch[1]);
            }

            // Total reviews
            const totalReviewsMatch = pageText.match(/(\d+)\s*Reviews/i);
            if (totalReviewsMatch && !htmlData.totalReviews) {
                htmlData.totalReviews = parseInt(totalReviewsMatch[1]);
            }
        }
    }
}

module.exports = IkeaScraper;
