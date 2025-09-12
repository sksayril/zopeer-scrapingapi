const cheerio = require('cheerio');

class WellnessForeverScraper {
    constructor() {
        this.source = 'WellnessForever';
    }

    async scrapeProduct(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            const htmlData = {};

            // Extract basic product information
            this.extractProductName($, htmlData);
            this.extractPricing($, htmlData);
            this.extractImages($, htmlData);
            this.extractProductDetails($, htmlData);
            this.extractOptions($, htmlData);
            this.extractDescription($, htmlData);

            return {
                scrapedAt: new Date().toISOString(),
                source: this.source,
                product: htmlData
            };
        } catch (error) {
            console.error('Error scraping Wellness Forever product:', error);
            throw error;
        }
    }

    extractProductName($, htmlData) {
        // Extract product name from the specific Wellness Forever structure
        const nameSelectors = [
            'h1.pb-1.text-base.font-semibold.text-secondary-900',
            'h1',
            '.product-title',
            '[data-testid="product-title"]'
        ];

        for (const selector of nameSelectors) {
            const element = $(selector);
            if (element.length) {
                const name = element.text().trim();
                if (name && name.length > 5) {
                    htmlData.name = name;
                    htmlData.title = name;
                    console.log('Found product name:', name);
                    break;
                }
            }
        }
    }

    extractPricing($, htmlData) {
        let mrp = null;

        // Extract MRP from the specific Wellness Forever structure
        const mrpSelectors = [
            '.flex.items-center.gap-2.pt-4 p',
            '.text-\\[22px\\].font-bold.text-secondary-800',
            '.mrp',
            '.original-price',
            '[data-testid="mrp"]'
        ];

        for (const selector of mrpSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/₹\s*([\d,]+\.?\d*)/);
                if (priceMatch) {
                    mrp = parseFloat(priceMatch[1].replace(/,/g, ''));
                    console.log('Found MRP from', selector, ':', mrp);
                    break;
                }
            }
        }

        // Fallback: Look for prices in page text
        if (!mrp) {
            const pageText = $('body').text();
            const pricePattern = /₹\s*([\d,]+\.?\d*)/g;
            const prices = [];
            let match;
            
            while ((match = pricePattern.exec(pageText)) !== null) {
                const price = parseFloat(match[1].replace(/,/g, ''));
                if (price > 0 && price < 1000000) { // Reasonable price range for health products
                    prices.push(price);
                }
            }
            
            if (prices.length > 0) {
                prices.sort((a, b) => b - a); // Sort descending to get highest price (likely MRP)
                mrp = prices[0];
                console.log('Found MRP from page text:', mrp);
            }
        }

        // Set the extracted values
        if (mrp) {
            htmlData.mrp = mrp;
            htmlData.sellingPrice = mrp; // Wellness Forever seems to show only MRP
        }

        console.log('Final pricing - MRP:', mrp);
    }

    extractImages($, htmlData) {
        const imageUrls = [];
        
        // Extract main product images from Wellness Forever structure
        $('img').each((i, el) => {
            const src = $(el).attr('src');
            if (src && this.isValidImageUrl(src)) {
                imageUrls.push(src);
            }
        });

        // Remove duplicates
        const uniqueImages = [...new Set(imageUrls)];
        
        if (uniqueImages.length > 0) {
            htmlData.images = uniqueImages;
        }
    }

    extractProductDetails($, htmlData) {
        const productDetails = {};

        // Extract manufacturer/marketer
        $('.flex.w-full.flex-wrap.items-center.gap-2.pt-2 p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.toLowerCase().includes('marketed by')) {
                productDetails.manufacturer = text.replace(/marketed by\s*/i, '').trim();
            } else if (text.includes('GM') || text.includes('KG')) {
                productDetails.packSize = text;
            } else if (text.toLowerCase().includes('in stock')) {
                productDetails.availability = text;
            }
        });

        // Extract pack size from the specific structure
        $('.flex.w-full.flex-wrap.items-center.gap-2.pt-2 div p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.includes('GM') || text.includes('KG')) {
                productDetails.packSize = text;
            }
        });

        // Extract availability status
        $('.ml-1\\.5.overflow-hidden.rounded-full.bg-primary-100.bg-opacity-30.px-2.py-1.text-xs.font-medium.text-secondary-700').each((i, el) => {
            const text = $(el).text().trim();
            if (text) {
                productDetails.availability = text;
            }
        });

        if (Object.keys(productDetails).length > 0) {
            htmlData.productDetails = productDetails;
        }
    }

    extractOptions($, htmlData) {
        const options = [];

        // Extract product options from the specific Wellness Forever structure
        $('.no-scrollbar.flex.gap-2.overflow-x-auto.whitespace-nowrap.pb-4 a h3').each((i, el) => {
            const optionText = $(el).text().trim();
            if (optionText && optionText.length > 3) {
                options.push(optionText);
            }
        });

        if (options.length > 0) {
            htmlData.options = options;
        }
    }

    extractDescription($, htmlData) {
        let description = '';

        // Extract description from the specific Wellness Forever structure
        $('.border-t-4.border-t-secondary-100.bg-white.px-4.text-justify.leading-5 p').each((i, el) => {
            const descText = $(el).text().trim();
            if (descText && descText.length > 10) {
                if (description) {
                    description += ' ' + descText;
                } else {
                    description = descText;
                }
            }
        });

        // Alternative selector for description
        if (!description) {
            $('.mb-2.text-xs.font-normal.leading-5.tracking-\\[0\\.4px\\].text-secondary-600 p').each((i, el) => {
                const descText = $(el).text().trim();
                if (descText && descText.length > 10) {
                    if (description) {
                        description += ' ' + descText;
                    } else {
                        description = descText;
                    }
                }
            });
        }

        if (description) {
            htmlData.description = description;
        }
    }

    isValidImageUrl(url) {
        if (!url) return false;
        
        // Filter out non-product images
        const excludePatterns = [
            'logo', 'icon', 'banner', 'advertisement', 'social', 'share',
            'facebook', 'twitter', 'instagram', 'youtube', 'linkedin',
            'playstore', 'appstore', 'download', 'arrow', 'button',
            'header', 'footer', 'navigation', 'menu', 'search',
            'placeholder', 'loading', 'spinner'
        ];
        
        const lowerUrl = url.toLowerCase();
        return !excludePatterns.some(pattern => lowerUrl.includes(pattern)) &&
               (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || 
                lowerUrl.includes('.png') || lowerUrl.includes('.webp') ||
                lowerUrl.includes('.gif') || lowerUrl.includes('.svg'));
    }

    calculateDiscount(mrp, sellingPrice) {
        if (mrp && sellingPrice && mrp > sellingPrice) {
            return mrp - sellingPrice;
        }
        return 0;
    }
}

module.exports = WellnessForeverScraper;
