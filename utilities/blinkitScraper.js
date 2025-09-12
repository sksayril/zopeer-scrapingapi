const cheerio = require('cheerio');

class BlinkitScraper {
    constructor() {
        this.source = 'Blinkit';
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
            this.extractHighlights($, productData.product);
            this.extractProductDetails($, productData.product);
            this.extractUnits($, productData.product);

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    extractFromHTML($, htmlData) {
        // Extract product name
        let productName = '';
        
        // Look for product name in various selectors
        const nameSelectors = [
            '.tw-text-600.tw-font-extrabold',
            '[data-pf="reset"] .tw-text-600',
            'h1',
            '.product-title',
            '.product-name'
        ];

        for (const selector of nameSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                if (text && text.length > 2 && !text.includes('Blinkit')) {
                    productName = text;
                    break;
                }
            }
        }

        // Fallback: Look for product name in page text
        if (!productName) {
            const pageText = $('body').text();
            const namePatterns = [
                /([A-Za-z0-9\s&]+)\s+(?:Butter|Spread|Product)/i,
                /([A-Za-z0-9\s&]+)\s+\d+\s*g/i
            ];

            for (const pattern of namePatterns) {
                const match = pageText.match(pattern);
                if (match && match[1]) {
                    const candidate = match[1].trim();
                    if (candidate.length > 2 &&
                        !candidate.includes('Blinkit') &&
                        !candidate.includes('Order') &&
                        !candidate.includes('Online')) {
                        productName = candidate;
                        break;
                    }
                }
            }
        }

        if (productName) {
            htmlData.title = productName;
        }

        // Extract brand/manufacturer
        const brandElement = $('.tw-text-200.tw-font-semibold');
        if (brandElement.length) {
            htmlData.brand = brandElement.text().trim();
        }

        // Extract category from breadcrumb
        const breadcrumbElement = $('.ProductInfoCard__BreadcrumbLink-sc-113r60q-8');
        if (breadcrumbElement.length) {
            const breadcrumbs = breadcrumbElement.map((i, el) => $(el).text().trim()).get();
            if (breadcrumbs.length > 1) {
                htmlData.category = breadcrumbs[breadcrumbs.length - 2]; // Second to last breadcrumb
            }
        }
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract prices from various selectors
        const priceSelectors = [
            '.tw-text-400.tw-font-bold',
            '.tw-text-300.tw-font-semibold',
            '.tw-text-300.tw-font-extrabold',
            '[class*="price"]',
            '[class*="Price"]'
        ];

        const prices = [];
        
        priceSelectors.forEach(selector => {
            $(selector).each((i, el) => {
                const text = $(el).text();
                const priceMatch = text.match(/₹\s*(\d+(?:\.\d+)?)/);
                if (priceMatch) {
                    const price = parseFloat(priceMatch[1]);
                    if (price > 0 && price < 10000) { // Reasonable price range
                        prices.push(price);
                    }
                }
            });
        });

        // Look for crossed out prices (MRP)
        $('.tw-line-through').each((i, el) => {
            const text = $(el).text();
            const priceMatch = text.match(/₹\s*(\d+(?:\.\d+)?)/);
            if (priceMatch) {
                mrp = parseFloat(priceMatch[1]);
            }
        });

        // Sort prices and assign
        if (prices.length > 0) {
            prices.sort((a, b) => a - b);
            sellingPrice = prices[0]; // Lowest price is usually selling price
            
            if (!mrp && prices.length > 1) {
                mrp = prices[prices.length - 1]; // Highest price could be MRP
            }
        }

        // Look for discount percentage
        const discountElements = $('[class*="discount"], [class*="off"]');
        discountElements.each((i, el) => {
            const text = $(el).text();
            const discountMatch = text.match(/(\d+)%\s*OFF/i);
            if (discountMatch) {
                discountPercent = parseInt(discountMatch[1]);
            }
        });

        // Set the extracted values
        if (mrp) htmlData.mrp = mrp;
        if (sellingPrice) htmlData.sellingPrice = sellingPrice;
        if (discountPercent) htmlData.discountPercent = discountPercent;

        // Calculate discount amount if both prices are available
        if (mrp && sellingPrice) {
            htmlData.discount = this.calculateDiscount(mrp, sellingPrice);
        }

        console.log('Blinkit Pricing - MRP:', mrp, 'Selling Price:', sellingPrice, 'Discount:', htmlData.discount);
    }

