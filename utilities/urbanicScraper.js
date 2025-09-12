const cheerio = require('cheerio');

class UrbanicScraper {
    constructor() {
        this.source = 'Urbanic';
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
            this.extractAboutProduct($, productData.product);
            this.extractProductMeasurements($, productData.product);

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
        const brandElement = $('.brand, [data-testid="brand"], .pdp-brand');
        if (brandElement.length) {
            brand = brandElement.text().trim();
        } else {
            // Look for brand in page text
            const pageText = $('body').text();
            const brandMatch = pageText.match(/Urbanic/i);
            if (brandMatch) {
                brand = 'Urbanic';
            }
        }

        if (brand) {
            htmlData.brand = brand;
        }
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract MRP - look for the main price
        const mrpSelectors = [
            '.mrp',
            '.price-mrp',
            '.original-price',
            '.pdp-mrp',
            '[data-testid="mrp"]',
            '.price'
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

        // Extract selling price - look for discounted price
        const sellingPriceSelectors = [
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
                if (src.includes('urbanic.com') || 
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

        // Extract color information
        const colorElement = $('.color, .colour, .pdp-color, [data-testid="color"]');
        if (colorElement.length) {
            const colorText = colorElement.text().trim();
            if (colorText) {
                productDetails.color = colorText;
                console.log('Found color:', colorText);
            }
        }

        // Extract size information
        const sizeElement = $('.size, .pdp-size, [data-testid="size"]');
        if (sizeElement.length) {
            const sizeText = sizeElement.text().trim();
            if (sizeText) {
                productDetails.size = sizeText;
                console.log('Found size:', sizeText);
            }
        }

        // Extract from page text
        const pageText = $('body').text();
        
        // Color
        const colorMatch = pageText.match(/Color[:\s]*([^.\n]+)/i);
        if (colorMatch && !productDetails.color) {
            productDetails.color = colorMatch[1].trim();
            console.log('Found color from page text:', productDetails.color);
        }

        // Size
        const sizeMatch = pageText.match(/Size[:\s]*([^.\n]+)/i);
        if (sizeMatch && !productDetails.size) {
            productDetails.size = sizeMatch[1].trim();
            console.log('Found size from page text:', productDetails.size);
        }

        // Product ID/SKU
        const skuMatch = pageText.match(/vid=(\d+)/i);
        if (skuMatch) {
            productDetails.productId = skuMatch[1];
        }

        // Material
        const materialMatch = pageText.match(/Material[:\s]*([^.\n]+)/i);
        if (materialMatch) {
            productDetails.material = materialMatch[1].trim();
        }

        // Category
        const categoryMatch = pageText.match(/Category[:\s]*([^.\n]+)/i);
        if (categoryMatch) {
            productDetails.category = categoryMatch[1].trim();
        }

        // Tax information
        const taxMatch = pageText.match(/Inclusive of all taxes/i);
        if (taxMatch) {
            productDetails.taxInfo = 'Inclusive of all taxes';
        }

        if (Object.keys(productDetails).length > 0) {
            htmlData.productDetails = productDetails;
        }
    }

    extractAboutProduct($, htmlData) {
        let aboutProduct = '';

        // Extract about product from specific selectors
        const aboutSelectors = [
            '.about-product',
            '.product-about',
            '.pdp-about',
            '.description',
            '.product-description'
        ];

        for (const selector of aboutSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                if (text && text.length > 10) {
                    aboutProduct = text;
                    console.log('Found about product from', selector, ':', aboutProduct);
                    break;
                }
            }
        }

        // Fallback: Look for about product in page text
        if (!aboutProduct) {
            const pageText = $('body').text();
            const aboutMatch = pageText.match(/About this product[:\s]*([^.\n]+)/i);
            if (aboutMatch) {
                aboutProduct = aboutMatch[1].trim();
                console.log('Found about product from page text:', aboutProduct);
            }
        }

        if (aboutProduct) {
            htmlData.aboutProduct = aboutProduct;
        }
    }

    extractProductMeasurements($, htmlData) {
        let measurements = '';

        // Extract measurements from specific selectors
        const measurementsSelectors = [
            '.measurements',
            '.product-measurements',
            '.pdp-measurements',
            '.size-chart',
            '.product-size-chart'
        ];

        for (const selector of measurementsSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                if (text && text.length > 5) {
                    measurements = text;
                    console.log('Found measurements from', selector, ':', measurements);
                    break;
                }
            }
        }

        // Fallback: Look for measurements in page text
        if (!measurements) {
            const pageText = $('body').text();
            const measurementsMatch = pageText.match(/Product measurements[:\s]*([^.\n]+)/i);
            if (measurementsMatch) {
                measurements = measurementsMatch[1].trim();
                console.log('Found measurements from page text:', measurements);
            }
        }

        if (measurements) {
            htmlData.measurements = measurements;
        }
    }
}

module.exports = UrbanicScraper;
