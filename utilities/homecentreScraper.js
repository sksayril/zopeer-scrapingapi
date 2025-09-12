const cheerio = require('cheerio');

class HomeCentreScraper {
    constructor() {
        this.source = 'HomeCentre';
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
            this.extractOverview($, productData.product);
            this.extractDimensions($, productData.product);

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
            const brandMatch = pageText.match(/Sold By\s*:\s*([^.\n]+)/i);
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

        // Extract selling price - look for the main price with specific HomeCentre selectors
        const sellingPriceSelectors = [
            '#details-price .MuiBox-root',
            '.MuiBox-root.jss510',
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
                if (price > 0 && price < 1000000) { // Reasonable price range for home decor
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
                if (src.includes('homecentre.in') || 
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

        // Extract from page text
        const pageText = $('body').text();
        
        // Color
        const colorMatch = pageText.match(/Color[:\s]*([^.\n]+)/i);
        if (colorMatch && !productDetails.color) {
            productDetails.color = colorMatch[1].trim();
            console.log('Found color from page text:', productDetails.color);
        }

        // Brand
        const brandMatch = pageText.match(/Sold By[:\s]*([^.\n]+)/i);
        if (brandMatch) {
            productDetails.soldBy = brandMatch[1].trim();
        }

        // Product ID/SKU
        const skuMatch = pageText.match(/p\/(\d+)/i);
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

    extractOverview($, htmlData) {
        let overview = '';

        // Extract overview from specific selectors
        const overviewSelectors = [
            '.overview',
            '.product-overview',
            '.pdp-overview',
            '.description',
            '.product-description'
        ];

        for (const selector of overviewSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                if (text && text.length > 10) {
                    overview = text;
                    console.log('Found overview from', selector, ':', overview);
                    break;
                }
            }
        }

        // Fallback: Look for overview in page text
        if (!overview) {
            const pageText = $('body').text();
            const overviewMatch = pageText.match(/Overview[:\s]*([^.\n]+)/i);
            if (overviewMatch) {
                overview = overviewMatch[1].trim();
                console.log('Found overview from page text:', overview);
            }
        }

        if (overview) {
            htmlData.overview = overview;
        }
    }

    extractDimensions($, htmlData) {
        let dimensions = '';

        // Extract dimensions from specific selectors
        const dimensionsSelectors = [
            '.dimensions',
            '.product-dimensions',
            '.pdp-dimensions',
            '.size',
            '.product-size'
        ];

        for (const selector of dimensionsSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                if (text && text.length > 5) {
                    dimensions = text;
                    console.log('Found dimensions from', selector, ':', dimensions);
                    break;
                }
            }
        }

        // Fallback: Look for dimensions in page text
        if (!dimensions) {
            const pageText = $('body').text();
            const dimensionsMatch = pageText.match(/Dimensions[:\s]*([^.\n]+)/i);
            if (dimensionsMatch) {
                dimensions = dimensionsMatch[1].trim();
                console.log('Found dimensions from page text:', dimensions);
            }
        }

        if (dimensions) {
            htmlData.dimensions = dimensions;
        }
    }
}

module.exports = HomeCentreScraper;
