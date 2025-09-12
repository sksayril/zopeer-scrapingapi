const cheerio = require('cheerio');

class DmartScraper {
    constructor() {
        this.source = 'DMart';
    }

    async scrapeProduct(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            const htmlData = {};

            // Extract basic product information
            this.extractProductName($, htmlData);
            this.extractPricing($, htmlData);
            this.extractImages($, htmlData);
            this.extractVariants($, htmlData);
            this.extractDescription($, htmlData);
            this.extractBrand($, htmlData);

            return {
                scrapedAt: new Date().toISOString(),
                source: this.source,
                product: htmlData
            };
        } catch (error) {
            console.error('Error scraping DMart product:', error);
            throw error;
        }
    }

    extractProductName($, htmlData) {
        // Extract product name from the specific DMart structure
        const nameSelectors = [
            'h1.text-label-component_title-container__Bcu9q',
            '.text-label-component_title__Qk1fy',
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
        let sellingPrice = null, mrp = null, discount = null;

        // Extract selling price from the specific DMart structure
        const sellingPriceSelectors = [
            '.price-details-component_sp__u2K5a .price-details-component_value__IvVER',
            '.price-details-component_value__IvVER',
            '.selling-price',
            '.offer-price',
            '.pdp-price',
            '[data-testid="selling-price"]'
        ];

        for (const selector of sellingPriceSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/₹\s*([\d,]+\.?\d*)/);
                if (priceMatch) {
                    sellingPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
                    console.log('Found selling price from', selector, ':', sellingPrice);
                    break;
                }
            }
        }

        // Extract MRP from the specific DMart structure
        const mrpSelectors = [
            '.price-details-component_mrp__jSGYV .price-details-component_value__IvVER',
            '.price-details-component_mrp__jSGYV',
            '.mrp',
            '.original-price',
            '[data-testid="mrp"]',
            'strike',
            'del'
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

        // Extract discount amount
        const discountSelectors = [
            '.price-details-component_save__nUu3g',
            '.price-details-component_saveHighlighter__FIIS_',
            '.discount',
            '.off-amount',
            '[data-testid="discount"]'
        ];

        for (const selector of discountSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const discountMatch = text.match(/₹\s*([\d,]+\.?\d*)/);
                if (discountMatch) {
                    discount = parseFloat(discountMatch[1].replace(/,/g, ''));
                    console.log('Found discount from', selector, ':', discount);
                    break;
                }
            }
        }

        // Fallback: Look for prices in page text
        if (!sellingPrice || !mrp) {
            const pageText = $('body').text();
            const pricePattern = /₹\s*([\d,]+\.?\d*)/g;
            const prices = [];
            let match;
            
            while ((match = pricePattern.exec(pageText)) !== null) {
                const price = parseFloat(match[1].replace(/,/g, ''));
                if (price > 0 && price < 1000000) { // Reasonable price range for retail items
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
        if (discount) htmlData.discount = discount;

        // Calculate discount percentage if both prices are available
        if (mrp && sellingPrice) {
            htmlData.discountPercent = Math.round(((mrp - sellingPrice) / mrp) * 100);
        }

        console.log('Final pricing - MRP:', mrp, 'Selling Price:', sellingPrice, 'Discount:', discount);
    }

    extractImages($, htmlData) {
        const imageUrls = [];
        
        // Extract main product images from DMart structure
        $('.image-gallery_component_thumbnail-img___72hl, .image-gallery_component_image__af1Y7 img').each((i, el) => {
            const src = $(el).attr('src');
            if (src && this.isValidImageUrl(src)) {
                imageUrls.push(src);
            }
        });

        // Also extract from swiper slides
        $('.swiper-slide img').each((i, el) => {
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

    extractVariants($, htmlData) {
        const variants = [];

        // Extract product variants from the specific DMart structure
        $('.horizontal-single-variants-component__item__DQGLa').each((i, el) => {
            const variant = {};
            
            // Extract volume/size
            const volumeElement = $(el).find('.horizontal-single-variants-component__volume__PCe8w');
            if (volumeElement.length) {
                variant.volume = volumeElement.text().trim();
            }
            
            // Extract price per unit
            const pricePerUnitElement = $(el).find('.horizontal-single-variants-component__variant-infotxtvalue-value__RXbrS');
            if (pricePerUnitElement.length) {
                variant.pricePerUnit = pricePerUnitElement.text().trim();
            }
            
            // Extract discount/savings
            const discountElement = $(el).find('.horizontal-single-variants-component__saveHighlightsdisplay__UuFj4');
            if (discountElement.length) {
                variant.discount = discountElement.text().trim();
            }
            
            // Check if this variant is selected
            if ($(el).hasClass('horizontal-single-variants-component__selected__w0Zyx')) {
                variant.isSelected = true;
            }
            
            if (variant.volume) {
                variants.push(variant);
            }
        });

        if (variants.length > 0) {
            htmlData.variants = variants;
        }
    }

    extractDescription($, htmlData) {
        let description = '';

        // Extract description from the specific DMart structure
        $('div[role="tabpanel"] div[style*="white-space: pre-wrap"] p').each((i, el) => {
            const descText = $(el).text().trim();
            if (descText && descText.length > 10) {
                if (description) {
                    description += '\n\n' + descText;
                } else {
                    description = descText;
                }
            }
        });

        // Alternative selector for description
        if (!description) {
            $('.common_description-section__qhC_F p').each((i, el) => {
                const descText = $(el).text().trim();
                if (descText && descText.length > 10) {
                    if (description) {
                        description += '\n\n' + descText;
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

    extractBrand($, htmlData) {
        // Extract brand from the specific DMart structure
        const brandSelectors = [
            '.common_brand-link-horizontal__MCanP',
            '.brand-name',
            '.manufacturer',
            '[data-testid="brand"]'
        ];

        for (const selector of brandSelectors) {
            const element = $(selector);
            if (element.length) {
                const brand = element.text().trim();
                if (brand && brand.length > 1) {
                    htmlData.brand = brand;
                    console.log('Found brand:', brand);
                    break;
                }
            }
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
            'placeholder', 'loading', 'spinner', 'payment', 'visa',
            'mastercard', 'american', 'rupay', 'cash'
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

module.exports = DmartScraper;
