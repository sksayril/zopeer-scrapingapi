const cheerio = require('cheerio');

class SwiggyInstamartScraper {
    constructor() {
        this.source = 'Swiggy Instamart';
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
            this.extractDescription($, productData.product);
            this.extractWeight($, productData.product);

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    extractFromHTML($, htmlData) {
        // Extract product name/title from the specific selector
        let productName = '';
        
        // Primary selector for product name
        const nameElement = $('[data-testid="item-name"]');
        if (nameElement.length) {
            productName = nameElement.text().trim();
            console.log('Found product name from data-testid="item-name":', productName);
        }

        // Fallback selectors
        if (!productName) {
            const fallbackSelectors = [
                'h1.sc-aXZVg.gPfbij._3c6ni',
                'h1',
                '.product-title',
                '.product-name'
            ];

            for (const selector of fallbackSelectors) {
                const element = $(selector);
                if (element.length) {
                    const text = element.text().trim();
                    if (text && text.length > 2 && !text.includes('Swiggy')) {
                        productName = text;
                        console.log('Found product name from fallback selector:', selector, productName);
                        break;
                    }
                }
            }
        }

        // Additional fallback: Look for product name in page text
        if (!productName) {
            const pageText = $('body').text();
            const namePatterns = [
                /Kellogg's\s+[A-Za-z0-9\s&',-]+(?:flavoured|flavor|snack|breakfast|cereal)/i,
                /([A-Za-z0-9\s&',-]+)\s+(?:flavoured|flavor|snack|breakfast|cereal)/i
            ];

            for (const pattern of namePatterns) {
                const match = pageText.match(pattern);
                if (match) {
                    const candidate = match[0].trim();
                    if (candidate.length > 2 &&
                        !candidate.includes('Swiggy') &&
                        !candidate.includes('Order') &&
                        !candidate.includes('Online')) {
                        productName = candidate;
                        console.log('Found product name from text pattern:', productName);
                        break;
                    }
                }
            }
        }

        if (productName) {
            htmlData.title = productName;
        }

        // Extract brand from product name
        if (productName) {
            const brandMatch = productName.match(/^([A-Za-z\s&',-]+?)\s+/);
            if (brandMatch) {
                htmlData.brand = brandMatch[1].trim();
            }
        }
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract selling price from offer price
        const sellingPriceElement = $('[data-testid="item-offer-price"]');
        if (sellingPriceElement.length) {
            const sellingPriceText = sellingPriceElement.text().trim();
            const sellingPriceMatch = sellingPriceText.match(/(\d+)/);
            if (sellingPriceMatch) {
                sellingPrice = parseInt(sellingPriceMatch[1]);
                console.log('Found selling price from data-testid="item-offer-price":', sellingPrice);
            }
        }

        // Extract MRP from MRP price
        const mrpElement = $('[data-testid="item-mrp-price"]');
        if (mrpElement.length) {
            const mrpText = mrpElement.text().trim();
            const mrpMatch = mrpText.match(/(\d+)/);
            if (mrpMatch) {
                mrp = parseInt(mrpMatch[1]);
                console.log('Found MRP from data-testid="item-mrp-price":', mrp);
            }
        }

        // Extract discount percentage from offer label
        const discountElement = $('[data-testid="item-offer-label-discount-text"]');
        if (discountElement.length) {
            const discountText = discountElement.text().trim();
            const discountMatch = discountText.match(/(\d+)%\s*OFF/i);
            if (discountMatch) {
                discountPercent = parseInt(discountMatch[1]);
                console.log('Found discount percentage from data-testid="item-offer-label-discount-text":', discountPercent);
            }
        }

        // Fallback: Look for prices in the price container
        if (!sellingPrice || !mrp) {
            const priceContainer = $('._20EAu');
            if (priceContainer.length) {
                const offerPriceElement = priceContainer.find('[data-testid="item-offer-price"]');
                const mrpPriceElement = priceContainer.find('[data-testid="item-mrp-price"]');
                
                if (offerPriceElement.length && !sellingPrice) {
                    const text = offerPriceElement.text().trim();
                    const match = text.match(/(\d+)/);
                    if (match) {
                        sellingPrice = parseInt(match[1]);
                        console.log('Found selling price from price container:', sellingPrice);
                    }
                }
                
                if (mrpPriceElement.length && !mrp) {
                    const text = mrpPriceElement.text().trim();
                    const match = text.match(/(\d+)/);
                    if (match) {
                        mrp = parseInt(match[1]);
                        console.log('Found MRP from price container:', mrp);
                    }
                }
            }
        }

        // Additional fallback: Look for prices in page text
        if (!sellingPrice || !mrp) {
            const pageText = $('body').text();
            const pricePattern = /₹?\s*(\d+)/g;
            const prices = [];
            let match;
            
            while ((match = pricePattern.exec(pageText)) !== null) {
                const price = parseInt(match[1]);
                if (price > 0 && price < 10000) { // Reasonable price range
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
        
        // Extract main product image from the image card
        const mainImageElement = $('[data-testid="image-card-div"] img');
        if (mainImageElement.length) {
            const src = mainImageElement.attr('src');
            if (src && !imageUrls.includes(src)) {
                imageUrls.push(src);
                console.log('Found main product image:', src);
            }
        }

        // Extract images from carousel or gallery
        $('img[src*="instamart-media-assets"]').each((i, el) => {
            const src = $(el).attr('src');
            if (src && !imageUrls.includes(src)) {
                // Filter out non-product images
                if (src.includes('NI_CATALOG') || 
                    src.includes('product') ||
                    (src.includes('instamart-media-assets') && 
                     !src.includes('logo') &&
                     !src.includes('icon') &&
                     !src.includes('Offer%20Tag') &&
                     !src.includes('ErrorStates'))) {
                    imageUrls.push(src);
                    console.log('Found additional image:', src);
                }
            }
        });

        // Filter and prioritize high-quality images
        htmlData.images = imageUrls.filter(url => 
            url.includes('instamart-media-assets') && 
            !url.includes('logo') &&
            !url.includes('icon') &&
            !url.includes('Offer%20Tag') &&
            !url.includes('ErrorStates') &&
            !url.includes('facebook') &&
            !url.includes('twitter') &&
            !url.includes('instagram')
        );
    }

    extractHighlights($, htmlData) {
        const highlights = [];
        
        // Extract highlights from the highlights section
        $('[data-testid="product-highlights-table"] ._3Lj8S').each((i, el) => {
            const labelElement = $(el).find('._3F5nE .sc-aXZVg');
            const valueElement = $(el).find('.F53lh .sc-aXZVg');
            
            if (labelElement.length && valueElement.length) {
                const label = labelElement.text().trim();
                const value = valueElement.text().trim();
                if (label && value) {
                    highlights.push(`${label}: ${value}`);
                }
            }
        });

        // Extract from highlights cards
        $('[data-testid="product-highlights-container"] .sc-aXZVg').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 1 && !text.includes('Highlights') && !highlights.includes(text)) {
                highlights.push(text);
            }
        });

        if (highlights.length > 0) {
            htmlData.highlights = highlights;
        }
    }

    extractDescription($, htmlData) {
        let description = '';
        
        // Extract description from the description section
        const descriptionElement = $('[data-testid="product-description"], ._3g9ka .sc-aXZVg');
        if (descriptionElement.length) {
            description = descriptionElement.text().trim();
        }

        // Fallback: Look for description in other elements
        if (!description) {
            const descSelectors = [
                '.sc-aXZVg.hwUmr._2VVHm p',
                '.description',
                '[class*="description"]'
            ];

            for (const selector of descSelectors) {
                const element = $(selector);
                if (element.length) {
                    description = element.text().trim();
                    if (description) break;
                }
            }
        }

        // Extract from meta tags
        if (!description) {
            description = $('meta[name="description"]').attr('content') ||
                         $('meta[property="og:description"]').attr('content');
        }

        if (description) {
            htmlData.description = description;
        }
    }

    extractWeight($, htmlData) {
        let weight = '';
        
        // Extract weight from the specific selector
        const weightElement = $('.sc-aXZVg.kYaBqd._1TwvP');
        if (weightElement.length) {
            const text = weightElement.text().trim();
            const weightMatch = text.match(/(\d+\s*g)/i);
            if (weightMatch) {
                weight = weightMatch[1];
                console.log('Found weight from .sc-aXZVg.kYaBqd._1TwvP:', weight);
            }
        }

        // Fallback selectors
        if (!weight) {
            const weightSelectors = [
                '[data-testid="item-weight"]',
                '.weight',
                '[class*="weight"]'
            ];

            for (const selector of weightSelectors) {
                const element = $(selector);
                if (element.length) {
                    const text = element.text().trim();
                    const weightMatch = text.match(/(\d+\s*g)/i);
                    if (weightMatch) {
                        weight = weightMatch[1];
                        console.log('Found weight from fallback selector:', selector, weight);
                        break;
                    }
                }
            }
        }

        // Fallback: Look for weight patterns in page text
        if (!weight) {
            const pageText = $('body').text();
            const weightPatterns = [
                /(\d+\s*g)/i,
                /(\d+\s*grams?)/i,
                /(\d+\s*kg)/i
            ];

            for (const pattern of weightPatterns) {
                const match = pageText.match(pattern);
                if (match) {
                    weight = match[1];
                    console.log('Found weight from text pattern:', weight);
                    break;
                }
            }
        }

        if (weight) {
            htmlData.weight = weight;
        }
    }
}

module.exports = SwiggyInstamartScraper;
