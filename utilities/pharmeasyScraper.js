const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

class PharmEasyScraper {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async init() {
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        this.page = await this.browser.newPage();
        
        // Set user agent to avoid detection
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Set viewport
        await this.page.setViewport({ width: 1366, height: 768 });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async scrapeProduct(url) {
        try {
            console.log('Scraping PharmEasy product:', url);
            
            // Navigate to the page
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Wait for content to load
            await this.page.waitForTimeout(3000);

            // Get page content
            const content = await this.page.content();
            const $ = cheerio.load(content);

            // Extract product data
            const productData = await this.extractProductData($, url);

            return productData;
        } catch (error) {
            console.error('Error scraping PharmEasy product:', error);
            throw error;
        }
    }

    async extractProductData($, url) {
        try {
            const productData = {
                url: url,
                scrapedAt: new Date().toISOString(),
                source: 'pharmeasy',
                product: {}
            };

            // Extract data from HTML structure
            const htmlData = this.extractFromHTML($);
            productData.product = { ...productData.product, ...htmlData };

            // Try to extract from JSON data if available
            const jsonData = this.extractFromJSON($);
            if (jsonData) {
                productData.product = { ...productData.product, ...jsonData };
            }

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    extractFromHTML($) {
        const htmlData = {};
        
        // Extract product name - look for the main product title
        let productName = '';
        
        // Look for specific product name patterns in the HTML structure
        const productNameSelectors = [
            'h1',
            '.product-title',
            '.product-name',
            '[class*="title"]',
            '[class*="name"]'
        ];
        
        // Try to find product name using selectors first
        for (const selector of productNameSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                // Look for patterns like "Dolo 650 Tablet"
                const nameMatch = text.match(/([A-Za-z0-9\s]+)\s+(?:Tablet|Capsule|Strip|mg)/i);
                if (nameMatch && nameMatch[1]) {
                    const candidate = nameMatch[1].trim();
                    if (candidate.length > 2 && 
                        !candidate.includes('Order') && 
                        !candidate.includes('Online') &&
                        !candidate.includes('PharmEasy') &&
                        !candidate.includes('Medicine') &&
                        !candidate.includes('OFF') &&
                        !candidate.includes('Add')) {
                        productName = candidate;
                        break;
                    }
                }
            }
        }
        
        // If not found, look for product name patterns in page text
        if (!productName) {
            const pageText = $('body').text();
            const productNamePatterns = [
                /([A-Za-z0-9\s]+)\s+Tablet/i,
                /([A-Za-z0-9\s]+)\s+Capsule/i,
                /([A-Za-z0-9\s]+)\s+Strip/i,
                /([A-Za-z0-9\s]+)\s+mg/i
            ];
            
            // Try to find product name using patterns
            for (const pattern of productNamePatterns) {
                const match = pageText.match(pattern);
                if (match && match[1]) {
                    const candidate = match[1].trim();
                    // Filter out common false positives
                    if (candidate.length > 3 && 
                        !candidate.includes('Order') && 
                        !candidate.includes('Online') &&
                        !candidate.includes('PharmEasy') &&
                        !candidate.includes('Medicine') &&
                        !candidate.includes('OFF') &&
                        !candidate.includes('Add')) {
                        productName = candidate;
                        break;
                    }
                }
            }
        }
        
        // Fallback to specific selectors
        if (!productName) {
            const fallbackSelectors = [
                '.ProductDetails_name__2x8dJ',
                '.ProductDetails_title__2x8dJ',
                '.product-name',
                '.product-title',
                'h1[class*="product"]',
                'h1[class*="Product"]',
                '.ProductCard_name__2x8dJ',
                '.ProductCard_title__2x8dJ'
            ];
            
            fallbackSelectors.forEach(selector => {
                if (!productName) {
                    const element = $(selector);
                    if (element.length) {
                        const text = element.text().trim();
                        // Clean the text before using it
                        const cleanedText = text
                            .replace(/^Order\s+/i, '')
                            .replace(/\s+Online.*$/i, '')
                            .replace(/\s+at\s+discount.*$/i, '')
                            .replace(/\s+-\s+PharmEasy.*$/i, '')
                            .trim();
                        
                        if (cleanedText.length > 2 && 
                            !cleanedText.includes('OFF') &&
                            !cleanedText.includes('Add')) {
                            productName = cleanedText;
                        }
                    }
                }
            });
        }
        
        // Final fallback to meta tags or page title
        if (!productName) {
            const metaTitle = $('meta[property="og:title"]').attr('content');
            const h1Title = $('h1').first().text().trim();
            const pageTitle = $('title').text().trim();
            
            const fallbackTitle = metaTitle || h1Title || pageTitle;
            if (fallbackTitle) {
                productName = fallbackTitle
                    .replace(/^Order\s+/i, '')
                    .replace(/\s+Online.*$/i, '')
                    .replace(/\s+at\s+discount.*$/i, '')
                    .replace(/\s+-\s+PharmEasy.*$/i, '')
                    .trim();
            }
        }
        
        // Final cleanup of the product name
        if (productName) {
            productName = productName
                .replace(/\s+Strip.*$/i, '')
                .replace(/\s+Tablet.*$/i, '')
                .replace(/\s+Capsule.*$/i, '')
                .replace(/\s+mg.*$/i, '')
                .trim();
            
            // Only use if it's a reasonable product name
            if (productName.length > 2 && 
                !productName.includes('OFF') &&
                !productName.includes('Add') &&
                !productName.includes('Order') &&
                !productName.includes('Online')) {
                htmlData.title = productName;
            }
        }
        
        // Extract description from meta tags
        const description = $('meta[name="description"]').attr('content') ||
                           $('meta[property="og:description"]').attr('content');
        if (description) htmlData.description = description;
        
        // Extract product images
        const images = [];
        $('img').each((i, el) => {
            const src = $(el).attr('src');
            if (src && 
                !src.includes('logo') && 
                !src.includes('icon') && 
                !src.includes('banner') &&
                !src.includes('tracking') &&
                !src.includes('analytics') &&
                (src.includes('pharmeasy.in') || src.includes('cdn01.pharmeasy.in')) &&
                !images.includes(src)) {
                images.push(src);
            }
        });
        if (images.length > 0) htmlData.images = images;
        
        // Extract pricing information
        this.extractPricing($, htmlData);
        
        // Extract product details
        this.extractProductDetails($, htmlData);
        
        // Extract uses and side effects
        this.extractUsesAndSideEffects($, htmlData);
        
        return htmlData;
    }

    extractPricing($, htmlData) {
        // Look for price elements with PharmEasy-specific selectors
        const priceSelectors = [
            '.PriceInfo_price__2x8dJ',
            '.PriceInfo_strikedPrice__2x8dJ',
            '.PriceInfo_discount__2x8dJ',
            '.ProductDetails_price__2x8dJ',
            '.ProductDetails_mrp__2x8dJ',
            '.ProductDetails_sellingPrice__2x8dJ',
            '[class*="price"]',
            '[class*="Price"]',
            '.price',
            '.mrp',
            '.selling-price',
            '.discounted-price'
        ];
        
        let mrp = null, sellingPrice = null, discount = null;
        
        priceSelectors.forEach(selector => {
            const priceElement = $(selector);
            if (priceElement.length) {
                const priceText = priceElement.text();
                const priceMatch = priceText.match(/₹?[\d,]+/);
                if (priceMatch) {
                    const price = parseInt(priceMatch[0].replace(/[₹,]/g, ''));
                    if (selector.includes('striked') || selector.includes('mrp')) {
                        mrp = price;
                    } else if (selector.includes('discount')) {
                        discount = price;
                    } else if (!sellingPrice) {
                        sellingPrice = price;
                    }
                }
            }
        });
        
        // Look for price patterns in the page text
        const pricePageText = $('body').text();
        
        // Look for price patterns like "₹25.02✱ ₹34.27"
        const pricePattern = /₹(\d+(?:\.\d+)?)[✱\s]*₹(\d+(?:\.\d+)?)/;
        const priceMatch = pricePageText.match(pricePattern);
        
        if (priceMatch) {
            const price1 = parseFloat(priceMatch[1]);
            const price2 = parseFloat(priceMatch[2]);
            
            // The lower price is usually the selling price, higher is MRP
            if (price1 < price2) {
                sellingPrice = price1;
                mrp = price2;
            } else {
                sellingPrice = price2;
                mrp = price1;
            }
        }
        
        // Look for "Offer Price" and "You Save" patterns
        const offerPricePattern = /Offer Price₹(\d+(?:\.\d+)?)/;
        const youSavePattern = /You Save₹(\d+(?:\.\d+)?)/;
        
        const offerMatch = pricePageText.match(offerPricePattern);
        const saveMatch = pricePageText.match(youSavePattern);
        
        if (offerMatch) {
            sellingPrice = parseFloat(offerMatch[1]);
        }
        
        if (saveMatch && sellingPrice) {
            const savings = parseFloat(saveMatch[1]);
            mrp = sellingPrice + savings;
        }
        
        // Look for price in specific PharmEasy price containers
        const priceContainers = [
            '.PriceInfo_container__2x8dJ',
            '.ProductDetails_priceContainer__2x8dJ',
            '.price-container',
            '.pricing-section'
        ];
        
        priceContainers.forEach(container => {
            const containerElement = $(container);
            if (containerElement.length) {
                const containerText = containerElement.text();
                const prices = containerText.match(/₹[\d,]+/g);
                if (prices && prices.length > 0) {
                    prices.forEach(priceStr => {
                        const price = parseInt(priceStr.replace(/[₹,]/g, ''));
                        if (price > 0 && price < 10000) {
                            if (!sellingPrice) {
                                sellingPrice = price;
                            } else if (!mrp && price > sellingPrice) {
                                mrp = price;
                            }
                        }
                    });
                }
            }
        });
        
        // Fallback: look for any price-like text in the entire page
        if (!sellingPrice || !mrp) {
            $('*').each((i, el) => {
                const text = $(el).text();
                const prices = text.match(/₹[\d,]+/g);
                if (prices && prices.length > 0) {
                    prices.forEach(priceStr => {
                        const price = parseInt(priceStr.replace(/[₹,]/g, ''));
                        if (price > 0 && price < 10000) { // Reasonable price range
                            if (!sellingPrice) {
                                sellingPrice = price;
                            } else if (!mrp && price > sellingPrice) {
                                mrp = price;
                            }
                        }
                    });
                }
            });
        }
        
        if (mrp) htmlData.mrp = mrp;
        if (sellingPrice) htmlData.sellingPrice = sellingPrice;
        if (mrp && sellingPrice) {
            htmlData.discount = this.calculateDiscount(mrp, sellingPrice);
        }
        if (discount) htmlData.discountPercent = discount;
    }

    extractProductDetails($, htmlData) {
        // Extract product summary from various sections
        const summarySelectors = [
            '.ProductDetails_summary__2x8dJ',
            '.ProductDetails_description__2x8dJ',
            '.product-summary',
            '.product-description',
            '[class*="summary"]',
            '[class*="description"]',
            '.ProductInfo_description__2x8dJ',
            '.ProductInfo_summary__2x8dJ'
        ];
        
        let summary = '';
        summarySelectors.forEach(selector => {
            if (!summary) {
                const element = $(selector);
                if (element.length) {
                    summary = element.text().trim();
                }
            }
        });
        
        if (summary) htmlData.summary = summary;
        
        // Extract manufacturer information - look for "By" pattern
        let manufacturer = '';
        
        // Look for "By [MANUFACTURER]" pattern in the page
        const byPattern = /By\s+([A-Z\s&]+)/i;
        const pageText = $('body').text();
        const byMatch = pageText.match(byPattern);
        
        if (byMatch) {
            manufacturer = byMatch[1].trim();
        } else {
            // Fallback to specific selectors
            const manufacturerSelectors = [
                '.ProductDetails_manufacturer__2x8dJ',
                '.ProductInfo_manufacturer__2x8dJ',
                '[class*="manufacturer"]',
                'span:contains("By")',
                'div:contains("By")'
            ];
            
            manufacturerSelectors.forEach(selector => {
                if (!manufacturer) {
                    const element = $(selector);
                    if (element.length) {
                        const text = element.text().trim();
                        const match = text.match(/By\s+([A-Z\s&]+)/i);
                        if (match) {
                            manufacturer = match[1].trim();
                        }
                    }
                }
            });
        }
        
        if (manufacturer) htmlData.manufacturer = manufacturer;
        
        // Extract composition/ingredients
        const compositionSelectors = [
            '.ProductDetails_composition__2x8dJ',
            '.ProductInfo_composition__2x8dJ',
            '[class*="composition"]',
            'span:contains("Composition")',
            'div:contains("Composition")',
            'span:contains("Ingredients")',
            'div:contains("Ingredients")'
        ];
        
        let composition = '';
        compositionSelectors.forEach(selector => {
            if (!composition) {
                const element = $(selector);
                if (element.length) {
                    composition = element.text().trim();
                }
            }
        });
        
        if (composition) htmlData.composition = composition;
        
        // Extract pack size - look for patterns like "15 Tablet(s) in Strip"
        let packSize = '';
        
        // Look for pack size patterns
        const packSizePatterns = [
            /(\d+)\s+Tablet\(s\)\s+in\s+Strip/i,
            /(\d+)\s+Capsule\(s\)\s+in\s+Strip/i,
            /(\d+)\s+Tablet\(s\)/i,
            /(\d+)\s+Capsule\(s\)/i,
            /Strip\s+of\s+(\d+)/i,
            /Pack\s+of\s+(\d+)/i
        ];
        
        const packPageText = $('body').text();
        
        for (const pattern of packSizePatterns) {
            const match = packPageText.match(pattern);
            if (match) {
                packSize = match[0].trim();
                break;
            }
        }
        
        // Fallback to specific selectors
        if (!packSize) {
            const packSizeSelectors = [
                '.ProductDetails_packSize__2x8dJ',
                '.ProductInfo_packSize__2x8dJ',
                '[class*="pack"]',
                'span:contains("Pack Size")',
                'div:contains("Pack Size")',
                'span:contains("Pack of")',
                'div:contains("Pack of")'
            ];
            
            packSizeSelectors.forEach(selector => {
                if (!packSize) {
                    const element = $(selector);
                    if (element.length) {
                        packSize = element.text().trim();
                    }
                }
            });
        }
        
        if (packSize) htmlData.packSize = packSize;
        
        // Extract brand information
        const brandSelectors = [
            '.ProductDetails_brand__2x8dJ',
            '.ProductInfo_brand__2x8dJ',
            '[class*="brand"]',
            'span:contains("Brand")',
            'div:contains("Brand")'
        ];
        
        let brand = '';
        brandSelectors.forEach(selector => {
            if (!brand) {
                const element = $(selector);
                if (element.length) {
                    brand = element.text().trim();
                }
            }
        });
        
        if (brand) htmlData.brand = brand;
        
        // Extract product ID/SKU
        const skuSelectors = [
            '.ProductDetails_sku__2x8dJ',
            '.ProductInfo_sku__2x8dJ',
            '[class*="sku"]',
            'span:contains("SKU")',
            'div:contains("SKU")'
        ];
        
        let sku = '';
        skuSelectors.forEach(selector => {
            if (!sku) {
                const element = $(selector);
                if (element.length) {
                    sku = element.text().trim();
                }
            }
        });
        
        if (sku) htmlData.sku = sku;
    }

    extractUsesAndSideEffects($, htmlData) {
        // Extract uses
        const usesSelectors = [
            '.ProductDetails_uses__2x8dJ',
            '.uses-section',
            '[class*="uses"]',
            'h2:contains("Uses")',
            'h3:contains("Uses")'
        ];
        
        let uses = '';
        usesSelectors.forEach(selector => {
            if (!uses) {
                const element = $(selector);
                if (element.length) {
                    // Get the next sibling or parent content
                    const content = element.next().text().trim() || 
                                  element.parent().text().trim();
                    if (content) uses = content;
                }
            }
        });
        
        if (uses) htmlData.uses = uses;
        
        // Extract side effects
        const sideEffectsSelectors = [
            '.ProductDetails_sideEffects__2x8dJ',
            '.side-effects-section',
            '[class*="side"]',
            'h2:contains("Side Effects")',
            'h3:contains("Side Effects")'
        ];
        
        let sideEffects = '';
        sideEffectsSelectors.forEach(selector => {
            if (!sideEffects) {
                const element = $(selector);
                if (element.length) {
                    const content = element.next().text().trim() || 
                                  element.parent().text().trim();
                    if (content) sideEffects = content;
                }
            }
        });
        
        if (sideEffects) htmlData.sideEffects = sideEffects;
        
        // Extract dosage information
        const dosageSelectors = [
            '.ProductDetails_dosage__2x8dJ',
            '.dosage-section',
            '[class*="dosage"]',
            'h2:contains("Dosage")',
            'h3:contains("Dosage")'
        ];
        
        let dosage = '';
        dosageSelectors.forEach(selector => {
            if (!dosage) {
                const element = $(selector);
                if (element.length) {
                    const content = element.next().text().trim() || 
                                  element.parent().text().trim();
                    if (content) dosage = content;
                }
            }
        });
        
        if (dosage) htmlData.dosage = dosage;
        
        // Extract precautions
        const precautionsSelectors = [
            '.ProductDetails_precautions__2x8dJ',
            '.precautions-section',
            '[class*="precautions"]',
            'h2:contains("Precautions")',
            'h3:contains("Precautions")'
        ];
        
        let precautions = '';
        precautionsSelectors.forEach(selector => {
            if (!precautions) {
                const element = $(selector);
                if (element.length) {
                    const content = element.next().text().trim() || 
                                  element.parent().text().trim();
                    if (content) precautions = content;
                }
            }
        });
        
        if (precautions) htmlData.precautions = precautions;
    }

    extractFromJSON($) {
        try {
            // Look for JSON data in script tags
            const scriptTags = $('script[type="application/json"]');
            let jsonData = null;
            
            scriptTags.each((i, el) => {
                try {
                    const content = $(el).html();
                    if (content) {
                        const data = JSON.parse(content);
                        if (data && data.props && data.props.pageProps) {
                            jsonData = data.props.pageProps;
                            return false; // Break the loop
                        }
                    }
                } catch (e) {
                    // Continue to next script tag
                }
            });
            
            if (jsonData) {
                const extracted = {};
                
                // Extract product information from JSON
                if (jsonData.product) {
                    const product = jsonData.product;
                    extracted.title = product.name || product.title;
                    extracted.description = product.description;
                    extracted.mrp = product.mrp || product.price;
                    extracted.sellingPrice = product.sellingPrice || product.discountedPrice;
                    extracted.images = product.images || [];
                    extracted.manufacturer = product.manufacturer;
                    extracted.composition = product.composition;
                    extracted.packSize = product.packSize;
                }
                
                return extracted;
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting JSON data:', error);
            return null;
        }
    }

    calculateDiscount(mrp, sellingPrice) {
        if (!mrp || !sellingPrice || mrp <= sellingPrice) return 0;
        return Math.round(((mrp - sellingPrice) / mrp) * 100);
    }

    extractBrand(productName) {
        if (!productName) return null;
        
        // Common pharmaceutical brands
        const brands = [
            'Dolo', 'Paracetamol', 'Crocin', 'Calpol', 'Combiflam', 'Volini',
            'Iodex', 'Moov', 'Vicks', 'Benadryl', 'Cetirizine', 'Montair',
            'Pantop', 'Omez', 'Rantac', 'Digene', 'Gelusil', 'Eno', 'Liv-52',
            'Himalaya', 'Dabur', 'Baidyanath', 'Patanjali', 'Dr. Reddy\'s',
            'Cipla', 'Sun Pharma', 'Lupin', 'Glenmark', 'Torrent', 'Cadila'
        ];

        for (const brand of brands) {
            if (productName.toLowerCase().includes(brand.toLowerCase())) {
                return brand;
            }
        }
        return null;
    }

    cleanDescription(description) {
        if (!description) return '';
        return description
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, ' ')
            .trim();
    }
}

module.exports = PharmEasyScraper;
