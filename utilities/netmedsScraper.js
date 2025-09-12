const cheerio = require('cheerio');

class NetmedsScraper {
    constructor() {
        this.source = 'netmeds';
    }

    async scrapeProduct(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            
            // Try to extract from JSON data first
            const jsonData = this.extractJsonData($);
            let productData = {};
            
            if (jsonData) {
                productData = this.extractFromJson(jsonData);
            }
            
            // Fallback to HTML parsing
            const htmlData = this.extractFromHTML($);
            
            // Merge data, prioritizing JSON data
            const finalData = { ...htmlData, ...productData };
            
            return {
                success: true,
                message: 'Product scraped successfully',
                data: {
                    url: this.extractUrl($),
                    scrapedAt: new Date().toISOString(),
                    source: this.source,
                    product: finalData
                }
            };
            
        } catch (error) {
            console.error('Error scraping Netmeds product:', error);
            throw error;
        }
    }

    extractJsonData($) {
        try {
            // Look for JSON data in script tags
            const scriptTags = $('script');
            for (let i = 0; i < scriptTags.length; i++) {
                const scriptContent = $(scriptTags[i]).html();
                if (scriptContent && scriptContent.includes('window.__NUXT__')) {
                    const match = scriptContent.match(/window\.__NUXT__\s*=\s*({.*?});/s);
                    if (match) {
                        return JSON.parse(match[1]);
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('Error extracting JSON data:', error);
            return null;
        }
    }

    extractFromJson(jsonData) {
        const productData = {};
        
        try {
            // Navigate through the JSON structure to find product data
            if (jsonData.state && jsonData.state.product) {
                const product = jsonData.state.product;
                
                productData.title = product.name || product.title;
                productData.manufacturer = product.manufacturer || product.brand;
                productData.mrp = product.mrp || product.price;
                productData.sellingPrice = product.sellingPrice || product.discountedPrice;
                productData.description = product.description;
                productData.images = product.images || [];
                productData.category = product.category;
                productData.composition = product.composition;
                productData.uses = product.uses;
                productData.sideEffects = product.sideEffects;
                productData.howItWorks = product.howItWorks;
            }
            
            return productData;
        } catch (error) {
            console.error('Error extracting from JSON:', error);
            return {};
        }
    }

    extractFromHTML($) {
        const htmlData = {};
        
        // Extract product title/name
        const titleSelectors = [
            'h1',
            '.product-title',
            '.product-name',
            '[class*="title"]',
            '[class*="name"]'
        ];
        
        let productName = '';
        for (const selector of titleSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                if (text && text.length > 2 && !text.includes('Netmeds')) {
                    // Clean up the product name
                    const cleanedName = text
                        .replace(/^Order\s+/i, '')
                        .replace(/\s+Online.*$/i, '')
                        .replace(/\s+Price.*$/i, '')
                        .replace(/\s+-\s+Netmeds.*$/i, '')
                        .trim();
                    
                    if (cleanedName.length > 2) {
                        productName = cleanedName;
                        break;
                    }
                }
            }
        }
        
        // Fallback: Look for product name patterns in page text
        if (!productName) {
            const pageText = $('body').text();
            const namePatterns = [
                /([A-Za-z0-9\s]+)\s+(?:Tablet|Capsule|Strip|mg)\s+\d+['s]*/i,
                /([A-Za-z0-9\s]+)\s+(?:Tablet|Capsule|Strip|mg)/i
            ];
            
            for (const pattern of namePatterns) {
                const match = pageText.match(pattern);
                if (match && match[1]) {
                    const candidate = match[1].trim();
                    if (candidate.length > 2 && 
                        !candidate.includes('Order') && 
                        !candidate.includes('Online') &&
                        !candidate.includes('Netmeds') &&
                        !candidate.includes('Price')) {
                        productName = candidate;
                        break;
                    }
                }
            }
        }
        
        if (productName) {
            htmlData.title = productName;
        }
        
        // Extract manufacturer - look for "By [MANUFACTURER]" pattern
        let manufacturer = '';
        
        // Look for "By [MANUFACTURER]" pattern in the page
        const byPattern = /By\s+([A-Za-z\s&]+)/i;
        const pageText = $('body').text();
        const byMatch = pageText.match(byPattern);
        
        if (byMatch) {
            manufacturer = byMatch[1].trim();
        } else {
            // Fallback: Look for manufacturer patterns
            const manufacturerPatterns = [
                /([A-Za-z\s&]+)\s+Ltd/i,
                /([A-Za-z\s&]+)\s+Pharmaceuticals/i,
                /([A-Za-z\s&]+)\s+Labs/i
            ];
            
            for (const pattern of manufacturerPatterns) {
                const match = pageText.match(pattern);
                if (match) {
                    manufacturer = match[1].trim();
                    break;
                }
            }
        }
        
        // Clean up manufacturer name
        if (manufacturer) {
            manufacturer = manufacturer
                .replace(/Add to cart/gi, '')
                .replace(/Buy now/gi, '')
                .replace(/Order/gi, '')
                .trim();
            htmlData.manufacturer = manufacturer;
        }
        
        // Extract pricing
        this.extractPricing($, htmlData);
        
        // Extract description
        this.extractDescription($, htmlData);
        
        // Extract product details
        this.extractProductDetails($, htmlData);
        
        // Extract images
        this.extractImages($, htmlData);
        
        return htmlData;
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;
        
        // Extract selling price from prod-discount
        const sellingPriceElement = $('.prod-discount');
        if (sellingPriceElement.length) {
            const sellingPriceText = sellingPriceElement.text();
            const sellingPriceMatch = sellingPriceText.match(/₹\s*(\d+(?:\.\d+)?)/);
            if (sellingPriceMatch) {
                sellingPrice = parseFloat(sellingPriceMatch[1]);
                console.log('Found selling price from .prod-discount:', sellingPrice);
            }
        }
        
        // Extract MRP from strick element
        const mrpElement = $('.strick');
        if (mrpElement.length) {
            const mrpText = mrpElement.text();
            const mrpMatch = mrpText.match(/₹\s*(\d+(?:\.\d+)?)/);
            if (mrpMatch) {
                mrp = parseFloat(mrpMatch[1]);
                console.log('Found MRP from .strick:', mrp);
            }
        }
        
        // Extract discount percentage
        const discountElements = $('.web-discount, .msite-discount');
        if (discountElements.length) {
            const discountText = discountElements.text();
            const discountMatch = discountText.match(/(\d+)%\s*OFF/i);
            if (discountMatch) {
                discountPercent = parseInt(discountMatch[1]);
                console.log('Found discount percentage:', discountPercent);
            }
        }
        
        // Fallback: Look for pricing patterns in page text
        if (!sellingPrice || !mrp) {
            const pageText = $('body').text();
            
            // Look for price patterns like "₹30.84" and "₹34.27"
            const pricePattern = /₹\s*(\d+(?:\.\d+)?)/g;
            const prices = [];
            let match;
            
            while ((match = pricePattern.exec(pageText)) !== null) {
                const price = parseFloat(match[1]);
                if (price > 0 && price < 10000) { // Reasonable price range
                    prices.push(price);
                }
            }
            
            // Sort prices and assign (lower = selling price, higher = MRP)
            if (prices.length >= 2) {
                prices.sort((a, b) => a - b);
                if (!sellingPrice) sellingPrice = prices[0];
                if (!mrp) mrp = prices[prices.length - 1];
            } else if (prices.length === 1) {
                if (!sellingPrice) sellingPrice = prices[0];
            }
            
            // Look for MRP pattern specifically
            const mrpPattern = /MRP\s*₹\s*(\d+(?:\.\d+)?)/i;
            const mrpMatch = pageText.match(mrpPattern);
            if (mrpMatch && !mrp) {
                mrp = parseFloat(mrpMatch[1]);
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

    extractDescription($, htmlData) {
        const descriptionSelectors = [
            '.product-description',
            '.description',
            '[class*="description"]',
            '.product-info',
            '.product-details'
        ];
        
        let description = '';
        for (const selector of descriptionSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                if (text && text.length > 50) {
                    description = text;
                    break;
                }
            }
        }
        
        // Fallback to meta description
        if (!description) {
            description = $('meta[name="description"]').attr('content') ||
                         $('meta[property="og:description"]').attr('content');
        }
        
        if (description) {
            htmlData.description = description;
        }
    }

    extractProductDetails($, htmlData) {
        const pageText = $('body').text();
        
        // Extract composition/ingredients
        const compositionPatterns = [
            /Composition[:\s]*([^.\n]+)/i,
            /Ingredients[:\s]*([^.\n]+)/i,
            /Contains[:\s]*([^.\n]+)/i
        ];
        
        for (const pattern of compositionPatterns) {
            const match = pageText.match(pattern);
            if (match) {
                htmlData.composition = match[1].trim();
                break;
            }
        }
        
        // Extract uses
        const usesPatterns = [
            /Uses[:\s]*([^.\n]+)/i,
            /Indications[:\s]*([^.\n]+)/i,
            /Used for[:\s]*([^.\n]+)/i
        ];
        
        for (const pattern of usesPatterns) {
            const match = pageText.match(pattern);
            if (match) {
                htmlData.uses = match[1].trim();
                break;
            }
        }
        
        // Extract side effects
        const sideEffectsPatterns = [
            /Side effects[:\s]*([^.\n]+)/i,
            /Adverse effects[:\s]*([^.\n]+)/i,
            /Contraindications[:\s]*([^.\n]+)/i
        ];
        
        for (const pattern of sideEffectsPatterns) {
            const match = pageText.match(pattern);
            if (match) {
                htmlData.sideEffects = match[1].trim();
                break;
            }
        }
        
        // Extract how it works
        const howItWorksPatterns = [
            /How it works[:\s]*([^.\n]+)/i,
            /Mechanism of action[:\s]*([^.\n]+)/i,
            /Mode of action[:\s]*([^.\n]+)/i
        ];
        
        for (const pattern of howItWorksPatterns) {
            const match = pageText.match(pattern);
            if (match) {
                htmlData.howItWorks = match[1].trim();
                break;
            }
        }
        
        // Extract category
        const categoryPatterns = [
            /Category[:\s]*([^.\n]+)/i,
            /Therapeutic class[:\s]*([^.\n]+)/i
        ];
        
        for (const pattern of categoryPatterns) {
            const match = pageText.match(pattern);
            if (match) {
                htmlData.category = match[1].trim();
                break;
            }
        }
    }

    extractImages($, htmlData) {
        const images = [];
        
        // Look for product images
        $('img').each((i, img) => {
            const src = $(img).attr('src');
            if (src && this.isProductImage(src)) {
                images.push(src);
            }
        });
        
        if (images.length > 0) {
            htmlData.images = images;
        }
    }

    isProductImage(src) {
        // Filter out non-product images
        const excludePatterns = [
            /logo/i,
            /icon/i,
            /banner/i,
            /advertisement/i,
            /social/i,
            /footer/i,
            /header/i
        ];
        
        return !excludePatterns.some(pattern => pattern.test(src));
    }

    extractUrl($) {
        // Try to extract URL from meta tags or page data
        const ogUrl = $('meta[property="og:url"]').attr('content');
        if (ogUrl) return ogUrl;
        
        const canonicalUrl = $('link[rel="canonical"]').attr('href');
        if (canonicalUrl) return canonicalUrl;
        
        return 'https://www.netmeds.com';
    }

    calculateDiscount(mrp, sellingPrice) {
        if (mrp && sellingPrice && mrp > sellingPrice) {
            return mrp - sellingPrice;
        }
        return 0;
    }
}

module.exports = NetmedsScraper;