    extractImages($, htmlData) {
        const imageUrls = [];
        
        // Extract main product images
        $('img[src*="cdn.grofers.com"]').each((i, el) => {
            const src = $(el).attr('src');
            if (src && !imageUrls.includes(src)) {
                // Filter out non-product images
                if (src.includes('product') || src.includes('cms-assets')) {
                    imageUrls.push(src);
                }
            }
        });

        // Extract carousel images
        $('.ProductCarousel__CarouselImage-sc-11ow1fv-4').each((i, el) => {
            const src = $(el).attr('src');
            if (src && !imageUrls.includes(src)) {
                imageUrls.push(src);
            }
        });

        // Filter and prioritize high-quality images
        htmlData.images = imageUrls.filter(url => 
            url.includes('product') && 
            !url.includes('resize-w:80') &&
            !url.includes('logo') &&
            !url.includes('icon')
        );
    }

    extractHighlights($, htmlData) {
        const highlights = [];
        
        // Extract highlights from the highlights section
        $('[data-pf="reset"] .tw-text-300.tw-font-semibold.tw-text-center').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 1) {
                highlights.push(text);
            }
        });

        // Extract from highlights cards
        $('.tw-bg-grey-100 .tw-text-300.tw-font-semibold.tw-text-center').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 1 && !highlights.includes(text)) {
                highlights.push(text);
            }
        });

        if (highlights.length > 0) {
            htmlData.highlights = highlights;
        }
    }

    extractProductDetails($, htmlData) {
        const productDetails = {};
        
        // Extract product details from the product details section
        $('[id^="product_details_"]').each((i, el) => {
            const labelElement = $(el).find('.tw-text-300.tw-font-medium');
            const valueElement = $(el).find('.tw-text-200.tw-font-regular');
            
            if (labelElement.length && valueElement.length) {
                const label = labelElement.text().trim();
                const value = valueElement.text().trim();
                if (label && value) {
                    productDetails[label] = value;
                }
            }
        });

        if (Object.keys(productDetails).length > 0) {
            htmlData.productDetails = productDetails;
        }

        // Extract description from meta tags
        const description = $('meta[name="description"]').attr('content') ||
                           $('meta[property="og:description"]').attr('content');
        if (description) {
            htmlData.description = description;
        }
    }

    extractUnits($, htmlData) {
        const units = [];
        
        // Extract available units/variants
        $('[id^="variant_horizontal_rail"] [id]').each((i, el) => {
            const unitElement = $(el);
            const unitText = unitElement.find('.tw-text-200.tw-font-medium.tw-text-center').text().trim();
            const priceText = unitElement.find('.tw-text-300.tw-font-extrabold.tw-text-center').text().trim();
            
            if (unitText && priceText) {
                const priceMatch = priceText.match(/₹\s*(\d+(?:\.\d+)?)/);
                if (priceMatch) {
                    units.push({
                        size: unitText,
                        price: parseFloat(priceMatch[1])
                    });
                }
            }
        });

        // Also extract from the main pricing section
        $('.tw-flex.tw-items-center.tw-gap-1 .tw-text-300.tw-font-semibold').each((i, el) => {
            const text = $(el).text().trim();
            const priceMatch = text.match(/₹\s*(\d+(?:\.\d+)?)/);
            if (priceMatch) {
                const price = parseFloat(priceMatch[1]);
                // Check if this unit is already in the list
                const existingUnit = units.find(unit => unit.price === price);
                if (!existingUnit) {
                    units.push({
                        size: 'Standard',
                        price: price
                    });
                }
            }
        });

        if (units.length > 0) {
            htmlData.units = units;
        }
    }
}

module.exports = BlinkitScraper;
