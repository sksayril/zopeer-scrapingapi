const cheerio = require('cheerio');

class LiciousScraper {
    constructor() {
        this.source = 'Licious';
    }

    async scrapeProduct(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            const htmlData = {};

            // Extract basic product information
            this.extractProductName($, htmlData);
            this.extractPricing($, htmlData);
            this.extractImages($, htmlData);
            this.extractDescription($, htmlData);
            this.extractFeatures($, htmlData);

            return {
                scrapedAt: new Date().toISOString(),
                source: this.source,
                product: htmlData
            };
        } catch (error) {
            console.error('Error scraping Licious product:', error);
            throw error;
        }
    }

    extractProductName($, htmlData) {
        // Extract product name from the specific Licious structure
        const nameSelectors = [
            'h1.title_2.ProductDescription_productName__dABoC',
            '.ProductDescription_productName__dABoC',
            'h1.title_2',
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
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract selling price from the specific Licious structure
        const sellingPriceSelectors = [
            '.ProductDescription_pricingContainer_upperPart_priceSection_price__pneu5',
            '.ProductDescription_pricingContainer_upperPart_priceSection__3dHVB .ProductDescription_pricingContainer_upperPart_priceSection_price__pneu5',
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

        // Extract MRP from the specific Licious structure
        const mrpSelectors = [
            '.ProductDescription_pricingContainer_upperPart_priceSection_basePrice__GS3UA',
            '.ProductDescription_pricingContainer_upperPart_priceSection__3dHVB .ProductDescription_pricingContainer_upperPart_priceSection_basePrice__GS3UA',
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

        // Extract discount percentage
        const discountSelectors = [
            '.ProductDescription_pricingContainer_upperPart_priceSection_discount__MgDSj',
            '.ProductDescription_pricingContainer_upperPart_priceSection__3dHVB .ProductDescription_pricingContainer_upperPart_priceSection_discount__MgDSj',
            '.discount',
            '.off-percentage',
            '.pdp-discount',
            '[data-testid="discount"]'
        ];

        for (const selector of discountSelectors) {
            const element = $(selector);
            if (element.length) {
                const discountText = element.text().trim();
                const discountMatch = discountText.match(/(\d+)%\s*off/i);
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
            const pricePattern = /₹\s*([\d,]+\.?\d*)/g;
            const prices = [];
            let match;
            
            while ((match = pricePattern.exec(pageText)) !== null) {
                const price = parseFloat(match[1].replace(/,/g, ''));
                if (price > 0 && price < 1000000) { // Reasonable price range for food items
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
        
        // Extract main product images from Licious structure
        $('img').each((i, el) => {
            const src = $(el).attr('src');
            if (src && this.isValidImageUrl(src)) {
                imageUrls.push(src);
            }
        });

        // Also extract from specific image containers
        $('.TabsCardComponent_body_container_image__4m2Cu img').each((i, el) => {
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

    extractDescription($, htmlData) {
        let description = '';

        // Extract description from the specific Licious structure
        $('.ProductDescription_productDescription_detail_wrapped__mgZcA p').each((i, el) => {
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
            $('#product_description p').each((i, el) => {
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

    extractFeatures($, htmlData) {
        const features = {
            included: [],
            excluded: []
        };

        // Extract features from the specific Licious structure
        $('.ProductDescription_middleContent_body_contentContainer_prosconssections_items__MgUEo').each((i, el) => {
            const featureText = $(el).find('.ProductDescription_middleContent_body_contentContainer_prosconssections_items_texts__x9lPv').text().trim();
            const hasCheckMark = $(el).find('img[alt="content-status"][src*="check-mark"]').length > 0;
            const hasCrossMark = $(el).find('img[alt="content-status"][src*="cross-mark"]').length > 0;
            
            if (featureText && featureText.length > 3) {
                if (hasCheckMark) {
                    features.included.push(featureText);
                } else if (hasCrossMark) {
                    features.excluded.push(featureText);
                }
            }
        });

        if (features.included.length > 0 || features.excluded.length > 0) {
            htmlData.features = features;
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
            'placeholder', 'loading', 'spinner', 'check-mark', 'cross-mark',
            'plus-white', 'data:image/svg+xml'
        ];
        
        const lowerUrl = url.toLowerCase();
        return !excludePatterns.some(pattern => lowerUrl.includes(pattern)) &&
               (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || 
                lowerUrl.includes('.png') || lowerUrl.includes('.webp') ||
                lowerUrl.includes('.gif') || lowerUrl.includes('.svg')) &&
               !lowerUrl.startsWith('data:');
    }

    calculateDiscount(mrp, sellingPrice) {
        if (mrp && sellingPrice && mrp > sellingPrice) {
            return mrp - sellingPrice;
        }
        return 0;
    }
}

module.exports = LiciousScraper;
